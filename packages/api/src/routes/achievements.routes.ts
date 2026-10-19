import { Router } from 'express';
import type { LevelReward } from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendError, AppError } from '../lib/errors.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /achievements
// ---------------------------------------------------------------------------

/**
 * Retorna o catálogo completo de conquistas disponíveis na plataforma.
 * Inclui critérios de desbloqueio para exibição de progresso no frontend.
 */
router.get('/', authGuard, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('id, name, description, icon, reward_points, criteria, created_at')
      .order('reward_points', { ascending: false });

    if (error) {
      throw new AppError('Erro ao buscar conquistas.', 500);
    }

    return res.status(200).json({
      conquistas: (data ?? []).map((row) => ({
        id:           row.id,
        name:         row.name,
        description:  row.description,
        icon:         row.icon,
        rewardPoints: row.reward_points,
        criteria:     row.criteria,
        createdAt:    row.created_at,
      })),
      total: (data ?? []).length,
    });
  } catch (err) {
    return sendError(res, err, '[conquistas/GET]');
  }
});

// ---------------------------------------------------------------------------
// GET /achievements/me
// ---------------------------------------------------------------------------

/**
 * Retorna as conquistas já desbloqueadas pelo usuário autenticado,
 * com a data de conquista para exibição no card.
 * Deve estar ANTES de /:id (se existisse) para não conflitar.
 */
router.get('/me', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;

    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        achievement_id,
        earned_at,
        achievements (
          id, name, description, icon, reward_points, criteria, created_at
        )
      `)
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false });

    if (error) {
      throw new AppError('Erro ao buscar conquistas do usuário.', 500);
    }

    const conquistas = (data ?? []).map((row) => {
      // O Supabase tipa o join como lista; para esta relação (N:1) vem um objeto só
      const a = row.achievements as unknown as {
        id: string; name: string; description: string; icon: string;
        reward_points: number; criteria: unknown; created_at: string;
      };
      return {
        achievementId: row.achievement_id,
        earnedAt:      row.earned_at,
        id:            a.id,
        name:          a.name,
        description:   a.description,
        icon:          a.icon,
        rewardPoints:  a.reward_points,
        criteria:      a.criteria,
        createdAt:     a.created_at,
      };
    });

    return res.status(200).json({ conquistas, total: conquistas.length });
  } catch (err) {
    return sendError(res, err, '[conquistas/GET/me]');
  }
});

// ---------------------------------------------------------------------------
// GET /achievements/level-rewards
// ---------------------------------------------------------------------------

/**
 * Recompensas dos níveis marco, direto da tabela level_rewards — a página de
 * Ajuda mostra estes valores (e não uma cópia), para acompanhar o banco.
 */
router.get('/level-rewards', authGuard, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('level_rewards')
      .select('level, bonus_points, bonus_freezes, badge_key, description')
      .order('level', { ascending: true });

    if (error) {
      throw new AppError('Erro ao buscar as recompensas de nível.', 500);
    }

    const recompensas: LevelReward[] = (data ?? []).map((row) => ({
      level:        row.level,
      bonusPoints:  row.bonus_points,
      bonusFreezes: row.bonus_freezes,
      badgeKey:     row.badge_key,
      description:  row.description,
    }));

    return res.status(200).json({ recompensas, total: recompensas.length });
  } catch (err) {
    return sendError(res, err, '[conquistas/GET/level-rewards]');
  }
});

export default router;
