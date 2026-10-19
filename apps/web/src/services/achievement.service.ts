import { api } from './api.js';
import type { LevelReward } from '@prodscore/shared';

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

/**
 * Recompensas dos níveis marco (tabela level_rewards) — a página de Ajuda
 * mostra os valores do banco, não uma cópia.
 */
export async function getLevelRewards(): Promise<LevelReward[]> {
  const { data } = await api.get<{ recompensas: LevelReward[] }>('/achievements/level-rewards');
  return data.recompensas;
}
