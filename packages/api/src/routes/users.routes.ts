import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB } from '@prodscore/shared';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireAAL2 } from '../middleware/aal.js';
import { sendError, AppError } from '../lib/errors.js';
import { supabase, getUserById } from '../lib/supabase.js';
import { buyStreakFreeze } from '../services/gamification.service.js';
import { purgeAllProofFilesForUser } from '../services/proof.service.js';
import { uploadUserAvatar } from '../services/user.service.js';
import { searchUsers, assertAreFriends } from '../services/friend.service.js';
import { computeUserStats } from '../services/stats.service.js';
import {
  computeBehavioralProfile,
  getTaskSuggestions,
  getProcrastinationAlerts,
} from '../services/behavioral.service.js';

const router = Router();

/** Upload em memória — usado só pelo mobile (web faz upload direto pro Supabase Storage) */
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
});

/** Mesma ideia do handler equivalente em groups.routes.ts — erros do multer não passam pelo try/catch normal */
function handleAvatarUpload(req: Request, res: Response, next: NextFunction): void {
  avatarUpload.single('avatar')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ erro: `A imagem deve ter no máximo ${MAX_IMAGE_SIZE_MB} MB.`, codigo: 'ARQUIVO_MUITO_GRANDE' });
      return;
    }
    if (err) {
      res.status(400).json({ erro: 'Erro ao processar o arquivo enviado.', codigo: 'UPLOAD_INVALIDO' });
      return;
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3,  { message: 'O nome de usuário deve ter no mínimo 3 caracteres.' })
    .max(30, { message: 'O nome de usuário deve ter no máximo 30 caracteres.' })
    .regex(
      /^[a-zA-Z0-9_]+$/,
      { message: 'O nome de usuário deve conter apenas letras, números e underscore (_).' },
    )
    .optional(),

  bio: z
    .string()
    .max(300, { message: 'A bio deve ter no máximo 300 caracteres.' })
    .nullable()
    .optional(),

  avatarUrl: z
    .string()
    .url({ message: 'URL do avatar inválida.' })
    .nullable()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Pelo menos um campo deve ser informado para atualizar.' },
);

// ---------------------------------------------------------------------------
// GET /users/me
// ---------------------------------------------------------------------------

/**
 * Retorna o perfil completo do usuário autenticado com dados de gamificação.
 * Os dados do perfil são injetados pelo authGuard via verifySupabaseToken.
 */
router.get('/me', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    return res.status(200).json({ usuario: user });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/me]');
  }
});

// ---------------------------------------------------------------------------
// PATCH /users/me
// ---------------------------------------------------------------------------

/**
 * Atualiza dados editáveis do perfil autenticado (username, bio, avatarUrl).
 */
router.patch('/me', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const body = updateProfileSchema.parse(req.body);

    const patch: Record<string, unknown> = {};
    if (body.username  !== undefined) patch['username']   = body.username;
    if (body.bio       !== undefined) patch['bio']        = body.bio;
    if (body.avatarUrl !== undefined) patch['avatar_url'] = body.avatarUrl;

    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select('id, username, avatar_url, bio, level, total_points, current_streak, longest_streak, created_at')
      .single();

    if (error) {
      // Código 23505 = unique_violation (username já em uso)
      if (error.code === '23505') {
        throw new AppError(
          'Este nome de usuário já está em uso.',
          409,
          'USERNAME_INDISPONIVEL',
        );
      }
      throw new AppError('Erro ao atualizar perfil.', 500, 'ATUALIZACAO_FALHOU');
    }

    const p = data as {
      id: string; username: string; avatar_url: string | null; bio: string | null;
      level: number; total_points: number; current_streak: number;
      longest_streak: number; created_at: string;
    };

    return res.status(200).json({
      mensagem: 'Perfil atualizado com sucesso.',
      usuario: {
        id:            p.id,
        username:      p.username,
        avatarUrl:     p.avatar_url,
        bio:           p.bio,
        level:         p.level,
        totalPoints:   p.total_points,
        currentStreak: p.current_streak,
        longestStreak: p.longest_streak,
        createdAt:     p.created_at,
      },
    });
  } catch (err) {
    return sendError(res, err, '[usuarios/PATCH/me]');
  }
});

// ---------------------------------------------------------------------------
// POST /users/me/avatar
// ---------------------------------------------------------------------------

/**
 * Sobe a foto de perfil do usuário autenticado. Devolve só a URL — quem
 * persiste no perfil é o PATCH /users/me (mesmo padrão do upload de imagem
 * de grupo em POST /groups/image).
 */
router.post('/me/avatar', authGuard, handleAvatarUpload, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const file = req.file;
    if (!file) throw new AppError('Nenhum arquivo enviado.', 400, 'ARQUIVO_AUSENTE');

    const avatarUrl = await uploadUserAvatar(user.id, file.buffer);
    return res.status(200).json({ avatarUrl });
  } catch (err) {
    return sendError(res, err, '[usuarios/POST/me/avatar]');
  }
});

// ---------------------------------------------------------------------------
// DELETE /users/me
// ---------------------------------------------------------------------------

/**
 * Exclui permanentemente a conta do usuário autenticado.
 *
 * Ação sensível — exige requireAAL2 (segundo fator TOTP verificado nesta
 * sessão), além do authGuard padrão. A exclusão em auth.users é propagada
 * por ON DELETE CASCADE para o perfil e a maioria dos dados relacionados
 * (ver migrations); grupos dos quais o usuário é owner impedem a exclusão
 * (ON DELETE RESTRICT) até que a titularidade seja transferida ou o grupo
 * seja apagado.
 */
router.delete('/me', authGuard, requireAAL2, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;

    // Remove os arquivos de comprovação de tarefa do Storage antes de excluir
    // a conta (LGPD: direito à eliminação — os registros em task_proofs caem
    // via ON DELETE CASCADE, mas o arquivo em si não é apagado pelo cascade).
    await purgeAllProofFilesForUser(user.id);

    const { error } = await supabase.auth.admin.deleteUser(user.id);

    if (error) {
      throw new AppError(
        'Não foi possível excluir a conta. Se você é dono de algum grupo, transfira a titularidade ou exclua o grupo antes de continuar.',
        409,
        'EXCLUSAO_CONTA_FALHOU',
      );
    }

    return res.status(200).json({ mensagem: 'Conta excluída com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[usuarios/DELETE/me]');
  }
});

// ---------------------------------------------------------------------------
// GET /users/me/stats
// ---------------------------------------------------------------------------

/**
 * Retorna todas as estatísticas de desempenho do usuário autenticado
 * (cálculo em stats.service.ts → computeUserStats, compartilhado com /:id/stats).
 */
router.get('/me/stats', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const estatisticas = await computeUserStats(user, { includeMissions: true });
    return res.status(200).json({ estatisticas });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/me/stats]');
  }
});

// ---------------------------------------------------------------------------
// POST /users/me/streak/buy-freeze — deve ficar ANTES de /:id
// ---------------------------------------------------------------------------

/**
 * Compra 1 streak freeze debitando FREEZE_COST_POINTS (100 pts) do usuário.
 * Lança 400 se o saldo de pontos for insuficiente.
 */
router.post('/me/streak/buy-freeze', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    await buyStreakFreeze(user.id);
    return res.status(200).json({
      mensagem: 'Freeze de streak adquirido com sucesso!',
    });
  } catch (err) {
    return sendError(res, err, '[usuarios/POST/me/streak/buy-freeze]');
  }
});

// ---------------------------------------------------------------------------
// GET /users/me/transactions — deve ficar ANTES de /:id
// ---------------------------------------------------------------------------

/**
 * Retorna o histórico de transações de pontos do usuário autenticado.
 * Query param opcional: limite (1–50, default 10)
 */
router.get('/me/transactions', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const limiteRaw = req.query['limite'];
    const limite    = Math.min(50, Math.max(1, parseInt(String(limiteRaw ?? '10'), 10) || 10));

    const { data, error } = await supabase
      .from('point_transactions')
      .select('id, amount, reason, reference_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      throw new AppError('Erro ao buscar transações.', 500, 'BUSCA_FALHOU');
    }

    const transacoes = (data ?? []).map((row) => {
      const r = row as {
        id: string; amount: number; reason: string;
        reference_id: string | null; created_at: string;
      };
      return {
        id:          r.id,
        amount:      r.amount,
        reason:      r.reason,
        referenceId: r.reference_id,
        createdAt:   r.created_at,
      };
    });

    return res.status(200).json({ transacoes });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/me/transactions]');
  }
});

// ---------------------------------------------------------------------------
// GET /users/me/behavioral-profile — Mecânica 1
// ---------------------------------------------------------------------------

/**
 * Calcula e retorna o perfil comportamental do usuário autenticado.
 * Analisa o horário de pico de produtividade e características do histórico.
 */
router.get('/me/behavioral-profile', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const profile  = await computeBehavioralProfile(user.id);
    return res.status(200).json({ perfilComportamental: profile });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/me/behavioral-profile]');
  }
});

// ---------------------------------------------------------------------------
// GET /users/me/task-suggestions — Mecânica 7
// ---------------------------------------------------------------------------

/**
 * Retorna até 5 sugestões de tarefas pendentes priorizadas por score de relevância.
 * Considera prazo, prioridade e tempo que a tarefa está parada.
 */
router.get('/me/task-suggestions', authGuard, async (req, res) => {
  try {
    const { user }   = req as AuthenticatedRequest;
    const suggestions = await getTaskSuggestions(user.id);
    return res.status(200).json({ sugestoes: suggestions });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/me/task-suggestions]');
  }
});

// ---------------------------------------------------------------------------
// GET /users/me/procrastination-alerts — Mecânica 10
// ---------------------------------------------------------------------------

/**
 * Detecta padrões de procrastinação e retorna alertas classificados por severidade.
 * Avalia tarefas paradas, atrasos e clusters de urgência.
 */
router.get('/me/procrastination-alerts', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const alerts   = await getProcrastinationAlerts(user.id);
    return res.status(200).json({ alertas: alerts });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/me/procrastination-alerts]');
  }
});

// ---------------------------------------------------------------------------
// GET /users/search?q= — deve ficar ANTES de /:id
// ---------------------------------------------------------------------------

/**
 * Busca usuários por prefixo de username (mín. 2 caracteres), excluindo o
 * próprio usuário, com a relação de amizade atual com cada resultado.
 */
router.get('/search', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const usuarios = await searchUsers(user.id, q);
    return res.status(200).json({ usuarios, total: usuarios.length });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/search]');
  }
});

// ---------------------------------------------------------------------------
// GET /users/:id/stats — deve ficar APÓS /me e /me/stats
// ---------------------------------------------------------------------------

/**
 * Estatísticas completas de OUTRO usuário — exclusivo para amigos.
 *
 * A autorização acontece aqui (a API usa service_role e contorna RLS): sem
 * amizade aceita, 403. Missões ativas ficam de fora (podem envolver grupos
 * privados do outro usuário); o resto é o mesmo conjunto de /me/stats.
 */
router.get('/:id/stats', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const targetId = req.params['id'];
    if (!targetId) throw new AppError('ID do usuário é obrigatório.', 400);
    if (targetId === user.id) throw new AppError('Use /users/me/stats para as próprias estatísticas.', 400);

    await assertAreFriends(user.id, targetId);

    const profile = await getUserById(targetId);
    if (!profile) throw new AppError('Usuário não encontrado.', 404, 'USUARIO_NAO_ENCONTRADO');

    const estatisticas = await computeUserStats(profile, { includeMissions: false });

    return res.status(200).json({
      usuario: {
        id:            profile.id,
        username:      profile.username,
        avatarUrl:     profile.avatarUrl,
        level:         profile.level,
        totalPoints:   profile.totalPoints,
        currentStreak: profile.currentStreak,
      },
      estatisticas,
    });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/:id/stats]');
  }
});

export default router;
