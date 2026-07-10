import { Router } from 'express';
import { z } from 'zod';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendError, AppError } from '../lib/errors.js';
import { supabase } from '../lib/supabase.js';
import { getGroupRanking } from '../services/group.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schema de query param compartilhado
// ---------------------------------------------------------------------------

const limitSchema = z.object({
  limite: z.coerce
    .number()
    .int()
    .min(1,   { message: 'O limite deve ser pelo menos 1.' })
    .max(100, { message: 'O limite máximo é 100.' })
    .default(50),
});

// ---------------------------------------------------------------------------
// GET /ranking/global
// ---------------------------------------------------------------------------

/**
 * Ranking global usando a view materializada ranking_global_mv.
 * Score = total_points×0.5 + (streak×10)×0.3 + consistency_rate×0.2
 * (view atualizada via POST /ranking/refresh ou Edge Function agendada)
 *
 * Query param: ?limite=50 (padrão 50, máximo 100)
 */
router.get('/global', authGuard, async (req, res) => {
  try {
    const { limite } = limitSchema.parse(req.query);

    const { data, error } = await supabase
      .from('ranking_global_mv')
      .select('position, id, username, avatar_url, level, total_points, current_streak, consistency_rate, score')
      .order('position', { ascending: true })
      .limit(limite);

    if (error) throw new AppError('Erro ao buscar ranking global.', 500);

    const rows = (data ?? []) as Array<{
      position:         number;
      id:               string;
      username:         string;
      avatar_url:       string | null;
      level:            number;
      total_points:     number;
      current_streak:   number;
      consistency_rate: number;
      score:            number;
    }>;

    const ranking = rows.map((row) => ({
      position:        row.position,
      usuario: {
        id:        row.id,
        username:  row.username,
        avatarUrl: row.avatar_url,
        level:     row.level,
      },
      totalPoints:     row.total_points,
      currentStreak:   row.current_streak,
      consistencyRate: row.consistency_rate,
      score:           row.score,
    }));

    return res.status(200).json({ ranking, total: ranking.length });
  } catch (err) {
    return sendError(res, err, '[ranking/global]');
  }
});

// ---------------------------------------------------------------------------
// GET /ranking/weekly
// ---------------------------------------------------------------------------

/**
 * Ranking semanal via função SQL get_weekly_ranking().
 * Soma pontos positivos de point_transactions desde a segunda-feira da semana corrente.
 *
 * Query param: ?limite=50 (padrão 50, máximo 100)
 */
router.get('/weekly', authGuard, async (req, res) => {
  try {
    const { limite } = limitSchema.parse(req.query);

    // Calcula o início da semana para incluir no response (segunda-feira 00:00 UTC)
    const now       = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday    = new Date(now);
    monday.setUTCDate(now.getUTCDate() - daysToMon);
    monday.setUTCHours(0, 0, 0, 0);
    const weekStart = monday.toISOString();

    const { data, error } = await supabase.rpc('get_weekly_ranking', { p_limit: limite });

    if (error) throw new AppError('Erro ao buscar ranking semanal.', 500);

    const rows = (data ?? []) as Array<{
      position:       number;
      user_id:        string;
      username:       string;
      avatar_url:     string | null;
      level:          number;
      current_streak: number;
      weekly_points:  number;
    }>;

    const ranking = rows.map((row) => ({
      position:      row.position,
      usuario: {
        id:        row.user_id,
        username:  row.username,
        avatarUrl: row.avatar_url,
        level:     row.level,
      },
      pontosNaSemana: row.weekly_points,
      currentStreak:  row.current_streak,
    }));

    return res.status(200).json({
      ranking,
      total:        ranking.length,
      semanaInicio: weekStart,
    });
  } catch (err) {
    return sendError(res, err, '[ranking/weekly]');
  }
});

// ---------------------------------------------------------------------------
// POST /ranking/refresh
// ---------------------------------------------------------------------------

/**
 * Atualiza a view materializada ranking_global_mv.
 * Chamado pelo cron (Edge Function refresh-ranking) ou manualmente por admin.
 * CONCURRENTLY não bloqueia leituras simultâneas durante o refresh.
 */
router.post('/refresh', authGuard, async (_req, res) => {
  try {
    const { error } = await supabase.rpc('refresh_ranking_global');

    if (error) throw new AppError('Erro ao atualizar o ranking.', 500);

    return res.status(200).json({ mensagem: 'Ranking global atualizado com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[ranking/refresh]');
  }
});

// ---------------------------------------------------------------------------
// GET /ranking/group/:id
// ---------------------------------------------------------------------------

/**
 * Retorna o ranking de um grupo específico (reusa a lógica do group service).
 * Restrito a membros do grupo.
 */
router.get('/group/:id', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    const ranking = await getGroupRanking(groupId, user.id);
    return res.status(200).json({ ranking, total: ranking.length });
  } catch (err) {
    return sendError(res, err, '[ranking/group]');
  }
});

export default router;
