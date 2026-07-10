import type {
  BehavioralProfile,
  TaskSuggestion,
  ProcrastinationAlert,
} from '@prodscore/shared';
import { api } from './api.js';

/** Busca o perfil comportamental do usuário autenticado (Mecânica 1) */
export async function getBehavioralProfile(): Promise<BehavioralProfile> {
  const { data } = await api.get<{ perfilComportamental: BehavioralProfile }>(
    '/users/me/behavioral-profile',
  );
  return data.perfilComportamental;
}

/** Busca sugestões de tarefas priorizadas por relevância (Mecânica 7) */
export async function getTaskSuggestions(): Promise<TaskSuggestion[]> {
  const { data } = await api.get<{ sugestoes: TaskSuggestion[] }>(
    '/users/me/task-suggestions',
  );
  return data.sugestoes;
}

/** Busca alertas de procrastinação ativos (Mecânica 10) */
export async function getProcrastinationAlerts(): Promise<ProcrastinationAlert[]> {
  const { data } = await api.get<{ alertas: ProcrastinationAlert[] }>(
    '/users/me/procrastination-alerts',
  );
  return data.alertas;
}
