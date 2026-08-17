/**
 * Testes do serviço de tarefas.
 * Foca no fluxo de conclusão (completeTask) que dispara o pipeline de gamificação.
 */

jest.mock('../lib/supabase');
jest.mock('../services/mission.service'); // fire-and-forget, não afeta o resultado

import { TaskDifficulty, TaskStatus } from '@prodscore/shared';
import { completeTask } from '../services/task.service';
import { supabase } from '../lib/supabase';
import { checkMissionProgress } from '../services/mission.service';

const mockFrom = supabase.from as jest.Mock;
const mockRpc  = supabase.rpc  as jest.Mock;

// ---------------------------------------------------------------------------
// Factories de mock
// ---------------------------------------------------------------------------

const NOW = new Date('2025-06-15T12:00:00.000Z');

function pendingTaskRow(overrides: Partial<{
  difficulty:     string;
  due_date:       string | null;
  status:         string;
  requires_proof: boolean;
}> = {}) {
  return {
    id:           'task-1',
    user_id:      'user-1',
    group_id:     null,
    title:        'Implementar feature X',
    description:  null,
    difficulty:   TaskDifficulty.Medium,
    status:       TaskStatus.Pending,
    due_date:     null,
    completed_at: null,
    points_earned: null,
    created_at:   '2025-06-10T10:00:00.000Z',
    updated_at:   '2025-06-10T10:00:00.000Z',
    requires_proof: false,
    ...overrides,
  };
}

function completedTaskRow(points: number) {
  return {
    ...pendingTaskRow(),
    status:       TaskStatus.Completed,
    completed_at: NOW.toISOString(),
    points_earned: points,
  };
}

/** Encadeia mocks suficientes para cobrir o pipeline completo de completeTask */
function setupCompleteMocks(options: {
  taskData:     object;
  pointsEarned: number;
  streak:       number;
  level:        number;
  totalPoints:  number;
}) {
  const { taskData, pointsEarned, streak, level, totalPoints } = options;

  const txData = {
    id: 'tx-1', user_id: 'user-1', amount: pointsEarned,
    reason: 'task_completed', reference_id: 'task-1',
    created_at: NOW.toISOString(),
  };

  const updatedTask = completedTaskRow(pointsEarned);

  mockRpc.mockResolvedValue({ error: null });

  mockFrom
    // Passo 1: busca tarefa original
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: taskData, error: null }),
          }),
        }),
      }),
    })
    // Passo 4: INSERT point_transactions
    .mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: txData, error: null }),
        }),
      }),
    })
    // Passo 5: UPDATE tasks (status = completed)
    .mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: updatedTask, error: null }),
          }),
        }),
      }),
    })
    // Passo 6a: SELECT perfil para updateStreak
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { current_streak: streak - 1, longest_streak: streak - 1, last_active_date: null },
            error: null,
          }),
        }),
      }),
    })
    // Passo 6b: UPDATE perfil (streak)
    .mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    })
    // Passo 7a: SELECT user_achievements (checkAchievements)
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })
    // Passo 7b: SELECT achievements não conquistadas
    .mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    })
    // Passo 8a: SELECT perfil para checkLevelUp
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { level, total_points: totalPoints },
            error: null,
          }),
        }),
      }),
    });
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('completeTask', () => {
  const userId = 'user-1';
  const taskId = 'task-1';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    // checkMissionProgress é fire-and-forget (chama .catch() direto no retorno) —
    // o auto-mock do módulo retorna undefined por padrão, o que quebra essa chamada.
    (checkMissionProgress as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve completar tarefa sem prazo e calcular 25 pontos (dificuldade média, sem modificador)', async () => {
    setupCompleteMocks({
      taskData:     pendingTaskRow({ due_date: null }),
      pointsEarned: 25,
      streak:       1,
      level:        1,
      totalPoints:  25,
    });

    const result = await completeTask(taskId, userId);

    expect(result.pointsEarned).toBe(25);
    expect(result.task.status).toBe(TaskStatus.Completed);
    expect(result.leveledUp).toBe(false);
    expect(result.newAchievements).toEqual([]);
  });

  it('deve aplicar bônus de pontualidade quando completed_at <= due_date', async () => {
    // Prazo é daqui a 1 hora — entregue no prazo → bônus +20%
    // floor(25 * 1.20) = 30 para dificuldade Medium
    const futureDate = new Date(NOW.getTime() + 3_600_000).toISOString();

    setupCompleteMocks({
      taskData:     pendingTaskRow({ due_date: futureDate }),
      pointsEarned: 30,
      streak:       1,
      level:        1,
      totalPoints:  30,
    });

    const result = await completeTask(taskId, userId);

    expect(result.pointsEarned).toBe(30);
  });

  it('deve aplicar penalidade de atraso quando completed_at > due_date', async () => {
    // Prazo foi há 1 hora — entregue com atraso → penalidade progressiva
    // (LATE_PENALTY_TIERS): ≤12h overdue = -10%. floor(25 * 0.90) = 22 para dificuldade Medium.
    const pastDate = new Date(NOW.getTime() - 3_600_000).toISOString();

    setupCompleteMocks({
      taskData:     pendingTaskRow({ due_date: pastDate }),
      pointsEarned: 22,
      streak:       1,
      level:        1,
      totalPoints:  22,
    });

    const result = await completeTask(taskId, userId);

    expect(result.pointsEarned).toBe(22);
  });

  it('deve lançar erro quando a tarefa não existe ou não pertence ao usuário', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    await expect(completeTask(taskId, userId)).rejects.toThrow('Tarefa não encontrada.');
  });

  it('deve lançar erro quando a tarefa já foi concluída', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: pendingTaskRow({ status: 'completed' }),
              error: null,
            }),
          }),
        }),
      }),
    });

    await expect(completeTask(taskId, userId)).rejects.toThrow('Esta tarefa já foi concluída.');
  });

  describe('requires_proof', () => {
    it('deve lançar erro quando a tarefa exige comprovação e nenhuma foi anexada', async () => {
      mockFrom
        // Passo 1: busca tarefa (requires_proof = true)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: pendingTaskRow({ requires_proof: true }),
                  error: null,
                }),
              }),
            }),
          }),
        })
        // Passo 1b: verifica task_proofs — nenhuma prova encontrada
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        });

      await expect(completeTask(taskId, userId)).rejects.toThrow(
        'Esta tarefa exige uma foto de comprovação antes de ser concluída.',
      );
    });

    it('deve concluir normalmente quando a tarefa exige comprovação e ela foi anexada', async () => {
      const pointsEarned = 25;
      const txData = {
        id: 'tx-1', user_id: userId, amount: pointsEarned,
        reason: 'task_completed', reference_id: taskId,
        created_at: NOW.toISOString(),
      };
      const updatedTask = completedTaskRow(pointsEarned);

      mockRpc.mockResolvedValue({ error: null });

      mockFrom
        // Passo 1: busca tarefa (requires_proof = true)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: pendingTaskRow({ requires_proof: true }),
                  error: null,
                }),
              }),
            }),
          }),
        })
        // Passo 1b: verifica task_proofs — prova encontrada
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'proof-1' }, error: null }),
            }),
          }),
        })
        // Passo 4: INSERT point_transactions
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: txData, error: null }),
            }),
          }),
        })
        // Passo 5: UPDATE tasks (status = completed)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: updatedTask, error: null }),
              }),
            }),
          }),
        })
        // Passo 6a: SELECT perfil para updateStreak
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { current_streak: 0, longest_streak: 0, last_active_date: null },
                error: null,
              }),
            }),
          }),
        })
        // Passo 6b: UPDATE perfil (streak)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Passo 7a: SELECT user_achievements (checkAchievements)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })
        // Passo 7b: SELECT achievements não conquistadas
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        })
        // Passo 8a: SELECT perfil para checkLevelUp
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { level: 1, total_points: pointsEarned },
                error: null,
              }),
            }),
          }),
        });

      const result = await completeTask(taskId, userId);

      expect(result.pointsEarned).toBe(25);
      expect(result.task.status).toBe(TaskStatus.Completed);
    });
  });
});
