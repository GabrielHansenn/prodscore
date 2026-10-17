/**
 * Testes de rota dos relatórios de desempenho:
 *   GET /users/me/stats/history  — relatório individual
 *   GET /groups/:id/stats        — métricas coletivas (só membros)
 *
 * Usa o report.service e o requireMembership de verdade; só o Supabase é
 * falso, respondendo por tabela (assim o 403 de quem não é membro é o mesmo
 * caminho que roda em produção).
 */

jest.mock('../lib/supabase', () => ({
  supabase:            { from: jest.fn() },
  verifySupabaseToken: jest.fn(),
}));
jest.mock('../services/mission.service');
jest.mock('../services/groupMessage.service');

import express from 'express';
import request from 'supertest';
import userRoutes from '../routes/users.routes';
import groupRoutes from '../routes/groups.routes';
import { supabase, verifySupabaseToken } from '../lib/supabase';

const mockFrom        = supabase.from as jest.Mock;
const mockVerifyToken = verifySupabaseToken as jest.Mock;

// ---------------------------------------------------------------------------
// Supabase falso
// ---------------------------------------------------------------------------

interface TableFixture {
  /** Linhas devolvidas por um SELECT comum (await direto) */
  rows?:   unknown[];
  /** Resultado de .maybeSingle() */
  single?: unknown;
  /** Contagens devolvidas por SELECT com head: true, na ordem em que são pedidas */
  counts?: number[];
}

/** Registro das consultas feitas: tabela + filtros eq, para checar o escopo */
const queries: Array<{ table: string; eq: Array<[string, unknown]> }> = [];

function fakeSupabase(fixtures: Record<string, TableFixture>) {
  const countCursor: Record<string, number> = {};
  mockFrom.mockImplementation((table: string) => {
    const fixture = fixtures[table] ?? {};
    const query = { table, eq: [] as Array<[string, unknown]> };
    queries.push(query);
    let head = false;

    const builder: Record<string, unknown> = {};
    for (const method of ['gte', 'lt', 'lte', 'in', 'not', 'order', 'limit']) builder[method] = () => builder;
    builder['select'] = (_cols: string, opts?: { head?: boolean }) => { head = opts?.head === true; return builder; };
    builder['eq'] = (column: string, value: unknown) => { query.eq.push([column, value]); return builder; };
    builder['maybeSingle'] = () => Promise.resolve({ data: fixture.single ?? null, error: null });
    builder['then'] = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      let result: unknown;
      if (head) {
        const i = countCursor[table] ?? 0;
        countCursor[table] = i + 1;
        result = { count: fixture.counts?.[i] ?? 0, error: null };
      } else {
        result = { data: fixture.rows ?? [], error: null };
      }
      return Promise.resolve(result).then(resolve, reject);
    };
    return builder;
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/users', userRoutes);
  app.use('/groups', groupRoutes);
  return app;
}

const app = buildApp();
const get = (path: string) => request(app).get(path).set('Authorization', 'Bearer token-valido');

beforeEach(() => {
  jest.clearAllMocks();
  queries.length = 0;
  mockVerifyToken.mockResolvedValue({ user: { id: 'user-1', totalPoints: 500 }, error: null });
});

// ---------------------------------------------------------------------------
// GET /users/me/stats/history
// ---------------------------------------------------------------------------

describe('GET /users/me/stats/history', () => {
  /** Semana de 09/06 (segunda) a 15/06/2025 — no passado, então "hoje" não interfere */
  const PERIOD = '?from=2025-06-09&to=2025-06-15';

  function setupHistory() {
    fakeSupabase({
      point_transactions: { rows: [
        { amount: 30, created_at: '2025-06-10T12:00:00+00:00' },
        { amount: 22, created_at: '2025-06-11T12:00:00+00:00' },
        { amount: -100, created_at: '2025-06-12T09:00:00+00:00' }, // compra de freeze: não conta como ganho
        { amount: 25, created_at: '2025-06-12T12:00:00+00:00' },
        { amount: 40, created_at: '2025-06-20T12:00:00+00:00' },   // depois do período
      ] },
      tasks: {
        rows: [
          { completed_at: '2025-06-01T12:00:00+00:00', due_date: null },                        // antes do período
          { completed_at: '2025-06-10T12:00:00+00:00', due_date: '2025-06-11T02:59:00+00:00' }, // no prazo
          { completed_at: '2025-06-11T12:00:00+00:00', due_date: '2025-06-11T02:59:00+00:00' }, // atrasada
          { completed_at: '2025-06-12T12:00:00+00:00', due_date: null },                        // sem prazo
          { completed_at: '2025-06-20T12:00:00+00:00', due_date: null },                        // depois
        ],
        counts: [4, 3], // criadas no período, criadas no período e já concluídas
      },
      streak_freeze_events: { rows: [] },
      weekly_goals: { rows: [
        { week_start: '2025-06-09', achieved_at: '2025-06-12T12:00:00+00:00' },
        { week_start: '2025-06-02', achieved_at: null },
      ] },
    });
  }

  it('devolve a série diária e os indicadores do período', async () => {
    setupHistory();

    const res = await get(`/users/me/stats/history${PERIOD}`);

    expect(res.status).toBe(200);
    const { relatorio } = res.body;
    expect(relatorio).toMatchObject({ from: '2025-06-09', to: '2025-06-15', granularity: 'day' });
    expect(relatorio.series).toHaveLength(7);
    expect(relatorio.summary).toEqual({
      tasksCompleted:      3,
      pointsEarned:        77,   // 30 + 22 + 25 (a compra negativa e a transação de 20/06 ficam de fora)
      tasksCreated:        4,
      completionRate:      75,
      tasksWithDueDate:    2,
      tasksOnTime:         1,
      punctualityRate:     50,
      weeklyGoalsTotal:    2,
      weeklyGoalsAchieved: 1,
    });
  });

  it('reconstrói saldo de pontos e sequência dia a dia', async () => {
    setupHistory();

    const { body } = await get(`/users/me/stats/history${PERIOD}`);
    const byDay = Object.fromEntries(body.relatorio.series.map((p: { date: string }) => [p.date, p]));

    // Saldo no fim do período = 500 atuais − 40 ganhos em 20/06
    expect(byDay['2025-06-15'].totalPoints).toBe(460);
    expect(byDay['2025-06-12'].tasksCompleted).toBe(1);
    // 10, 11 e 12/06 seguidos → sequência 3; 13/06 sem tarefa (e sem freeze) zera
    expect(byDay['2025-06-12'].streak).toBe(3);
    expect(byDay['2025-06-13'].streak).toBe(0);
  });

  it('agrupa por semana (segunda-feira) quando pedido', async () => {
    setupHistory();

    const res = await get('/users/me/stats/history?from=2025-06-04&to=2025-06-15&granularity=week');

    expect(res.status).toBe(200);
    expect(res.body.relatorio.series.map((p: { date: string }) => p.date)).toEqual(['2025-06-02', '2025-06-09']);
  });

  it('consulta só os dados do próprio usuário', async () => {
    setupHistory();

    await get(`/users/me/stats/history${PERIOD}`);

    for (const q of queries) {
      expect(q.eq).toContainEqual(['user_id', 'user-1']);
    }
  });

  it.each([
    ['data inicial depois da final',        '?from=2025-06-15&to=2025-06-09'],
    ['data que não existe',                 '?from=2025-02-30&to=2025-03-05'],
    ['formato errado',                      '?from=09/06/2025&to=2025-06-15'],
    ['período maior que 366 dias',          '?from=2023-01-01&to=2025-06-15'],
    ['granularidade desconhecida',          '?from=2025-06-09&to=2025-06-15&granularity=month'],
  ])('recusa período inválido (%s) com 400', async (_label, query) => {
    fakeSupabase({});

    const res = await get(`/users/me/stats/history${query}`);

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('PERIODO_INVALIDO');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('exige autenticação', async () => {
    const res = await request(app).get('/users/me/stats/history');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /groups/:id/stats
// ---------------------------------------------------------------------------

describe('GET /groups/:id/stats', () => {
  const PERIOD = '?from=2025-06-01&to=2025-06-30';

  it('nega acesso (403) a quem não é membro do grupo, sem consultar os dados', async () => {
    fakeSupabase({ group_members: { single: null } });

    const res = await get(`/groups/grupo-1/stats${PERIOD}`);

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('NAO_MEMBRO_DO_GRUPO');
    // Só a checagem de membro rodou — nenhuma tarefa, missão ou perfil foi lido
    expect(queries.map((q) => q.table)).toEqual(['group_members']);
  });

  it('devolve os indicadores do grupo e a contribuição por membro', async () => {
    fakeSupabase({
      group_members: {
        single: { role: 'member' },
        rows:   [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }],
      },
      profiles: { rows: [
        { id: 'u1', username: 'ana',    avatar_url: null },
        { id: 'u2', username: 'bruno',  avatar_url: null },
        { id: 'u3', username: 'carla',  avatar_url: null },
      ] },
      tasks: {
        rows: [
          { user_id: 'u1', points_earned: 10 },
          { user_id: 'u1', points_earned: 25 },
          { user_id: 'u2', points_earned: 50 },
        ],
        counts: [5, 3],
      },
      missions: { rows: [{ id: 'm1' }, { id: 'm2' }] },
      // Missão de grupo conclui para todos os membros: 2 linhas da mesma missão = 1 missão
      mission_participants: { rows: [{ mission_id: 'm1' }, { mission_id: 'm1' }] },
    });

    const res = await get(`/groups/grupo-1/stats${PERIOD}`);

    expect(res.status).toBe(200);
    expect(res.body.relatorio.summary).toEqual({
      tasksCompleted:    3,
      pointsEarned:      85,
      tasksCreated:      5,
      completionRate:    60,
      activeMembers:     2,
      totalMembers:      3,
      missionsCompleted: 1,
    });
    expect(res.body.relatorio.members.map((m: { username: string; pointsEarned: number }) =>
      [m.username, m.pointsEarned])).toEqual([['bruno', 50], ['ana', 35], ['carla', 0]]);
    // Tarefas filtradas pelo grupo pedido
    expect(queries.filter((q) => q.table === 'tasks').every((q) =>
      q.eq.some(([col, val]) => col === 'group_id' && val === 'grupo-1'))).toBe(true);
  });

  it('recusa período inválido com 400', async () => {
    fakeSupabase({ group_members: { single: { role: 'member' } } });

    const res = await get('/groups/grupo-1/stats?from=2025-06-30&to=2025-06-01');

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('PERIODO_INVALIDO');
  });
});
