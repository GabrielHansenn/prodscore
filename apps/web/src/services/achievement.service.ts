import { api } from './api.js';

/** Conquista do catálogo com critérios de desbloqueio */
export interface AchievementItem {
  id:           string;
  name:         string;
  description:  string;
  icon:         string;
  rewardPoints: number;
  criteria:     { type: string; threshold: number };
  createdAt:    string;
}

/** Conquista desbloqueada pelo usuário */
export interface UserAchievementItem extends AchievementItem {
  earnedAt: string;
}

/**
 * Retorna o catálogo completo de conquistas disponíveis na plataforma.
 */
export async function getAchievements(): Promise<AchievementItem[]> {
  const { data } = await api.get<{ conquistas: AchievementItem[] }>('/achievements');
  return data.conquistas;
}

/**
 * Retorna as conquistas já desbloqueadas pelo usuário autenticado.
 */
export async function getUserAchievements(): Promise<UserAchievementItem[]> {
  const { data } = await api.get<{ conquistas: UserAchievementItem[] }>('/achievements/me');
  return data.conquistas;
}
