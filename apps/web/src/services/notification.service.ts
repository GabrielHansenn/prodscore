import type { Notification } from '@prodscore/shared';
import { api, callApi } from './api.js';

/** Lista paginada (mais recentes primeiro). `before` (ISO) pagina para trás. */
export async function getNotifications(before?: string): Promise<{ notifications: Notification[]; hasMore: boolean }> {
  return callApi(async () => {
    const { data } = await api.get<{ notificacoes: Notification[]; temMais: boolean }>(
      '/notifications',
      { params: before ? { before } : {} },
    );
    return { notifications: data.notificacoes, hasMore: data.temMais };
  }, 'Erro ao carregar notificações.');
}

/** Quantidade de não lidas — badge do sino. */
export async function getUnreadCount(): Promise<number> {
  return callApi(async () => {
    const { data } = await api.get<{ naoLidas: number }>('/notifications/unread-count');
    return data.naoLidas;
  }, 'Erro ao contar notificações.');
}

/** Marca uma notificação como lida. */
export async function markAsRead(id: string): Promise<void> {
  return callApi(async () => {
    await api.post(`/notifications/${id}/read`);
  }, 'Erro ao marcar notificação como lida.');
}

/** Marca todas as não lidas como lidas. */
export async function markAllAsRead(): Promise<void> {
  return callApi(async () => {
    await api.post('/notifications/read-all');
  }, 'Erro ao marcar notificações como lidas.');
}

/** Limpa o histórico de notificações. */
export async function clearNotifications(): Promise<void> {
  return callApi(async () => {
    await api.delete('/notifications');
  }, 'Erro ao limpar notificações.');
}
