import { useEffect, useRef } from 'react';
import { supabase } from './supabase.js';

/** Espera esse tempo sem novos eventos antes de recarregar (uma conclusão gera vários) */
export const GROUP_LIVE_DEBOUNCE_MS = 500;

/** Limite de valores do filtro `in` do Realtime */
const MAX_IN_FILTER_VALUES = 100;

function inFilter(column: string, ids: string[]): string {
  return `${column}=in.(${ids.slice(0, MAX_IN_FILTER_VALUES).join(',')})`;
}

/**
 * Atualização em tempo real da tela de detalhe do grupo (ranking e missões).
 *
 * Assina INSERT/UPDATE de:
 * - tasks do grupo (group_id)               → membro concluiu/criou tarefa do grupo
 * - missions do grupo (group_id)            → missão criada ou alterada
 * - mission_participants das missões do grupo (mission_id) → progresso coletivo
 * - profiles dos membros (id)               → pontos/sequência mudaram (inclusive
 *                                             por tarefa pessoal), o que mexe no ranking
 *
 * Como no chat, o payload é só um gatilho: depois de GROUP_LIVE_DEBOUNCE_MS sem
 * novos eventos, `onChange` recarrega os dados pela API. As policies de RLS
 * (ver migration 027) garantem que só membros do grupo recebem os eventos.
 *
 * A assinatura é refeita quando a lista de membros ou de missões muda e
 * encerrada ao sair da tela.
 */
export function useGroupLiveUpdates(
  groupId: string | undefined,
  memberIds: string[],
  missionIds: string[],
  onChange: () => void,
): void {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  // Chaves estáveis: o array muda de referência a cada render, o conteúdo não
  const membersKey  = [...memberIds].sort().join(',');
  const missionsKey = [...missionIds].sort().join(',');

  useEffect(() => {
    if (!groupId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        handlerRef.current();
      }, GROUP_LIVE_DEBOUNCE_MS);
    };

    const members  = membersKey  ? membersKey.split(',')  : [];
    const missions = missionsKey ? missionsKey.split(',') : [];

    let channel = supabase.channel(`group_live:${groupId}`);
    for (const event of ['INSERT', 'UPDATE'] as const) {
      channel = channel
        .on('postgres_changes', { event, schema: 'public', table: 'tasks',    filter: `group_id=eq.${groupId}` }, schedule)
        .on('postgres_changes', { event, schema: 'public', table: 'missions', filter: `group_id=eq.${groupId}` }, schedule);
      if (missions.length > 0) {
        channel = channel.on('postgres_changes', { event, schema: 'public', table: 'mission_participants', filter: inFilter('mission_id', missions) }, schedule);
      }
    }
    if (members.length > 0) {
      channel = channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: inFilter('id', members) }, schedule);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [groupId, membersKey, missionsKey]);
}
