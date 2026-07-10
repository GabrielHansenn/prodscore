import { type Task, type TaskDifficulty, type TaskPriority, type Achievement } from '@prodscore/shared';
import { api } from './api.js';

/** Parâmetros de filtro para listagem de tarefas */
export interface GetTasksParams {
  status?:     string;
  difficulty?: string;
  groupId?:    string;
}

/** Resultado da conclusão de uma tarefa */
export interface CompleteTaskResult {
  tarefa:          Task;
  pontosGanhos:    number;
  novoStreak:      number;
  subidoDeNivel:   boolean;
  novoNivel:       number;
  marcoStreak:     number | null;
  novasConquistas: Achievement[];
}

/**
 * Busca todas as tarefas do usuário autenticado com filtros opcionais.
 */
export async function getTasks(params?: GetTasksParams): Promise<Task[]> {
  const { data } = await api.get<{ tarefas: Task[] }>('/tasks', { params });
  return data.tarefas;
}

/**
 * Cria uma nova tarefa para o usuário autenticado.
 */
export async function createTask(input: {
  title:             string;
  difficulty:        TaskDifficulty;
  priority?:         TaskPriority;
  estimatedMinutes?: number;
  description?:      string;
  dueDate?:          string;
  groupId?:          string;
}): Promise<Task> {
  const { data } = await api.post<{ tarefa: Task }>('/tasks', input);
  return data.tarefa;
}

/**
 * Atualiza campos editáveis de uma tarefa.
 */
export async function updateTask(
  id:      string,
  updates: Partial<Pick<Task, 'title' | 'description' | 'difficulty' | 'priority' | 'estimatedMinutes' | 'status' | 'dueDate'>>,
): Promise<Task> {
  const { data } = await api.patch<{ tarefa: Task }>(`/tasks/${id}`, updates);
  return data.tarefa;
}

/**
 * Remove permanentemente uma tarefa.
 */
export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

/**
 * Conclui uma tarefa e retorna o resultado completo da gamificação.
 */
export async function completeTask(id: string): Promise<CompleteTaskResult> {
  const { data } = await api.patch<CompleteTaskResult>(`/tasks/${id}/complete`);
  return data;
}
