import { create } from 'zustand';
import type { Task, LevelReward, TaskPriority } from '@prodscore/shared';
import { TaskDifficulty, TaskStatus } from '@prodscore/shared';
import { api } from '../services/api';

// Pontuação base por dificuldade (espelho do backend)
const BASE_POINTS: Record<TaskDifficulty, number> = {
  [TaskDifficulty.Easy]:   10,
  [TaskDifficulty.Medium]: 25,
  [TaskDifficulty.Hard]:   50,
  [TaskDifficulty.Epic]:   100,
};

export interface CompleteTaskResult {
  tarefa:          Task;
  pontosGanhos:    number;
  novoStreak:      number;
  novoNivel:       number;
  subidoDeNivel:   boolean;
  marcoStreak:     boolean;
  recompensaNivel: LevelReward | null;
}

interface CreateTaskInput {
  title:             string;
  difficulty:        TaskDifficulty;
  priority?:         TaskPriority;
  description?:      string;
  dueDate?:          string;
  estimatedMinutes?: number;
  groupId?:          string;
  requiresProof?:    boolean;
}

interface TaskFilters {
  status?:     TaskStatus;
  difficulty?: TaskDifficulty;
}

interface TaskStoreState {
  tasks:     Task[];
  isLoading: boolean;
  filters:   TaskFilters;

  fetchTasks:    (filters?: TaskFilters) => Promise<void>;
  createTask:    (input: CreateTaskInput) => Promise<Task>;
  updateTask:    (id: string, input: Partial<CreateTaskInput>) => Promise<void>;
  deleteTask:    (id: string) => Promise<void>;
  /** Completa a tarefa com atualização otimista do estado local */
  completeTask:  (id: string) => Promise<CompleteTaskResult>;
  setFilters:    (filters: TaskFilters) => void;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks:     [],
  isLoading: false,
  filters:   {},

  fetchTasks: async (filters) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string> = {};
      const f = filters ?? get().filters;
      if (f.status)     params['status']     = f.status;
      if (f.difficulty) params['difficulty'] = f.difficulty;

      const { data } = await api.get<{ tarefas: Task[] }>('/tasks', { params });
      set({ tasks: data.tarefas, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createTask: async (input) => {
    const { data } = await api.post<{ tarefa: Task }>('/tasks', input);
    set((state) => ({ tasks: [data.tarefa, ...state.tasks] }));
    return data.tarefa;
  },

  updateTask: async (id, input) => {
    const { data } = await api.patch<{ tarefa: Task }>(`/tasks/${id}`, input);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? data.tarefa : t)),
    }));
  },

  deleteTask: async (id) => {
    await api.delete(`/tasks/${id}`);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  completeTask: async (id) => {
    // Atualização otimista — reverte em caso de erro
    const snapshot = get().tasks;
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: TaskStatus.Completed, pointsEarned: BASE_POINTS[t.difficulty] } : t,
      ),
    }));
    try {
      const { data } = await api.patch<CompleteTaskResult>(`/tasks/${id}/complete`);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? data.tarefa : t)),
      }));
      return data;
    } catch (err) {
      set({ tasks: snapshot });
      throw err;
    }
  },

  setFilters: (filters) => {
    set({ filters });
    void get().fetchTasks(filters);
  },
}));
