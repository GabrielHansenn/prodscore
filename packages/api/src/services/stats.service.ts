import type { User } from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { getMissionsForUser } from './mission.service.js';

/** Campos do perfil de que o cálculo precisa (subconjunto de User) */
type StatsProfile = Pick<User, 'id' | 'totalPoints' | 'level' | 'currentStreak' | 'longestStreak' | 'streakFreezes'>;

export interface ActiveMissionSummary {
  id:           string;
  title:        string;
  type:         string;
  currentValue: number;
  targetValue:  number;
  rewardPoints: number;
  expiresAt:    string | null;
}

export interface ComputedStats {
  totalPoints:            number;
  level:                  number;
  currentStreak:          number;
  longestStreak:          number;
  streakFreezes:          number;
  tasksCompleted:         number;
  tasksTotal:             number;
  tasksCompletedThisWeek: number;
  consistencyRate:        number;
  pointsThisWeek:         number;
  rankPosition:           number;
  achievementsCount:      number;
  activeMissions:         ActiveMissionSummary[];
}

/**
 * Calcula as estatísticas de desempenho de um usuário.
 *
 * Usado tanto para o próprio usuário (GET /users/me/stats) quanto para o
 * perfil de um amigo (GET /users/:id/stats) — a autorização (só amigos) é
 * responsabilidade da rota. `includeMissions = false` omite as missões
 * ativas: elas podem envolver grupos privados do outro usuário.
 *
 * Métricas:
 * - tasks_completed:           total de tarefas concluídas (all-time)
 * - tasks_total:               total de tarefas criadas (all-time) — base da taxa de conclusão
 * - tasks_completed_this_week: concluídas na semana atual (seg–dom, UTC)
 * - consistency_rate:          (concluídas / criadas nos últimos 30 dias) × 100
 * - points_this_week:          pontos ganhos na semana atual (só transações positivas)
 * - rank_position:             posição no ranking global por total_points
 * - achievements_count:        conquistas desbloqueadas
 */
export async function computeUserStats(
  profile: StatsProfile,
  options: { includeMissions: boolean },
): Promise<ComputedStats> {
  // Início da semana atual (segunda-feira 00:00:00 UTC)
  const now       = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysToMon);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekStartISO = weekStart.toISOString();

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(now.getUTCDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  const [
    tasksCompletedResult,
    tasksTotalResult,
    tasksThisWeekResult,
    tasksLast30Result,
    tasksCompletedLast30Result,
    pointsThisWeekResult,
    rankResult,
    achievementsResult,
  ] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('status', 'completed'),

    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id),

    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('status', 'completed').gte('completed_at', weekStartISO),

    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).gte('created_at', thirtyDaysAgoISO),

    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('status', 'completed').gte('completed_at', thirtyDaysAgoISO),

    supabase.from('point_transactions').select('amount')
      .eq('user_id', profile.id).gte('created_at', weekStartISO).gt('amount', 0),

    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .gt('total_points', profile.totalPoints),

    supabase.from('user_achievements').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id),
  ]);

  const total30    = tasksLast30Result.count ?? 0;
  const complete30 = tasksCompletedLast30Result.count ?? 0;
  const consistencyRate = total30 > 0 ? Math.round((complete30 / total30) * 1000) / 10 : 0;

  const pointsThisWeek = (pointsThisWeekResult.data ?? []).reduce(
    (sum, tx) => sum + (tx as { amount: number }).amount,
    0,
  );

  let activeMissions: ActiveMissionSummary[] = [];
  if (options.includeMissions) {
    const allMissions = await getMissionsForUser(profile.id);
    activeMissions = allMissions
      .filter((m) => m.isParticipating && !m.isCompleted)
      .map((m) => ({
        id:           m.id,
        title:        m.title,
        type:         m.type,
        currentValue: m.currentValue,
        targetValue:  m.targetValue,
        rewardPoints: m.rewardPoints,
        expiresAt:    m.expiresAt,
      }));
  }

  return {
    totalPoints:            profile.totalPoints,
    level:                  profile.level,
    currentStreak:          profile.currentStreak,
    longestStreak:          profile.longestStreak,
    streakFreezes:          profile.streakFreezes,
    tasksCompleted:         tasksCompletedResult.count ?? 0,
    tasksTotal:             tasksTotalResult.count     ?? 0,
    tasksCompletedThisWeek: tasksThisWeekResult.count  ?? 0,
    consistencyRate,
    pointsThisWeek,
    rankPosition:           (rankResult.count ?? 0) + 1,
    achievementsCount:      achievementsResult.count ?? 0,
    activeMissions,
  };
}
