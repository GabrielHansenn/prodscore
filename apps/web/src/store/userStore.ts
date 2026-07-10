import { create } from 'zustand';
import { api } from '../services/api.js';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

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
  /** Busca as estatísticas completas de desempenho do usuário autenticado */
  fetchStats: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUserStore = create<UserStoreState>((set) => ({
  stats:     null,
  isLoading: false,

  fetchStats: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<{ estatisticas: UserStats }>('/users/me/stats');
      set({ stats: data.estatisticas, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
