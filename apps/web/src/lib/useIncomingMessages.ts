import { useEffect, useRef } from 'react';
import type { Message } from '@prodscore/shared';
import { supabase } from './supabase.js';

interface MessageRow {
  id:          string;
  sender_id:   string;
  receiver_id: string;
  content:     string;
  created_at:  string;
  read_at:     string | null;
}

function mapRow(row: MessageRow): Message {
  return {
    id:         row.id,
    senderId:   row.sender_id,
    receiverId: row.receiver_id,
    content:    row.content,
    createdAt:  row.created_at,
    readAt:     row.read_at,
  };
}

/**
 * Assina, via Supabase Realtime, as mensagens ENVIADAS PARA o usuário
 * autenticado (INSERT em public.messages com receiver_id = eu).
 *
 * O client web já está autenticado (supabase.auth), então o Realtime aplica a
 * policy de SELECT de messages — o assinante só recebe linhas das quais é
 * participante e enquanto for amigo do remetente. Mensagens que EU envio não
 * passam por aqui: a API devolve a mensagem criada e a tela a adiciona direto.
 *
 * O handler é lido por ref, então pode mudar a cada render sem reabrir o canal.
 */
export function useIncomingMessages(userId: string | undefined, onMessage: (message: Message) => void): void {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!userId) return;

    // Nome único por assinatura — duas telas podem assinar ao mesmo tempo
    const channel = supabase
      .channel(`messages:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        (payload) => handlerRef.current(mapRow(payload.new as MessageRow)),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
