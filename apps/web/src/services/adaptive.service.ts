import type { WeeklyGoalProgress } from '@prodscore/shared';
import { api } from './api.js';

/** Meta semanal personalizada da semana atual, com o progresso */
export async function getWeeklyGoal(): Promise<WeeklyGoalProgress> {
  const { data } = await api.get<{ meta: WeeklyGoalProgress }>('/users/me/weekly-goal');
  return data.meta;
}

/** Últimas metas semanais (a atual primeiro), batidas ou não */
export async function getWeeklyGoalHistory(limite = 8): Promise<WeeklyGoalProgress[]> {
  const { data } = await api.get<{ metas: WeeklyGoalProgress[] }>('/users/me/weekly-goals/history', {
    params: { limite },
  });
  return data.metas;
}
