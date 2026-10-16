/**
 * Testes do tempo real da tela de grupo: quais tabelas/filtros são assinados,
 * o debounce de 500 ms e o cancelamento da assinatura ao sair da tela.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

type Handler = () => void;
interface Subscription { event: string; table: string; filter: string; handler: Handler }

const subscriptions: Subscription[] = [];
const removeChannel = vi.fn();

interface FakeChannel {
  on:        (type: string, opts: { event: string; table: string; filter: string }, handler: Handler) => FakeChannel;
  subscribe: () => FakeChannel;
}

vi.mock('../lib/supabase.js', () => {
  const channel: FakeChannel = {
    on: (_type, opts, handler) => {
      subscriptions.push({ event: opts.event, table: opts.table, filter: opts.filter, handler });
      return channel;
    },
    subscribe: () => channel,
  };
  return {
    supabase: {
      channel:       vi.fn(() => channel),
      removeChannel: (...args: unknown[]) => removeChannel(...args),
    },
  };
});

import { useGroupLiveUpdates, GROUP_LIVE_DEBOUNCE_MS } from '../lib/useGroupLiveUpdates';

function fire(table: string): void {
  subscriptions.find((s) => s.table === table)!.handler();
}

describe('useGroupLiveUpdates', () => {
  beforeEach(() => {
    subscriptions.length = 0;
    removeChannel.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('assina tarefas e missões do grupo, progresso das missões e perfis dos membros', () => {
    renderHook(() => useGroupLiveUpdates('g1', ['u1', 'u2'], ['m1'], vi.fn()));

    const tables = new Set(subscriptions.map((s) => `${s.table}|${s.filter}`));
    expect(tables).toEqual(new Set([
      'tasks|group_id=eq.g1',
      'missions|group_id=eq.g1',
      'mission_participants|mission_id=in.(m1)',
      'profiles|id=in.(u1,u2)',
    ]));
    // DELETE não passa por filtro/RLS no Realtime — não é assinado
    expect(subscriptions.some((s) => s.event === 'DELETE' || s.event === '*')).toBe(false);
  });

  it('agrupa vários eventos seguidos numa única recarga (debounce)', () => {
    const onChange = vi.fn();
    renderHook(() => useGroupLiveUpdates('g1', ['u1'], ['m1'], onChange));

    // Uma conclusão gera vários eventos: tarefa, perfil, progresso da missão
    fire('tasks');
    fire('profiles');
    fire('mission_participants');
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(GROUP_LIVE_DEBOUNCE_MS);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('cancela a assinatura e a recarga pendente ao sair da tela', () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useGroupLiveUpdates('g1', ['u1'], [], onChange));

    fire('tasks');
    unmount();
    vi.advanceTimersByTime(GROUP_LIVE_DEBOUNCE_MS);

    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('não assina mission_participants quando o grupo não tem missões', () => {
    renderHook(() => useGroupLiveUpdates('g1', ['u1'], [], vi.fn()));
    expect(subscriptions.some((s) => s.table === 'mission_participants')).toBe(false);
  });
});
