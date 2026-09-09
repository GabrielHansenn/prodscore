import { type Task, type TaskDifficulty, type TaskPriority, type Achievement } from '@prodscore/shared';
import { api, callApi } from './api.js';

/** Parâmetros de filtro para listagem de tarefas */
export interface GetTasksParams {
  status?:     string;
  difficulty?: string;
  groupId?:    string;
}

/** Missão concluída como efeito colateral de uma tarefa */
export interface CompletedMissionInfo {
  missaoId:     string;
  titulo:       string;
  pontosGanhos: number;
}

/** Resultado da conclusão de uma tarefa */
export interface CompleteTaskResult {
  tarefa:            Task;
  pontosGanhos:      number;
  novoStreak:        number;
  subidoDeNivel:     boolean;
  novoNivel:         number;
  marcoStreak:       number | null;
  novasConquistas:   Achievement[];
  missoesConcluidas: CompletedMissionInfo[];
}

/**
 * Busca todas as tarefas do usuário autenticado com filtros opcionais.
 */
export async function getTasks(params?: GetTasksParams): Promise<Task[]> {
  return callApi(async () => {
    const { data } = await api.get<{ tarefas: Task[] }>('/tasks', { params });
    return data.tarefas;
  }, 'Erro ao carregar suas tarefas.');
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
  return callApi(async () => {
    const { data } = await api.post<{ tarefa: Task }>('/tasks', input);
    return data.tarefa;
  }, 'Erro ao criar a tarefa.');
}

/**
 * Atualiza campos editáveis de uma tarefa.
 */
export async function updateTask(
  id:      string,
  updates: Partial<Pick<Task, 'title' | 'description' | 'difficulty' | 'priority' | 'estimatedMinutes' | 'status' | 'dueDate'>>,
): Promise<Task> {
  return callApi(async () => {
    const { data } = await api.patch<{ tarefa: Task }>(`/tasks/${id}`, updates);
    return data.tarefa;
  }, 'Erro ao salvar a tarefa.');
}

/**
 * Remove permanentemente uma tarefa.
 */
export async function deleteTask(id: string): Promise<void> {
  await callApi(() => api.delete(`/tasks/${id}`), 'Erro ao excluir a tarefa.');
}

/**
 * Conclui uma tarefa e retorna o resultado completo da gamificação.
 */
export async function completeTask(id: string): Promise<CompleteTaskResult> {
  return callApi(async () => {
    const { data } = await api.patch<CompleteTaskResult>(`/tasks/${id}/complete`);
    return data;
  }, 'Erro ao concluir a tarefa.');
}
