/**
 * Testes unitários da gamificação adaptativa (meta semanal e bônus de retomada).
 * Funções puras são testadas sem mock; funções com I/O mockam o cliente Supabase.
 */

// Mock do cliente Supabase — deve ser chamado antes de qualquer import dos serviços
jest.mock('../lib/supabase');
// Crédito de pontos, notificações e perfil comportamental são dependências — verificamos só as chamadas
jest.mock('../services/gamification.service');
jest.mock('../services/notification.service');
jest.mock('../services/behavioral.service');

import { NotificationType, PointReason, WeeklyGoalReason } from '@prodscore/shared';
import {
  calculateWeeklyGoal,
  countCompleteWeeks,
  isComebackEligible,
  calculateComebackBonus,
  getOrCreateWeeklyGoal,
  checkWeeklyGoal,
  checkComebackBonus,
  type WeeklyGoalInput,
} from '../services/adaptive.service';
import { supabase } from '../lib/supabase';
import { recordTransaction } from '../services/gamification.service';
import { createNotification } from '../services/notification.service';
import { computeBehavioralProfile } from '../services/behavioral.service';

const mockFrom = supabase.from as jest.Mock;

const DAY_MS = 86_400_000;
/** Quarta-feira — a semana atual começa na segunda 2025-06-16 00:00 UTC */
const NOW = new Date('2025-06-18T15:00:00.000Z');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cadeia Supabase genérica: qualquer método encadeável devolve a própria
 * cadeia e, ao final, a query resolve com `result` (seja via await direto,
 * .single() ou .maybeSingle()).
 */
function chain(result: unknown) {
  const c: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const method of ['select', 'eq', 'in', 'is', 'gte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']) {
    c[method] = jest.fn(() => c);
  }
  c['single']      = jest.fn(() => Promise.resolve(result));
  c['maybeSingle'] = jest.fn(() => Promise.resolve(result));
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

/** Entrada do cálculo com valores neutros (4 semanas de histórico, sem metas anteriores, sem tags) */
function goalInput(overrides: Partial<WeeklyGoalInput> = {}): WeeklyGoalInput {
  return {
    completeWeeks: 10,
    weeklyCounts:  [10, 10, 10, 10],
    previousGoals: [null, null],
    tags:          [],
    ...overrides,
  };
}

function goalRow(overrides: Partial<{
  target: number; reward_points: number; achieved_at: string | null;
}> = {}) {
  return {
    id:            'goal-1',
    user_id:       'user-1',
    week_start:    '2025-06-16',
    target:        5,
    base_average:  '4.00',
    factor:        '1.15',
    reason:        'default',
    reward_points: 50,
    achieved_at:   null,
    created_at:    '2025-06-16T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReset();
});

// ---------------------------------------------------------------------------
// calculateWeeklyGoal — função pura, sem mock
// ---------------------------------------------------------------------------

describe('calculateWeeklyGoal', () => {
  describe('histórico curto', () => {
    it.each([0, 1])('com %i semana(s) completa(s) de conta usa a meta padrão de 3', (completeWeeks) => {
      const goal = calculateWeeklyGoal(goalInput({ completeWeeks, weeklyCounts: [20] }));
      expect(goal).toEqual({
        target: 3, baseAverage: 0, factor: 1, reason: WeeklyGoalReason.NewUser, rewardPoints: 30,
      });
    });

    it('com 2 semanas completas já calcula pela média dessas 2 semanas', () => {
      // média (4 + 6) / 2 = 5 → 5 × 1,15 = 5,75 → 6
      const goal = calculateWeeklyGoal(goalInput({ completeWeeks: 2, weeklyCounts: [4, 6] }));
      expect(goal.baseAverage).toBe(5);
      expect(goal.target).toBe(6);
      expect(goal.reason).toBe(WeeklyGoalReason.Default);
    });

    it('com 3 semanas completas divide por 3, não por 4', () => {
      const goal = calculateWeeklyGoal(goalInput({ completeWeeks: 3, weeklyCounts: [6, 6, 6] }));
      expect(goal.baseAverage).toBe(6);
    });
  });

  describe('média', () => {
    it('usa a média das últimas 4 semanas completas', () => {
      // (10 + 12 + 8 + 10) / 4 = 10 → 10 × 1,15 = 11,5 → 12
      const goal = calculateWeeklyGoal(goalInput({ weeklyCounts: [10, 12, 8, 10] }));
      expect(goal.baseAverage).toBe(10);
      expect(goal.target).toBe(12);
      expect(goal.rewardPoints).toBe(120);
    });

    it('ignora semanas além das 4 mais recentes', () => {
      const goal = calculateWeeklyGoal(goalInput({ weeklyCounts: [10, 10, 10, 10, 100] }));
      expect(goal.baseAverage).toBe(10);
    });

    it('semana sem nenhuma tarefa entra na média como 0', () => {
      // (8 + 0 + 8 + 0) / 4 = 4 → 4,6 → 5
      const goal = calculateWeeklyGoal(goalInput({ weeklyCounts: [8, 0, 8, 0] }));
      expect(goal.baseAverage).toBe(4);
      expect(goal.target).toBe(5);
    });

    it('arredonda para cima', () => {
      // (10 + 10 + 11 + 10) / 4 = 10,25 → 11,7875 → 12
      expect(calculateWeeklyGoal(goalInput({ weeklyCounts: [10, 10, 11, 10] })).target).toBe(12);
    });

    it('não sobe uma unidade por erro de ponto flutuante (20 × 1,15 = 23, não 24)', () => {
      expect(calculateWeeklyGoal(goalInput({ weeklyCounts: [20, 20, 20, 20] })).target).toBe(23);
    });

    it('nunca fica abaixo do mínimo de 3', () => {
      // média 1 → 1,15 → 2 → mínimo 3
      const goal = calculateWeeklyGoal(goalInput({ weeklyCounts: [1, 1, 1, 1] }));
      expect(goal.target).toBe(3);
      expect(goal.rewardPoints).toBe(30);
    });
  });

  describe('fator', () => {
    it('padrão 1,15 quando não há metas anteriores registradas', () => {
      const goal = calculateWeeklyGoal(goalInput());
      expect(goal.factor).toBe(1.15);
      expect(goal.reason).toBe(WeeklyGoalReason.Default);
    });

    it('sobe para 1,25 quando bateu as 2 últimas metas', () => {
      // 10 × 1,25 = 12,5 → 13
      const goal = calculateWeeklyGoal(goalInput({ previousGoals: [{ achieved: true }, { achieved: true }] }));
      expect(goal.factor).toBe(1.25);
      expect(goal.reason).toBe(WeeklyGoalReason.Challenge);
      expect(goal.target).toBe(13);
    });

    it('fica no padrão quando bateu só a última (a retrasada não foi batida)', () => {
      const goal = calculateWeeklyGoal(goalInput({ previousGoals: [{ achieved: true }, { achieved: false }] }));
      expect(goal.factor).toBe(1.15);
    });

    it('fica no padrão quando bateu a última mas a retrasada não tem meta registrada', () => {
      const goal = calculateWeeklyGoal(goalInput({ previousGoals: [{ achieved: true }, null] }));
      expect(goal.factor).toBe(1.15);
    });

    it('cai para 1,0 quando não bateu a meta da semana anterior', () => {
      const goal = calculateWeeklyGoal(goalInput({ previousGoals: [{ achieved: false }, { achieved: true }] }));
      expect(goal.factor).toBe(1);
      expect(goal.reason).toBe(WeeklyGoalReason.Recovery);
      expect(goal.target).toBe(10);
    });

    it('semana anterior sem meta registrada é neutra (não conta como meta perdida)', () => {
      const goal = calculateWeeklyGoal(goalInput({ previousGoals: [null, { achieved: false }] }));
      expect(goal.reason).toBe(WeeklyGoalReason.Default);
    });
  });

  describe('tags do perfil comportamental', () => {
    it('"procrastinador" limita o fator padrão a 1,05', () => {
      // 10 × 1,05 = 10,5 → 11
      const goal = calculateWeeklyGoal(goalInput({ tags: ['procrastinador'] }));
      expect(goal.factor).toBe(1.05);
      expect(goal.reason).toBe(WeeklyGoalReason.Capped);
      expect(goal.target).toBe(11);
    });

    it('"iniciante" limita até o fator de desafio a 1,05', () => {
      const goal = calculateWeeklyGoal(goalInput({
        tags:          ['iniciante'],
        previousGoals: [{ achieved: true }, { achieved: true }],
      }));
      expect(goal.factor).toBe(1.05);
      expect(goal.reason).toBe(WeeklyGoalReason.Capped);
    });

    it('não aumenta o fator de recuperação (1,0 já está abaixo do teto)', () => {
      const goal = calculateWeeklyGoal(goalInput({
        tags:          ['procrastinador'],
        previousGoals: [{ achieved: false }, null],
      }));
      expect(goal.factor).toBe(1);
      expect(goal.reason).toBe(WeeklyGoalReason.Recovery);
    });

    it('outras tags não mexem no fator', () => {
      const goal = calculateWeeklyGoal(goalInput({ tags: ['consistente', 'intenso', 'metódico'] }));
      expect(goal.factor).toBe(1.15);
    });
  });
});

// ---------------------------------------------------------------------------
// countCompleteWeeks — função pura
// ---------------------------------------------------------------------------

describe('countCompleteWeeks', () => {
  const currentWeek = new Date('2025-06-16T00:00:00.000Z');

  it('a semana em que a conta foi criada (no meio dela) não conta', () => {
    // Criada na quarta 04/06: só a semana de 09/06 está completa
    expect(countCompleteWeeks(new Date('2025-06-04T10:00:00.000Z'), currentWeek)).toBe(1);
  });

  it('conta criada exatamente na segunda 00:00 UTC conta aquela semana', () => {
    expect(countCompleteWeeks(new Date('2025-06-02T00:00:00.000Z'), currentWeek)).toBe(2);
  });

  it('conta criada nesta semana tem 0 semanas completas', () => {
    expect(countCompleteWeeks(new Date('2025-06-17T09:00:00.000Z'), currentWeek)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bônus de retomada — regras puras
// ---------------------------------------------------------------------------

describe('isComebackEligible', () => {
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

  it('a primeira tarefa da vida não é retomada', () => {
    expect(isComebackEligible(null, null, NOW)).toBe(false);
  });

  it('menos de 3 dias parado não dá bônus', () => {
    expect(isComebackEligible(new Date(NOW.getTime() - 3 * DAY_MS + 60_000), null, NOW)).toBe(false);
  });

  it('exatamente 3 dias parado dá bônus', () => {
    expect(isComebackEligible(daysAgo(3), null, NOW)).toBe(true);
  });

  it('regra de 7 dias: bônus recebido há 6 dias bloqueia um novo', () => {
    expect(isComebackEligible(daysAgo(5), daysAgo(6), NOW)).toBe(false);
  });

  it('regra de 7 dias: bônus recebido há 7 dias libera um novo', () => {
    expect(isComebackEligible(daysAgo(5), daysAgo(7), NOW)).toBe(true);
  });
});

describe('calculateComebackBonus', () => {
  it('concede +50% dos pontos da tarefa, arredondado para baixo', () => {
    expect(calculateComebackBonus(25)).toBe(12);
    expect(calculateComebackBonus(100)).toBe(50);
  });

  it('concede no mínimo 1 ponto', () => {
    expect(calculateComebackBonus(1)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// checkComebackBonus — com I/O
// ---------------------------------------------------------------------------

describe('checkComebackBonus', () => {
  it('não consulta o banco nem credita quando o usuário não ficou 3 dias parado', async () => {
    const result = await checkComebackBonus('user-1', 'task-1', 25, new Date(NOW.getTime() - DAY_MS), NOW);

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(recordTransaction).not.toHaveBeenCalled();
  });

  it('regra de 7 dias: não credita quando já recebeu o bônus há menos de 7 dias', async () => {
    mockFrom.mockReturnValueOnce(chain({
      data:  { created_at: new Date(NOW.getTime() - 3 * DAY_MS).toISOString() },
      error: null,
    }));

    const result = await checkComebackBonus('user-1', 'task-1', 25, new Date(NOW.getTime() - 4 * DAY_MS), NOW);

    expect(result).toBeNull();
    expect(recordTransaction).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('credita +50% como transação ComebackBonus separada e notifica "Bem-vindo de volta"', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })); // nunca recebeu o bônus

    const result = await checkComebackBonus('user-1', 'task-1', 25, new Date(NOW.getTime() - 4 * DAY_MS), NOW);

    expect(result).toEqual({ bonusPoints: 12, daysInactive: 4 });
    expect(recordTransaction).toHaveBeenCalledTimes(1);
    expect(recordTransaction).toHaveBeenCalledWith('user-1', 12, PointReason.ComebackBonus, 'task-1');
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      type:   NotificationType.Comeback,
      title:  'Bem-vindo de volta!',
    }));
  });
});

// ---------------------------------------------------------------------------
// getOrCreateWeeklyGoal — cálculo preguiçoso
// ---------------------------------------------------------------------------

describe('getOrCreateWeeklyGoal', () => {
  it('devolve a meta já gravada sem recalcular', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: goalRow({ target: 7 }), error: null }));

    const goal = await getOrCreateWeeklyGoal('user-1', NOW);

    expect(goal.target).toBe(7);
    expect(goal.baseAverage).toBe(4);   // NUMERIC chega como string e é convertido
    expect(goal.factor).toBe(1.15);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(computeBehavioralProfile).not.toHaveBeenCalled();
  });

  it('na primeira consulta da semana calcula a partir do histórico e grava', async () => {
    (computeBehavioralProfile as jest.Mock).mockResolvedValue({ tags: [] });

    // 10 tarefas em cada uma das 4 semanas anteriores (09/06, 02/06, 26/05, 19/05)
    const completions = ['2025-06-09', '2025-06-02', '2025-05-26', '2025-05-19'].flatMap((monday) =>
      Array.from({ length: 10 }, () => ({ completed_at: `${monday}T12:00:00.000Z` })));

    const upsertChain = chain({ error: null });

    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null }))                                    // meta da semana: não existe
      .mockReturnValueOnce(chain({ data: { created_at: '2025-01-01T00:00:00.000Z' }, error: null })) // perfil
      .mockReturnValueOnce(chain({ data: completions, error: null }))                               // tarefas das 4 semanas
      .mockReturnValueOnce(chain({                                                                  // metas anteriores: ambas batidas
        data: [
          { week_start: '2025-06-09', achieved_at: '2025-06-13T10:00:00.000Z' },
          { week_start: '2025-06-02', achieved_at: '2025-06-05T10:00:00.000Z' },
        ],
        error: null,
      }))
      .mockReturnValueOnce(upsertChain)                                                             // upsert
      .mockReturnValueOnce(chain({ data: goalRow({ target: 13 }), error: null }));                  // releitura

    const goal = await getOrCreateWeeklyGoal('user-1', NOW);

    // média 10 × 1,25 (bateu as 2 últimas) = 12,5 → 13
    expect(upsertChain['upsert']).toHaveBeenCalledWith(
      {
        user_id:       'user-1',
        week_start:    '2025-06-16',
        target:        13,
        base_average:  10,
        factor:        1.25,
        reason:        WeeklyGoalReason.Challenge,
        reward_points: 130,
      },
      { onConflict: 'user_id,week_start', ignoreDuplicates: true },
    );
    expect(goal.target).toBe(13);
  });

  it('conta nova recebe a meta padrão sem consultar tarefas nem perfil comportamental', async () => {
    const upsertChain = chain({ error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: { created_at: '2025-06-10T00:00:00.000Z' }, error: null }))
      .mockReturnValueOnce(upsertChain)
      .mockReturnValueOnce(chain({ data: goalRow({ target: 3 }), error: null }));

    await getOrCreateWeeklyGoal('user-1', NOW);

    expect(upsertChain['upsert']).toHaveBeenCalledWith(
      expect.objectContaining({ target: 3, reason: WeeklyGoalReason.NewUser, reward_points: 30 }),
      expect.anything(),
    );
    expect(computeBehavioralProfile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// checkWeeklyGoal — idempotência do bônus
// ---------------------------------------------------------------------------

describe('checkWeeklyGoal', () => {
  it('não faz nada se a meta da semana já foi batida', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: goalRow({ achieved_at: '2025-06-17T10:00:00.000Z' }), error: null }));

    const result = await checkWeeklyGoal('user-1', NOW);

    expect(result).toBeNull();
    expect(recordTransaction).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledTimes(1); // nem conta as tarefas
  });

  it('não credita enquanto as tarefas concluídas não atingem a meta', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: goalRow({ target: 5 }), error: null }))
      .mockReturnValueOnce(chain({ count: 4, error: null }));

    const result = await checkWeeklyGoal('user-1', NOW);

    expect(result).toBeNull();
    expect(recordTransaction).not.toHaveBeenCalled();
  });

  it('ao bater a meta marca achieved_at só se ainda estava vazio e credita WeeklyGoalReward uma vez', async () => {
    const claimChain = chain({ data: [{ id: 'goal-1' }], error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: goalRow({ target: 5, reward_points: 50 }), error: null }))
      .mockReturnValueOnce(chain({ count: 5, error: null }))
      .mockReturnValueOnce(claimChain);

    const result = await checkWeeklyGoal('user-1', NOW);

    expect(result).toEqual({ target: 5, rewardPoints: 50 });
    expect(claimChain['update']).toHaveBeenCalledWith({ achieved_at: NOW.toISOString() });
    expect(claimChain['is']).toHaveBeenCalledWith('achieved_at', null);
    expect(recordTransaction).toHaveBeenCalledTimes(1);
    expect(recordTransaction).toHaveBeenCalledWith('user-1', 50, PointReason.WeeklyGoalReward, 'goal-1');
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: NotificationType.WeeklyGoal }));
  });

  it('não credita de novo se outra requisição marcou a meta primeiro (UPDATE não afetou linha)', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: goalRow({ target: 5 }), error: null }))
      .mockReturnValueOnce(chain({ count: 6, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));

    const result = await checkWeeklyGoal('user-1', NOW);

    expect(result).toBeNull();
    expect(recordTransaction).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });
});
