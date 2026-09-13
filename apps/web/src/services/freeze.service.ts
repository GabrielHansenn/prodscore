import type { FreezeState, StreakFreezeEvent } from '@prodscore/shared';
import { api, callApi } from './api.js';

/** Estado consolidado do freeze + histórico de ganho/uso. */
export async function getFreezeState(): Promise<{ state: FreezeState; history: StreakFreezeEvent[] }> {
  return callApi(async () => {
    const { data } = await api.get<{ estado: FreezeState; historico: StreakFreezeEvent[] }>('/users/me/streak/freeze');
    return { state: data.estado, history: data.historico };
  }, 'Erro ao carregar seus freezes.');
}

/** Arma um freeze — protege o streak a partir de agora. */
export async function armFreeze(): Promise<FreezeState> {
  return callApi(async () => {
    const { data } = await api.post<{ estado: FreezeState }>('/users/me/streak/freeze/arm');
    return data.estado;
  }, 'Erro ao armar o freeze.');
}

/** Desarma o freeze — o saldo não muda. */
export async function disarmFreeze(): Promise<FreezeState> {
  return callApi(async () => {
    const { data } = await api.post<{ estado: FreezeState }>('/users/me/streak/freeze/disarm');
    return data.estado;
  }, 'Erro ao desarmar o freeze.');
}

/** Compra 1 freeze com pontos. */
export async function buyFreeze(): Promise<void> {
  return callApi(async () => {
    await api.post('/users/me/streak/buy-freeze');
  }, 'Erro ao comprar o freeze.');
}
