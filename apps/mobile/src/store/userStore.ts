import { create } from 'zustand';
import { api } from '../services/api';

interface ActiveMission {
  id:           string;
  title:        string;
  type:         string;
  currentValue: number;
  targetValue:  number;
  rewardPoints: number;
  expiresAt:    string | null;
}

export interface UserStats {
  totalPoints:            number;
  level:                  number;
  currentStreak:          number;
  longestStreak:          number;
  tasksCompleted:         number;
  tasksCompletedThisWeek: number;
  consistencyRate:        number;
  pointsThisWeek:         number;
  rankPosition:           number;
  achievementsCount:      number;
  activeMissions:         ActiveMission[];
}

interface UserStoreState {
  stats:     UserStats | null;
  isLoading: boolean;
  /** Busca estatísticas completas de desempenho do usuário autenticado */
  fetchStats: () => Promise<void>;
}

export const useUserStore = create<UserStoreState>((set) => ({
  stats:     null,
  isLoading: false,

  fetchStats: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<{ estatisticas: UserStats }>('/users/me/stats');
      set({ stats: data.estatisticas, isLoading: false });
    } catch (err) {
      // Log local (Metro/console do dev) — stats fica preso em null sem isso
      console.error('[userStore.fetchStats] falhou:', err);
      set({ isLoading: false });
    }
  },
}));
