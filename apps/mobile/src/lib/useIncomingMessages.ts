import { useEffect, useRef } from 'react';
import type { Message } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore';
import { subscribeIncomingMessages } from './realtime';

/**
 * Hook: assina as mensagens recebidas pelo usuário autenticado enquanto o
 * componente estiver montado. Reassina automaticamente se o access token
 * mudar (refresh de sessão). O handler é lido por ref — pode mudar a cada
 * render sem reabrir o canal.
 */
export function useIncomingMessages(onMessage: (message: Message) => void): void {
  const userId      = useAuthStore((s) => s.user?.id);
  const accessToken = useAuthStore((s) => s.accessToken);
  const handlerRef  = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!userId || !accessToken) return;
    try {
      return subscribeIncomingMessages(userId, accessToken, (m) => handlerRef.current(m));
    } catch (err) {
      // Sem env do Supabase o chat ainda funciona por recarga manual — só perde o tempo real
      console.warn('[useIncomingMessages] Realtime indisponível:', err);
      return undefined;
    }
  }, [userId, accessToken]);
}
