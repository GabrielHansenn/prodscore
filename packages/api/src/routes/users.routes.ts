import { Router } from 'express';
import { z } from 'zod';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireAAL2 } from '../middleware/aal.js';
import { sendError, AppError } from '../lib/errors.js';
import { supabase, getUserById } from '../lib/supabase.js';
import { getMissionsForUser } from '../services/mission.service.js';
import { buyStreakFreeze } from '../services/gamification.service.js';
import { purgeAllProofFilesForUser } from '../services/proof.service.js';
import {
  computeBehavioralProfile,
  getTaskSuggestions,
  getProcrastinationAlerts,
} from '../services/behavioral.service.js';

const router = Router();

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
 * Retorna todas as estatísticas de desempenho do usuário autenticado.
 *
 * Campos calculados:
 * - tasks_completed:          total de tarefas concluídas (all-time)
 * - tasks_completed_this_week: concluídas na semana atual (seg–dom)
 * - consistency_rate:          (concluídas / criadas nos últimos 30 dias) × 100
 * - points_this_week:          pontos ganhos na semana atual
 * - rank_position:             posição no ranking global por total_points
 * - achievements_count:        número de conquistas desbloqueadas
 * - active_missions:           missões em andamento (não expiradas, não concluídas)
 */
router.get('/me/stats', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;

    // Início da semana atual (segunda-feira 00:00:00 UTC)
    const now         = new Date();
    const dayOfWeek   = now.getUTCDay();
    const daysToMon   = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart   = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysToMon);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartISO = weekStart.toISOString();

    // Início do período de 30 dias para consistency_rate
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(now.getUTCDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // Executa todas as queries em paralelo para minimizar latência
    const [
      tasksCompletedResult,
      tasksThisWeekResult,
      tasksLast30Result,
      tasksCompletedLast30Result,
      pointsThisWeekResult,
      rankResult,
      achievementsResult,
    ] = await Promise.all([
      // Total de tarefas concluídas (all-time)
      supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed'),

      // Tarefas concluídas esta semana
      supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', weekStartISO),

      // Total de tarefas criadas nos últimos 30 dias (denominador do consistency_rate)
      supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgoISO),

      // Tarefas concluídas nos últimos 30 dias (numerador do consistency_rate)
      supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', thirtyDaysAgoISO),

      // Pontos ganhos esta semana (apenas transações positivas)
      supabase
        .from('point_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .gte('created_at', weekStartISO)
        .gt('amount', 0),

      // Posição global: conta usuários com mais pontos + 1
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('total_points', user.totalPoints),

      // Total de conquistas desbloqueadas
      supabase
        .from('user_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    // Calcula consistency_rate com proteção contra divisão por zero
    const total30    = tasksLast30Result.count ?? 0;
    const complete30 = tasksCompletedLast30Result.count ?? 0;
    const consistencyRate = total30 > 0
      ? Math.round((complete30 / total30) * 1000) / 10   // 1 casa decimal
      : 0;

    // Soma pontos da semana
    const pointsThisWeek = (pointsThisWeekResult.data ?? []).reduce(
      (sum, tx) => sum + ((tx as { amount: number }).amount),
      0,
    );

    // Posição global = usuários com mais pontos + 1
    const rankPosition = (rankResult.count ?? 0) + 1;

    // Busca missões ativas em andamento
    const allMissions  = await getMissionsForUser(user.id);
    const activeMissions = allMissions.filter(
      (m) => m.isParticipating && !m.isCompleted,
    );

    return res.status(200).json({
      estatisticas: {
        // Dados do perfil (do authGuard)
        totalPoints:    user.totalPoints,
        level:          user.level,
        currentStreak:  user.currentStreak,
        longestStreak:  user.longestStreak,

        // Tarefas
        tasksCompleted:        tasksCompletedResult.count   ?? 0,
        tasksCompletedThisWeek: tasksThisWeekResult.count   ?? 0,
        consistencyRate,

        // Pontos
        pointsThisWeek,

        // Ranking
        rankPosition,

        // Social
        achievementsCount: achievementsResult.count ?? 0,

        // Missões ativas (sem o campo leaderboard para manter a resposta leve)
        activeMissions: activeMissions.map((m) => ({
          id:           m.id,
          title:        m.title,
          type:         m.type,
          currentValue: m.currentValue,
          targetValue:  m.targetValue,
          rewardPoints: m.rewardPoints,
          expiresAt:    m.expiresAt,
        })),
      },
    });
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
// GET /users/:id/stats — deve ficar APÓS /me e /me/stats
// ---------------------------------------------------------------------------

/**
 * Retorna estatísticas públicas de um usuário pelo UUID.
 * Exclui informações privadas como missões e posição de ranking.
 */
router.get('/:id/stats', authGuard, async (req, res) => {
  try {
    const targetId = req.params['id'];
    if (!targetId) throw new AppError('ID do usuário é obrigatório.', 400);

    const [profile, achievementsResult, completedResult] = await Promise.all([
      getUserById(targetId),
      supabase
        .from('user_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetId),
      supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetId)
        .eq('status', 'completed'),
    ]);

    if (!profile) {
      throw new AppError('Usuário não encontrado.', 404, 'USUARIO_NAO_ENCONTRADO');
    }

    return res.status(200).json({
      estatisticas: {
        id:               profile.id,
        username:         profile.username,
        avatarUrl:        profile.avatarUrl,
        level:            profile.level,
        totalPoints:      profile.totalPoints,
        currentStreak:    profile.currentStreak,
        longestStreak:    profile.longestStreak,
        tasksCompleted:   completedResult.count    ?? 0,
        achievementsCount: achievementsResult.count ?? 0,
      },
    });
  } catch (err) {
    return sendError(res, err, '[usuarios/GET/:id/stats]');
  }
});

export default router;
