/**
 * Testes do serviço de tarefas.
 * Foca no fluxo de conclusão (completeTask) que dispara o pipeline de gamificação
 * e na regra de criação de tarefas em grupo (createTask).
 */

jest.mock('../lib/supabase');
jest.mock('../services/mission.service'); // aguardado no completeTask — mock simula "nenhuma missão concluída"

import { TaskDifficulty, TaskStatus } from '@prodscore/shared';
import { completeTask, createTask } from '../services/task.service';
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
    // checkMissionProgress é aguardado e seu retorno é lido (missões concluídas e
    // conquistas destravadas) — o auto-mock retorna undefined por padrão, então
    // simulamos o caso neutro: nenhuma missão concluída, nenhuma conquista.
    (checkMissionProgress as jest.Mock).mockResolvedValue({
      completedMissions:    [],
      unlockedAchievements: [],
    });
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

// ---------------------------------------------------------------------------
// createTask — tarefas em grupo
// ---------------------------------------------------------------------------

describe('createTask', () => {
  /** Mock da consulta de participação em group_members */
  function membershipQuery(membership: { user_id: string } | null) {
    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: membership, error: null }),
          }),
        }),
      }),
    };
  }

  /** Mock do INSERT em tasks */
  function insertTaskQuery(row: object) {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: row, error: null }),
      }),
    });
    return { query: { insert }, insert };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('T8 — deve recusar tarefa em grupo do qual o usuário não é membro', async () => {
    mockFrom.mockReturnValueOnce(membershipQuery(null));

    await expect(
      createTask({
        userId:     'user-1',
        title:      'Tarefa do grupo',
        difficulty: TaskDifficulty.Medium,
        groupId:    'grupo-alheio',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'NAO_MEMBRO_DO_GRUPO' });

    // Nada pode ter sido gravado: só a consulta de participação aconteceu
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('group_members');
  });

  it('T8b — deve criar a tarefa quando o usuário é membro do grupo', async () => {
    const { query, insert } = insertTaskQuery({ ...pendingTaskRow(), group_id: 'meu-grupo' });
    mockFrom
      .mockReturnValueOnce(membershipQuery({ user_id: 'user-1' }))
      .mockReturnValueOnce(query);

    const task = await createTask({
      userId:     'user-1',
      title:      'Implementar feature X',
      difficulty: TaskDifficulty.Medium,
      groupId:    'meu-grupo',
    });

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'tasks');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'meu-grupo', status: 'pending' }),
    );
    expect(task.title).toBe('Implementar feature X');
  });

  it('tarefa pessoal (sem grupo) não deve consultar participação em grupo', async () => {
    const { query, insert } = insertTaskQuery(pendingTaskRow());
    mockFrom.mockReturnValueOnce(query);

    await createTask({
      userId:     'user-1',
      title:      'Implementar feature X',
      difficulty: TaskDifficulty.Medium,
    });

    expect(mockFrom).not.toHaveBeenCalledWith('group_members');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: null, due_date: null, description: null }),
    );
  });
});
