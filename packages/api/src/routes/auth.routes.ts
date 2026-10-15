import { Router } from 'express';
import { z } from 'zod';
import { validateEmail, validatePassword, REGISTER_ERROR_CODES } from '@prodscore/shared';
import { supabase, createUserScopedClient, createEphemeralAuthClient } from '../lib/supabase.js';
import { sendError, AppError } from '../lib/errors.js';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireSensitiveAuth } from '../middleware/sensitiveAction.js';

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

const EMAIL_TAKEN_MESSAGE = 'Este e-mail já está cadastrado. Tente fazer login.';

const registerSchema = z.object({
  // Mesmas regras do formulário (validateEmail do @prodscore/shared) — inclui
  // terminações inexistentes como ".comm" e "gmail.co"
  email: z
    .string({ required_error: 'E-mail é obrigatório.' })
    .trim()
    .toLowerCase()
    .superRefine((email, ctx) => {
      const message = validateEmail(email);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }),

  // Mesmas regras do formulário (validatePassword do @prodscore/shared):
  // mínimo 8 caracteres, com pelo menos uma letra e um número
  password: z
    .string({ required_error: 'Senha é obrigatória.' })
    .superRefine((password, ctx) => {
      const message = validatePassword(password);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }),

  username: z
    .string({ required_error: 'Nome de usuário é obrigatório.' })
    .trim()
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

const changePasswordSchema = z
  .object({
    // Já conferida em requireSensitiveAuth
    currentPassword: z.string(),
    // Mesmas regras do cadastro (letra, número, 8+ caracteres)
    newPassword: z
      .string({ required_error: 'A nova senha é obrigatória.' })
      .superRefine((password, ctx) => {
        const message = validatePassword(password);
        if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      }),
  })
  .refine((b) => b.newPassword !== b.currentPassword, {
    message: 'A nova senha precisa ser diferente da atual.',
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
 *
 * Erros com `codigo` para o front ligar a mensagem ao campo certo:
 * - 409 USERNAME_JA_EM_USO  → campo "Nome de usuário"
 * - 409 EMAIL_JA_CADASTRADO → campo "E-mail"
 */
router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);

    // Username repetido: checado ANTES do signUp. Se ficasse para o banco, o
    // UNIQUE de profiles.username faria o trigger handle_new_user falhar e o
    // Supabase devolveria só "Database error saving new user", sem dizer qual
    // campo é o problema. (Mesma comparação do UNIQUE: sensível a maiúsculas.)
    const { data: usernameOwner } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', body.username)
      .maybeSingle();

    if (usernameOwner) {
      throw new AppError('Este nome de usuário já está em uso.', 409, REGISTER_ERROR_CODES.usernameTaken);
    }

    // Cliente descartável — signUp abre sessão e não pode contaminar o singleton service role
    const { data, error } = await createEphemeralAuthClient().auth.signUp({
      email:    body.email,
      password: body.password,
      options: {
        // O username é lido pelo trigger handle_new_user para criar o perfil
        data: { username: body.username },
      },
    });

    if (error) {
      // Com a confirmação de e-mail DESLIGADA, o Supabase acusa o e-mail
      // repetido como erro (com ela ligada, ver o caso de identities abaixo)
      if (error.code === 'user_already_exists' || error.message.includes('already registered')) {
        throw new AppError(EMAIL_TAKEN_MESSAGE, 409, REGISTER_ERROR_CODES.emailTaken);
      }
      if (error.status === 429) {
        throw new AppError('Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.', 429, 'MUITAS_TENTATIVAS');
      }
      // Mensagem crua do Supabase/banco fica só no log — não vai para o cliente
      console.error('[auth/register] Erro do Supabase no signUp:', error.message);
      throw new AppError('Não foi possível criar a conta. Tente novamente em instantes.', 500, 'CADASTRO_FALHOU');
    }

    if (!data.user) {
      throw new AppError('Não foi possível criar a conta. Tente novamente em instantes.', 500, 'CADASTRO_FALHOU');
    }

    // E-mail JÁ cadastrado com a confirmação de e-mail LIGADA: o Supabase não
    // retorna erro (proteção contra enumeração de contas) — devolve um usuário
    // "fantasma" sem nenhuma identidade e sem sessão. Era esse caso que antes
    // caía no 201 "Conta criada! Verifique seu e-mail" abaixo.
    if (data.user.identities?.length === 0) {
      throw new AppError(EMAIL_TAKEN_MESSAGE, 409, REGISTER_ERROR_CODES.emailTaken);
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
// POST /auth/resend-confirmation
// ---------------------------------------------------------------------------

const resendSchema = z.object({
  email: z
    .string({ required_error: 'E-mail é obrigatório.' })
    .trim()
    .toLowerCase()
    .email({ message: 'E-mail inválido.' }),
});

/**
 * Reenvia o e-mail de confirmação de cadastro. Usado pelo app, que não fala
 * com o Supabase direto (o web chama supabase.auth.resend).
 *
 * Sempre responde a mesma mensagem, exista ou não a conta, para a rota não
 * servir para descobrir e-mails cadastrados. Só o limite de envios do
 * Supabase (429) é repassado, para o usuário saber que precisa esperar.
 */
router.post('/resend-confirmation', async (req, res) => {
  try {
    const { email } = resendSchema.parse(req.body);
    const { error } = await createEphemeralAuthClient().auth.resend({ type: 'signup', email });

    if (error?.status === 429) {
      throw new AppError('Aguarde um minuto antes de pedir outro e-mail.', 429, 'MUITAS_TENTATIVAS');
    }
    if (error) console.error('[auth/resend-confirmation] Erro do Supabase:', error.message);

    return res.status(200).json({
      mensagem: 'Se houver um cadastro pendente para este e-mail, enviamos um novo link de confirmação.',
    });
  } catch (err) {
    return sendError(res, err, '[auth/resend-confirmation]');
  }
});

// ---------------------------------------------------------------------------
// POST /auth/forgot-password
// ---------------------------------------------------------------------------

/** Página do web que recebe o link do e-mail e define a nova senha */
function passwordResetRedirectUrl(): string {
  const base = (process.env['FRONTEND_URL'] ?? 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/redefinir-senha`;
}

/**
 * Envia o e-mail de "Esqueci minha senha" (web e app). O link leva à página
 * /redefinir-senha do web — por isso ela precisa estar na lista de Redirect
 * URLs do Supabase (Authentication → URL Configuration).
 *
 * Sempre responde a mesma mensagem, exista ou não a conta, para a rota não
 * servir para descobrir e-mails cadastrados. Só o limite de envios do
 * Supabase (429) é repassado.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = resendSchema.parse(req.body);
    const { error } = await createEphemeralAuthClient().auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectUrl(),
    });

    if (error?.status === 429) {
      throw new AppError('Aguarde um minuto antes de pedir outro e-mail.', 429, 'MUITAS_TENTATIVAS');
    }
    if (error) console.error('[auth/forgot-password] Erro do Supabase:', error.message);

    return res.status(200).json({
      mensagem: 'Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha.',
    });
  } catch (err) {
    return sendError(res, err, '[auth/forgot-password]');
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

    // Cliente descartável — a sessão do login não pode contaminar o singleton service role
    const { data, error } = await createEphemeralAuthClient().auth.signInWithPassword({
      email:    body.email,
      password: body.password,
    });

    if (error) {
      // Senha certa, mas e-mail ainda não confirmado: o Supabase só chega a
      // esse erro depois de validar a senha, então dizer isso não revela nada
      // a quem não tem a senha. Antes caía no "E-mail ou senha incorretos",
      // e o usuário não sabia que bastava confirmar o e-mail.
      if (error.code === 'email_not_confirmed') {
        throw new AppError(
          'Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada.',
          403,
          'EMAIL_NAO_CONFIRMADO',
        );
      }
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
 * Ação sensível — exige a senha atual de todos e, de quem tem 2FA ativo,
 * também a sessão verificada com o código (ver requireSensitiveAuth).
 */
router.patch('/password', authGuard, requireSensitiveAuth, async (req, res) => {
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
