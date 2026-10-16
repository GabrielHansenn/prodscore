/**
 * Testes do cálculo de estatísticas — foco na posição do ranking global, que
 * precisa ser a mesma da tabela do ranking (ranking_global_mv), e não só a
 * ordem por total_points.
 */

jest.mock('../lib/supabase');
jest.mock('../services/mission.service');

import { computeUserStats } from '../services/stats.service';
import { supabase } from '../lib/supabase';

const mockFrom = supabase.from as jest.Mock;

/** Cadeia Supabase genérica que resolve com `result` (await direto ou .maybeSingle()) */
function chain(result: unknown) {
  const c: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const method of ['select', 'eq', 'gte', 'gt']) c[method] = jest.fn(() => c);
  c['maybeSingle'] = jest.fn(() => Promise.resolve(result));
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const profile = {
  id: 'user-1', totalPoints: 500, level: 3, currentStreak: 4, longestStreak: 9, streakFreezes: 1,
};

/** Mocka as 8 consultas paralelas de computeUserStats, na ordem do Promise.all */
function setupStatsMocks(rankingRow: unknown) {
  const tables: string[] = [];
  mockFrom.mockImplementation((table: string) => {
    tables.push(table);
    if (table === 'ranking_global_mv')   return chain({ data: rankingRow, error: null });
    if (table === 'point_transactions')  return chain({ data: [], error: null });
    return chain({ count: 0, error: null });
  });
  return tables;
}

describe('computeUserStats — posição no ranking global', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReset();
  });

  it('usa a posição e a pontuação da tabela do ranking (ranking_global_mv)', async () => {
    const tables = setupStatsMocks({ position: 7, score: '262.40' });

    const stats = await computeUserStats(profile, { includeMissions: false });

    expect(stats.rankPosition).toBe(7);
    expect(stats.rankScore).toBe(262.4);
    expect(tables).toContain('ranking_global_mv');
    // Não conta mais "quem tem mais total_points" na tabela profiles
    expect(tables).not.toContain('profiles');
  });

  it('devolve posição 0 e pontuação null quando o usuário ainda não entrou no ranking', async () => {
    setupStatsMocks(null);

    const stats = await computeUserStats(profile, { includeMissions: false });

    expect(stats.rankPosition).toBe(0);
    expect(stats.rankScore).toBeNull();
  });
});
