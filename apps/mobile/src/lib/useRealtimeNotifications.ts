import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { subscribeNotifications } from './realtime';

/**
 * Mantém o sino em dia: busca o contador ao montar e assina INSERT/UPDATE em
 * `notifications` via Realtime. Reassina quando o access token renova.
 */
export function useRealtimeNotifications(): void {
  const userId      = useAuthStore((s) => s.user?.id);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { receive, upsert, fetchUnreadCount } = useNotificationStore((s) => ({
    receive:          s.receive,
    upsert:           s.upsert,
    fetchUnreadCount: s.fetchUnreadCount,
  }));

  useEffect(() => {
    if (!userId || !accessToken) return;

    void fetchUnreadCount();

    try {
      return subscribeNotifications(userId, accessToken, { onInsert: receive, onUpdate: upsert });
    } catch (err) {
      // Sem as env do Supabase o sino ainda funciona ao abrir a tela — só perde o tempo real
      console.warn('[useRealtimeNotifications] Realtime indisponível:', err);
      return undefined;
    }
  }, [userId, accessToken, receive, upsert, fetchUnreadCount]);
}
