import { create } from 'zustand';
import { TaskStatus, TaskDifficulty, TaskPriority, type Task, type Achievement, type LevelReward } from '@prodscore/shared';
import { api } from '../services/api.js';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface TaskFilters {
  status?:     TaskStatus;
  difficulty?: TaskDifficulty;
  priority?:   TaskPriority;
  groupId?:    string;
}

/** Resultado retornado pela API ao concluir uma tarefa */
export interface CompleteTaskApiResult {
  tarefa:          Task;
  pontosGanhos:    number;
  novoStreak:      number;
  subidoDeNivel:   boolean;
  novoNivel:       number;
  marcoStreak:     number | null;
  novasConquistas: Achievement[];
  freezeUsado?:    boolean;
  recompensaNivel?: LevelReward | null;
}

interface TaskState {
  tasks:     Task[];
  isLoading: boolean;
  filters:   TaskFilters;

  /** Busca tarefas do usuário com os filtros ativos */
  fetchTasks:    () => Promise<void>;
  /** Cria uma nova tarefa e adiciona ao estado local */
  createTask:    (input: {
    title:             string;
    difficulty:        TaskDifficulty;
    priority?:         TaskPriority;
    estimatedMinutes?: number;
    dueDate?:          string;
    description?:      string;
    groupId?:          string;
    requiresProof?:    boolean;
  }) => Promise<Task>;
  /** Atualiza campos de uma tarefa localmente e na API */
  updateTask:    (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'difficulty' | 'priority' | 'estimatedMinutes' | 'status' | 'dueDate' | 'requiresProof'>>) => Promise<void>;
  /** Remove uma tarefa permanentemente */
  deleteTask:    (id: string) => Promise<void>;
  /**
   * Conclui uma tarefa com atualização otimista:
   * 1. Marca como 'completed' localmente imediatamente
   * 2. Chama a API e sincroniza com a resposta (que inclui pontos, streak, etc.)
   * 3. Em caso de erro, reverte para o estado original
   */
  completeTask:  (id: string) => Promise<CompleteTaskApiResult>;
  setFilters:    (filters: TaskFilters) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks:     [],
  isLoading: false,
  filters:   {},

  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const { filters } = get();
      const params: Record<string, string> = {};
      if (filters.status)     params['status']     = filters.status;
      if (filters.difficulty) params['difficulty'] = filters.difficulty;
      if (filters.groupId)    params['groupId']    = filters.groupId;

      const { data } = await api.get<{ tarefas: Task[] }>('/tasks', { params });
      set({ tasks: data.tarefas, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createTask: async (input) => {
    const { data } = await api.post<{ tarefa: Task }>('/tasks', {
      title:            input.title,
      difficulty:       input.difficulty,
      priority:         input.priority,
      estimatedMinutes: input.estimatedMinutes,
      dueDate:          input.dueDate,
      description:      input.description,
      groupId:          input.groupId,
      requiresProof:    input.requiresProof,
    });
    set((state) => ({ tasks: [data.tarefa, ...state.tasks] }));
    return data.tarefa;
  },

  updateTask: async (id, updates) => {
    const body: Record<string, unknown> = {};
    if (updates.title            !== undefined) body['title']            = updates.title;
    if (updates.description      !== undefined) body['description']      = updates.description;
    if (updates.difficulty       !== undefined) body['difficulty']       = updates.difficulty;
    if (updates.priority         !== undefined) body['priority']         = updates.priority;
    if (updates.estimatedMinutes !== undefined) body['estimatedMinutes'] = updates.estimatedMinutes;
    if (updates.status           !== undefined) body['status']           = updates.status;
    if (updates.dueDate          !== undefined) body['dueDate']          = updates.dueDate;
    if (updates.requiresProof    !== undefined) body['requiresProof']    = updates.requiresProof;

    const { data } = await api.patch<{ tarefa: Task }>(`/tasks/${id}`, body);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? data.tarefa : t)),
    }));
  },

  deleteTask: async (id) => {
    await api.delete(`/tasks/${id}`);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  completeTask: async (id) => {
    // Snapshot para rollback em caso de erro
    const original = get().tasks;

    // Atualização otimista: marca como concluída localmente imediatamente
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: TaskStatus.Completed } : t,
      ),
    }));

    try {
      const { data } = await api.patch<CompleteTaskApiResult>(`/tasks/${id}/complete`);

      // Sincroniza com os dados reais da API (pontos, streak, etc.)
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? data.tarefa : t)),
      }));

      return data;
    } catch (err) {
      // Reverte para o snapshot anterior em caso de falha
      set({ tasks: original });
      throw err;
    }
  },

  setFilters: (filters) => set({ filters }),
}));
