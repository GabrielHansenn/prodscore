import { create } from 'zustand';
import { api } from '../services/api.js';
import { getFriendlyErrorMessage } from '../lib/errors.js';

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
  streakFreezes:          number;
  tasksCompleted:         number;
  tasksTotal:             number;
  tasksCompletedThisWeek: number;
  consistencyRate:        number;
  pointsThisWeek:         number;
  /** Posição na tabela do ranking global; 0 = ainda não entrou no ranking */
  rankPosition:           number;
  /** Pontuação multifatorial no ranking global (null = ainda não entrou) */
  rankScore?:             number | null;
  achievementsCount:      number;
  activeMissions:         ActiveMission[];
}

interface UserStoreState {
  stats:     UserStats | null;
  isLoading: boolean;
  /** Mensagem da última falha ao carregar (null = carregou bem) */
  loadError: string | null;
  /** Busca as estatísticas completas de desempenho do usuário autenticado */
  fetchStats: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUserStore = create<UserStoreState>((set) => ({
  stats:     null,
  isLoading: false,
  loadError: null,

  fetchStats: async () => {
    set({ isLoading: true, loadError: null });
    try {
      const { data } = await api.get<{ estatisticas: UserStats }>('/users/me/stats');
      set({ stats: data.estatisticas, isLoading: false });
    } catch (err) {
      // Antes o erro era descartado e as telas ficavam carregando para sempre
      set({ isLoading: false, loadError: getFriendlyErrorMessage(err, 'Não foi possível carregar suas estatísticas.') });
    }
  },
}));
