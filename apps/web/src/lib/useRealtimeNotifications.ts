import { useEffect } from 'react';
import { NotificationType, type Notification } from '@prodscore/shared';
import { supabase } from './supabase.js';
import { useAuthStore } from '../store/authStore.js';
import { useNotificationStore } from '../store/notificationStore.js';

interface NotificationRow {
  id:         string;
  user_id:    string;
  type:       NotificationType;
  title:      string;
  body:       string | null;
  actor_id:   string | null;
  entity_id:  string | null;
  read_at:    string | null;
  created_at: string;
}

function mapRow(row: NotificationRow): Notification {
  return {
    id:        row.id,
    type:      row.type,
    title:     row.title,
    body:      row.body,
    actorId:   row.actor_id,
    entityId:  row.entity_id,
    readAt:    row.read_at,
    createdAt: row.created_at,
  };
}

/**
 * Mantém o sino em dia: busca o contador ao montar e assina INSERT/UPDATE em
 * `notifications` via Realtime.
 *
 * UPDATE também é assinado porque as notificações de chat são agrupadas — a
 * segunda mensagem do mesmo remetente atualiza a notificação existente
 * ("3 novas mensagens") em vez de inserir outra.
 *
 * A policy de SELECT (`auth.uid() = user_id`) é o que garante que cada
 * usuário só recebe os próprios eventos; o filtro abaixo é otimização.
 */
export function useRealtimeNotifications(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const { receive, upsert, fetchUnreadCount } = useNotificationStore((s) => ({
    receive:          s.receive,
    upsert:           s.upsert,
    fetchUnreadCount: s.fetchUnreadCount,
  }));

  useEffect(() => {
    if (!userId) return;

    void fetchUnreadCount();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => receive(mapRow(payload.new as NotificationRow)),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => upsert(mapRow(payload.new as NotificationRow)),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, receive, upsert, fetchUnreadCount]);
}
