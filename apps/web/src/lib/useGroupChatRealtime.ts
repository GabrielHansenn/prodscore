import { useEffect, useRef } from 'react';
import { supabase } from './supabase.js';

/**
 * Assina os INSERTs de `group_messages` do grupo informado.
 *
 * A policy de SELECT (`is_group_member`) é o que garante que só membros
 * recebem — o filtro por group_id abaixo é otimização de tráfego.
 *
 * O payload do Realtime traz a linha crua (sem o perfil do remetente e sem a
 * URL assinada da imagem), então o handler recebe apenas o id e a tela busca
 * a mensagem completa pela API — assim a imagem vem com URL válida e o
 * remetente com nome/avatar.
 */
export function useGroupChatRealtime(groupId: string | undefined, onNewMessage: (messageId: string) => void): void {
  const handlerRef = useRef(onNewMessage);
  handlerRef.current = onNewMessage;

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group_messages:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => handlerRef.current((payload.new as { id: string }).id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId]);
}
