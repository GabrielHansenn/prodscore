import type { Notification } from '@prodscore/shared';
import { api } from './api';

/** Lista paginada (mais recentes primeiro). `before` (ISO) pagina para trás. */
export async function getNotifications(before?: string): Promise<{ notifications: Notification[]; hasMore: boolean }> {
  const { data } = await api.get<{ notificacoes: Notification[]; temMais: boolean }>(
    '/notifications',
    { params: before ? { before } : {} },
  );
  return { notifications: data.notificacoes, hasMore: data.temMais };
}

/** Quantidade de não lidas — badge do sino. */
export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ naoLidas: number }>('/notifications/unread-count');
  return data.naoLidas;
}

/** Marca uma notificação como lida. */
export async function markAsRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

/** Marca todas as não lidas como lidas. */
export async function markAllAsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

/** Limpa o histórico de notificações. */
export async function clearNotifications(): Promise<void> {
  await api.delete('/notifications');
}
