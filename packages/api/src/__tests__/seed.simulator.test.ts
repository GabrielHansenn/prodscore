/**
 * O seed de demonstração reproduz, em memória e com datas passadas, regras
 * que no sistema rodam com a data de AGORA (updateStreak, checkLevelUp).
 * Estes testes rodam os serviços REAIS (sobre um banco falso em memória) e o
 * simulador lado a lado, dia a dia, e exigem o mesmo resultado — além de
 * conferir a coerência do histórico gerado (saldo = soma das transações).
 */

/** Banco falso em memória: só o que updateStreak/checkLevelUp/recordTransaction usam */
const mockDb: Record<string, Array<Record<string, unknown>>> = {};

jest.mock('../lib/supabase', () => {
  const from = (table: string) => {
    let op: 'select' | 'update' | 'insert' = 'select';
    let patch: Record<string, unknown> = {};
    let row: Record<string, unknown> = {};
    const filters: Array<[string, unknown]> = [];
    const exec = () => {
      const rows = (mockDb[table] ??= []);
      if (op === 'insert') {
        const inserted = { id: `row-${rows.length}`, created_at: new Date().toISOString(), ...row };
        rows.push(inserted);
        return { data: inserted, error: null };
      }
      const match = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      if (op === 'update') { match.forEach((r) => Object.assign(r, patch)); return { data: null, error: null }; }
      return { data: match[0] ?? null, error: null };
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      update: (p: Record<string, unknown>) => { op = 'update'; patch = p; return builder; },
      insert: (r: Record<string, unknown>) => { op = 'insert'; row = r; return builder; },
      eq: (c: string, v: unknown) => { filters.push([c, v]); return builder; },
      single: () => Promise.resolve(exec()),
      maybeSingle: () => Promise.resolve(exec()),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(exec()).then(res, rej),
    };
    return builder;
  };
  return {
    supabase: {
      from,
      rpc: (_fn: string, args: { p_user_id: string; p_amount: number }) => {
        const profile = (mockDb['profiles'] ?? []).find((p) => p['id'] === args.p_user_id);
        if (profile) profile['total_points'] = Math.max(0, (profile['total_points'] as number) + args.p_amount);
        return Promise.resolve({ error: null });
      },
    },
  };
});
jest.mock('../services/notification.service');

import { updateStreak, checkLevelUp } from '../services/gamification.service';
import { applyStreakUpdate, levelForPoints, simulate, type StreakState, DAY, HOUR } from '../seed/simulator';
import { PEOPLE } from '../seed/catalog';

const USER = 'user-1';

function resetDb(profile: Partial<StreakState> & { total_points?: number; level?: number } = {}) {
  for (const key of Object.keys(mockDb)) delete mockDb[key];
  mockDb['profiles'] = [{
    id: USER, current_streak: 0, longest_streak: 0, last_active_date: null, streak_freezes: 0,
    freeze_armed_at: null, freeze_streak_credited: 0, total_points: 0, level: 1, ...profile,
  }];
  mockDb['level_rewards'] = [
    { level: 5, bonus_points: 50, bonus_freezes: 1, badge_key: 'rocket', description: '' },
    { level: 10, bonus_points: 100, bonus_freezes: 2, badge_key: 'star', description: '' },
  ];
}

const profile = () => mockDb['profiles']![0]!;
const streakFields = (s: Record<string, unknown>) => ({
  current_streak: s['current_streak'], longest_streak: s['longest_streak'], last_active_date: s['last_active_date'],
  streak_freezes: s['streak_freezes'], freeze_armed_at: s['freeze_armed_at'], freeze_streak_credited: s['freeze_streak_credited'],
});

afterEach(() => jest.useRealTimers());

describe('simulador × updateStreak real', () => {
  /**
   * Roteiro: dias com atividade (offset em dias a partir de 01/03/2026) e
   * dias em que o usuário "arma" um freeze antes de uma pausa.
   */
  const scenarios: Array<{ name: string; days: number[]; arm?: number[] }> = [
    { name: 'sequência longa: marcos de 3, 7 e 14 dias e freezes a cada 7', days: Array.from({ length: 16 }, (_, i) => i) },
    { name: 'quebra sem freeze armado zera a sequência', days: [0, 1, 2, 3, 6, 7] },
    { name: 'freeze armado a tempo cobre os dias perdidos', days: [...Array.from({ length: 8 }, (_, i) => i), 10, 11], arm: [7] },
    { name: 'freezes insuficientes para a pausa: zera', days: [...Array.from({ length: 8 }, (_, i) => i), 13], arm: [7] },
    { name: 'mesma data duas vezes não conta de novo', days: [0, 0, 1, 1, 2] },
  ];

  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      resetDb();
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      const sim: StreakState = {
        current_streak: 0, longest_streak: 0, last_active_date: null,
        streak_freezes: 0, freeze_armed_at: null, freeze_streak_credited: 0,
      };
      const base = Date.parse('2026-03-01T15:00:00.000Z');
      const simEvents: Array<[unknown, unknown]> = [];

      for (const day of scenario.days) {
        const at = base + day * DAY;
        if (scenario.arm?.includes(day - 1) && sim.streak_freezes > 0 && !sim.freeze_armed_at) {
          // armado na noite do último dia ativo antes da pausa (como o seed faz)
          const armedAt = new Date(base + (day - 1) * DAY + 8 * HOUR).toISOString();
          sim.freeze_armed_at = armedAt;
          profile()['freeze_armed_at'] = armedAt;
        }
        jest.setSystemTime(at);
        const real = await updateStreak(USER);
        const simulated = applyStreakUpdate(sim, at);
        simulated.events.forEach((e) => simEvents.push([e.type, e.balance_after]));

        expect(streakFields(sim as unknown as Record<string, unknown>)).toEqual(streakFields(profile()));
        expect(simulated.milestoneReached).toBe(real.milestoneReached);
      }
      // Os eventos de freeze gravados pelo serviço são exatamente os que o simulador gera, na mesma ordem
      expect((mockDb['streak_freeze_events'] ?? []).map((e) => [e['type'], e['balance_after']])).toEqual(simEvents);
    });
  }

  it('ao armar antes da pausa, o arme nunca é aplicado sem freeze disponível', () => {
    const sim: StreakState = { current_streak: 2, longest_streak: 2, last_active_date: '2026-03-02', streak_freezes: 0, freeze_armed_at: null, freeze_streak_credited: 0 };
    applyStreakUpdate(sim, Date.parse('2026-03-05T12:00:00.000Z'));
    expect(sim.current_streak).toBe(1);
  });
});

describe('simulador × checkLevelUp real', () => {
  it.each([0, 399, 400, 2499, 2500, 9999, 10000, 14400, 20000])('nível com %i pontos é o mesmo', async (points) => {
    resetDb({ total_points: points, level: 1 });
    const real = await checkLevelUp(USER);
    expect(levelForPoints(points)).toBe(real.newLevel);
  });
});

describe('simulate — coerência do histórico gerado', () => {
  const now = Date.parse('2026-10-17T18:00:00.000Z');
  const people = PEOPLE.slice(0, 8).map((p, i) => ({ ...p, id: `u${i}` }));
  const result = simulate({
    now, seed: 42, people, groups: [], preservedUserId: 'me', levelRewards: [{ level: 5, bonus_points: 50, bonus_freezes: 1 }],
    achievements: [
      { id: 'a1', name: 'Primeira tarefa', reward_points: 10, criteria: { type: 'tasks_completed', threshold: 1 } },
      { id: 'a2', name: 'Uma semana', reward_points: 50, criteria: { type: 'streak', threshold: 7 } },
    ],
  });

  it('saldo final de cada pessoa = soma das transações', () => {
    for (const p of result.profiles) {
      const sum = result.transactions.filter((t) => t.user_id === p.id).reduce((s, t) => s + t.amount, 0);
      expect(p.total_points).toBe(sum);
    }
  });

  it('pontos da tarefa concluída = transação task_completed da mesma tarefa', () => {
    const byTask = new Map(result.transactions.filter((t) => t.reason === 'task_completed').map((t) => [t.reference_id, t.amount]));
    for (const task of result.tasks.filter((t) => t.status === 'completed')) {
      expect(byTask.get(task.id)).toBe(task.points_earned);
    }
  });

  it('nível nunca passa do que os pontos permitem e o recorde de sequência ≥ sequência atual', () => {
    for (const p of result.profiles) {
      expect(p.level).toBeLessThanOrEqual(levelForPoints(p.total_points));
      expect(p.longest_streak).toBeGreaterThanOrEqual(p.current_streak);
    }
  });

  it('nada no futuro e tarefa concluída sempre depois de criada', () => {
    for (const t of result.tasks) {
      expect(Date.parse(t.created_at)).toBeLessThanOrEqual(now);
      if (t.completed_at) expect(Date.parse(t.completed_at)).toBeGreaterThanOrEqual(Date.parse(t.created_at));
    }
    for (const t of result.transactions) expect(Date.parse(t.created_at)).toBeLessThanOrEqual(now + 1000);
  });

  it('gera todos os status de tarefa', () => {
    const statuses = new Set(result.tasks.map((t) => t.status));
    expect([...statuses].sort()).toEqual(['abandoned', 'completed', 'in_progress', 'overdue', 'pending']);
  });

  it('é determinístico: mesma semente, mesmos dados', () => {
    const again = simulate({
      now, seed: 42, people, groups: [], preservedUserId: 'me', levelRewards: [{ level: 5, bonus_points: 50, bonus_freezes: 1 }],
      achievements: [
        { id: 'a1', name: 'Primeira tarefa', reward_points: 10, criteria: { type: 'tasks_completed', threshold: 1 } },
        { id: 'a2', name: 'Uma semana', reward_points: 50, criteria: { type: 'streak', threshold: 7 } },
      ],
    });
    expect(again.profiles).toEqual(result.profiles);
    expect(again.tasks.map((t) => t.title)).toEqual(result.tasks.map((t) => t.title));
  });
});
