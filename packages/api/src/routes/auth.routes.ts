import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { sendError, AppError } from '../lib/errors.js';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireAAL2 } from '../middleware/aal.js';

const router = Router();

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

export default router;
