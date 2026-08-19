import { Router } from 'express';
import { z } from 'zod';
import { supabase, createUserScopedClient } from '../lib/supabase.js';
import { sendError, AppError } from '../lib/errors.js';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireAAL2 } from '../middleware/aal.js';

const router = Router();

/** Extrai o JWT do cabeçalho Authorization — authGuard já garantiu que é válido */
function extractBearerToken(req: { headers: Record<string, unknown> }): string {
  return (req.headers['authorization'] as string).slice(7).trim();
}

/** Traduz as mensagens de erro mais comuns do Supabase MFA para português */
function translateMfaError(rawMessage: string | undefined): string {
  const msg = (rawMessage ?? '').toLowerCase();

  if (msg.includes('invalid') && (msg.includes('totp') || msg.includes('code'))) {
    return 'Código inválido. Verifique o aplicativo autenticador e tente novamente.';
  }
  if (msg.includes('expired')) {
    return 'Código expirado. Gere um novo código no aplicativo autenticador e tente novamente.';
  }
  if (msg.includes('already enrolled') || msg.includes('already exists')) {
    return 'Você já possui um fator de autenticação ativo.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  }
  return 'Não foi possível confirmar o código. Tente novamente.';
}

// ---------------------------------------------------------------------------
// Schemas de validação (mensagens em português)
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z
    .string({ required_error: 'E-mail é obrigatório.' })
    .email({ message: 'E-mail inválido.' }),

  password: z
    .string({ required_error: 'Senha é obrigatória.' })
    .min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' }),

  username: z
    .string({ required_error: 'Nome de usuário é obrigatório.' })
    .min(3,  { message: 'O nome de usuário deve ter no mínimo 3 caracteres.' })
    .max(30, { message: 'O nome de usuário deve ter no máximo 30 caracteres.' })
    .regex(
      /^[a-zA-Z0-9_]+$/,
      { message: 'O nome de usuário deve conter apenas letras, números e underscore (_).' },
    ),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'E-mail é obrigatório.' })
    .email({ message: 'E-mail inválido.' }),

  password: z
    .string({ required_error: 'Senha é obrigatória.' })
    .min(1, { message: 'Senha é obrigatória.' }),
});

/** Corpo comum das rotas de MFA que precisam completar a sessão do usuário */
const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'refreshToken é obrigatório.' })
    .min(1, { message: 'refreshToken é obrigatório.' }),
});

const mfaVerifySchema = refreshTokenSchema.extend({
  factorId: z
    .string({ required_error: 'factorId é obrigatório.' })
    .min(1, { message: 'factorId é obrigatório.' }),

  code: z
    .string({ required_error: 'Código é obrigatório.' })
    .regex(/^\d{6}$/, { message: 'Digite os 6 dígitos do código exibido no aplicativo autenticador.' }),
});

const changePasswordSchema = z.object({
  newPassword: z
    .string({ required_error: 'A nova senha é obrigatória.' })
    .min(8, { message: 'A nova senha deve ter no mínimo 8 caracteres.' }),
});

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------

/**
 * Registra um novo usuário na plataforma.
 *
 * Fluxo:
 * 1. Valida os campos com Zod
 * 2. Cria o usuário no Supabase Auth (supabase.auth.signUp)
 * 3. O trigger handle_new_user cria o perfil automaticamente em public.profiles
 * 4. Retorna sessão + dados básicos do usuário
 *
 * Se a confirmação de e-mail estiver habilitada no Supabase, session será null
 * e o usuário precisará confirmar o e-mail antes de fazer login.
 */
router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);

    const { data, error } = await supabase.auth.signUp({
      email:    body.email,
      password: body.password,
      options: {
        // O username é lido pelo trigger handle_new_user para criar o perfil
        data: { username: body.username },
      },
    });

    if (error) {
      // Supabase retorna erros específicos em inglês — traduzimos os mais comuns
      if (error.message.includes('already registered')) {
        throw new AppError('Este e-mail já está cadastrado.', 409, 'EMAIL_JA_CADASTRADO');
      }
      throw new AppError(`Erro ao criar conta: ${error.message}`, 400);
    }

    if (!data.user) {
      throw new AppError('Erro ao criar conta.', 500);
    }

    // Sessão pode ser null se confirmação de e-mail estiver habilitada
    if (!data.session) {
      return res.status(201).json({
        mensagem: 'Conta criada! Verifique seu e-mail para confirmar o cadastro.',
        userId:   data.user.id,
      });
    }

    return res.status(201).json({
      mensagem: 'Conta criada com sucesso.',
      sessao: {
        accessToken:  data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn:    data.session.expires_in,
      },
      usuario: {
        id:       data.user.id,
        email:    data.user.email,
        username: body.username,
      },
    });
  } catch (err) {
    return sendError(res, err, '[auth/register]');
  }
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

/**
 * Autentica o usuário com e-mail e senha.
 *
 * Retorna o access token JWT, refresh token e os dados do perfil completo.
 * O access token deve ser enviado em todas as rotas protegidas via:
 *   Authorization: Bearer <access_token>
 */
router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);

    const { data, error } = await supabase.auth.signInWithPassword({
      email:    body.email,
      password: body.password,
    });

    if (error) {
      // Mensagem genérica por segurança — não revela se o e-mail existe
      throw new AppError(
        'E-mail ou senha incorretos.',
        401,
        'CREDENCIAIS_INVALIDAS',
      );
    }

    if (!data.session || !data.user) {
      throw new AppError('Erro ao iniciar sessão.', 500);
    }

    // Verifica se a conta tem 2FA ativo pendente de confirmação nesta sessão
    // (aal1 com step-up disponível para aal2) — sem isso, um login com só
    // e-mail e senha devolveria uma sessão totalmente utilizável mesmo para
    // contas com 2FA ligado, contornando o segundo fator. Cliente próprio
    // (não o singleton service role compartilhado) porque auth.mfa.* lê a
    // sessão interna do cliente, e um singleton compartilhado entre
    // requisições concorrentes vazaria sessão de um login para outro.
    const { client: scopedClient, error: scopeError } = await createUserScopedClient(
      data.session.access_token,
      data.session.refresh_token,
    );

    if (scopeError) {
      throw new AppError('Erro ao verificar autenticação em duas etapas.', 500);
    }

    const { data: aalData, error: aalError } = await scopedClient.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      throw new AppError('Erro ao verificar autenticação em duas etapas.', 500);
    }

    if (aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
      const { data: factorsData } = await scopedClient.auth.mfa.listFactors();
      const pendingFactor = factorsData?.totp[0];

      return res.status(200).json({
        mfaRequired: true,
        factorId:    pendingFactor?.id ?? null,
        sessao: {
          accessToken:  data.session.access_token,
          refreshToken: data.session.refresh_token,
        },
      });
    }

    // Busca o perfil completo com dados de gamificação
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url, bio, level, total_points, current_streak, longest_streak')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw new AppError('Perfil não encontrado.', 404);
    }

    const p = profile as {
      username: string; avatar_url: string | null; bio: string | null;
      level: number; total_points: number; current_streak: number; longest_streak: number;
    };

    return res.status(200).json({
      mfaRequired: false,
      sessao: {
        accessToken:  data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn:    data.session.expires_in,
      },
      usuario: {
        id:            data.user.id,
        email:         data.user.email,
        username:      p.username,
        avatarUrl:     p.avatar_url,
        bio:           p.bio,
        level:         p.level,
        totalPoints:   p.total_points,
        currentStreak: p.current_streak,
        longestStreak: p.longest_streak,
      },
    });
  } catch (err) {
    return sendError(res, err, '[auth/login]');
  }
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

/**
 * Encerra a sessão atual do usuário.
 *
 * Requer token válido no cabeçalho Authorization.
 * Invalida o token no Supabase Auth para todas as sessões do usuário.
 */
router.post('/logout', authGuard, async (req, res) => {
  try {
    // Extrai o JWT do cabeçalho — authGuard já garantiu que é válido
    const token = (req.headers['authorization'] as string).slice(7);

    // Invalida o token via admin API (scope 'global' = encerra todas as sessões do usuário)
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      throw new AppError('Erro ao encerrar sessão.', 500, 'LOGOUT_FALHOU');
    }

    return res.status(200).json({ mensagem: 'Sessão encerrada com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[auth/logout]');
  }
});

// ---------------------------------------------------------------------------
// PATCH /auth/password
// ---------------------------------------------------------------------------

/**
 * Altera a senha do usuário autenticado.
 *
 * Ação sensível — exige requireAAL2 (segundo fator TOTP verificado nesta
 * sessão), além do authGuard padrão.
 */
router.patch('/password', authGuard, requireAAL2, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const body = changePasswordSchema.parse(req.body);

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: body.newPassword,
    });

    if (error) {
      throw new AppError('Erro ao alterar a senha.', 500, 'ALTERACAO_SENHA_FALHOU');
    }

    return res.status(200).json({ mensagem: 'Senha alterada com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[auth/password]');
  }
});

// ---------------------------------------------------------------------------
// Autenticação de dois fatores (TOTP)
// ---------------------------------------------------------------------------
//
// Todas as rotas abaixo precisam do refreshToken no corpo/query além do
// access token no cabeçalho Authorization — supabase.auth.mfa.* opera sobre
// a sessão interna do cliente (setSession), não sobre o header da requisição,
// então é preciso reidratar um cliente com a sessão completa do usuário a
// cada chamada (ver createUserScopedClient em lib/supabase.ts).

// ---------------------------------------------------------------------------
// GET /auth/mfa/factors
// ---------------------------------------------------------------------------

/** Lista os fatores TOTP do usuário autenticado — verificados e não verificados */
router.get('/mfa/factors', authGuard, async (req, res) => {
  try {
    const refreshToken = req.query['refreshToken'];
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new AppError('refreshToken é obrigatório.', 400);
    }

    const { client, error } = await createUserScopedClient(extractBearerToken(req), refreshToken);
    if (error) throw new AppError('Sessão inválida. Faça login novamente.', 401);

    const { data, error: listError } = await client.auth.mfa.listFactors();
    if (listError) throw new AppError('Erro ao buscar fatores de autenticação.', 500);

    const fatores = data.all
      .filter((f) => f.factor_type === 'totp')
      .map((f) => ({
        id:           f.id,
        friendlyName: f.friendly_name ?? null,
        status:       f.status === 'verified' ? 'verified' : 'unverified',
        createdAt:    f.created_at,
      }));

    return res.status(200).json({ fatores });
  } catch (err) {
    return sendError(res, err, '[auth/mfa/factors]');
  }
});

// ---------------------------------------------------------------------------
// POST /auth/mfa/enroll
// ---------------------------------------------------------------------------

/**
 * Inicia o cadastro de um novo fator TOTP para o usuário autenticado.
 * Fator fica "unverified" até ser confirmado em POST /auth/mfa/verify.
 */
router.post('/mfa/enroll', authGuard, async (req, res) => {
  try {
    const body = refreshTokenSchema.parse(req.body);
    const { client, error } = await createUserScopedClient(extractBearerToken(req), body.refreshToken);
    if (error) throw new AppError('Sessão inválida. Faça login novamente.', 401);

    const { data, error: enrollError } = await client.auth.mfa.enroll({
      factorType:   'totp',
      friendlyName: 'ProdScore',
    });

    if (enrollError || !data) {
      throw new AppError('Não foi possível iniciar a ativação do 2FA. Tente novamente.', 500);
    }

    return res.status(200).json({
      factorId:   data.id,
      qrCodeSvg:  data.totp.qr_code,
      secret:     data.totp.secret,
      otpauthUri: data.totp.uri,
    });
  } catch (err) {
    return sendError(res, err, '[auth/mfa/enroll]');
  }
});

// ---------------------------------------------------------------------------
// POST /auth/mfa/verify
// ---------------------------------------------------------------------------

/**
 * Confirma um código TOTP de 6 dígitos — usado tanto para confirmar um novo
 * enrollment quanto para o step-up de login (aal1 → aal2). Em caso de
 * sucesso, devolve uma nova sessão já elevada a aal2.
 */
router.post('/mfa/verify', authGuard, async (req, res) => {
  try {
    const body = mfaVerifySchema.parse(req.body);
    const { client, error } = await createUserScopedClient(extractBearerToken(req), body.refreshToken);
    if (error) throw new AppError('Sessão inválida. Faça login novamente.', 401);

    const { data, error: verifyError } = await client.auth.mfa.challengeAndVerify({
      factorId: body.factorId,
      code:     body.code,
    });

    if (verifyError || !data) {
      throw new AppError(translateMfaError(verifyError?.message), 400, 'CODIGO_INVALIDO');
    }

    return res.status(200).json({
      sessao: {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token,
      },
    });
  } catch (err) {
    return sendError(res, err, '[auth/mfa/verify]');
  }
});

// ---------------------------------------------------------------------------
// DELETE /auth/mfa/:factorId
// ---------------------------------------------------------------------------

/** Remove um fator TOTP cadastrado, desativando o 2FA associado a ele */
router.delete('/mfa/:factorId', authGuard, async (req, res) => {
  try {
    const { factorId } = req.params;
    if (!factorId) {
      throw new AppError('ID do fator é obrigatório.', 400);
    }

    const body = refreshTokenSchema.parse(req.body);
    const { client, error } = await createUserScopedClient(extractBearerToken(req), body.refreshToken);
    if (error) throw new AppError('Sessão inválida. Faça login novamente.', 401);

    const { error: unenrollError } = await client.auth.mfa.unenroll({ factorId });
    if (unenrollError) {
      throw new AppError('Não foi possível desativar o 2FA. Tente novamente.', 500);
    }

    return res.status(200).json({ mensagem: '2FA desativado com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[auth/mfa/unenroll]');
  }
});

export default router;
