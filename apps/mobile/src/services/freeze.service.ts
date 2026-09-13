import type { FreezeState, StreakFreezeEvent } from '@prodscore/shared';
import { api } from './api';

/** Estado consolidado do freeze + histórico de ganho/uso. */
export async function getFreezeState(): Promise<{ state: FreezeState; history: StreakFreezeEvent[] }> {
  const { data } = await api.get<{ estado: FreezeState; historico: StreakFreezeEvent[] }>('/users/me/streak/freeze');
  return { state: data.estado, history: data.historico };
}

/** Arma um freeze — protege o streak a partir de agora. */
export async function armFreeze(): Promise<FreezeState> {
  const { data } = await api.post<{ estado: FreezeState }>('/users/me/streak/freeze/arm');
  return data.estado;
}

/** Desarma o freeze — o saldo não muda. */
export async function disarmFreeze(): Promise<FreezeState> {
  const { data } = await api.post<{ estado: FreezeState }>('/users/me/streak/freeze/disarm');
  return data.estado;
}

/** Compra 1 freeze com pontos. */
export async function buyFreeze(): Promise<void> {
  await api.post('/users/me/streak/buy-freeze');
}
