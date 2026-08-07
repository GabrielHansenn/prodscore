import type { BehavioralProfile, TaskSuggestion } from '@prodscore/shared';
import { api } from './api';

/** Busca o perfil comportamental do usuário autenticado */
export async function getBehavioralProfile(): Promise<BehavioralProfile> {
  const { data } = await api.get<{ perfilComportamental: BehavioralProfile }>(
    '/users/me/behavioral-profile',
  );
  return data.perfilComportamental;
}

/** Busca sugestões de tarefas priorizadas por relevância */
export async function getTaskSuggestions(): Promise<TaskSuggestion[]> {
  const { data } = await api.get<{ sugestoes: TaskSuggestion[] }>(
    '/users/me/task-suggestions',
  );
  return data.sugestoes;
}
