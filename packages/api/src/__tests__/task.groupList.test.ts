/**
 * Lista de tarefas de um grupo: as tarefas são compartilhadas — qualquer
 * membro vê as de todos (com o nome de quem criou). Antes o filtro por
 * user_id valia sempre e cada membro só via as próprias.
 */

const mockFrom              = jest.fn();
const mockRequireMembership = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));
jest.mock('../services/group.service', () => ({
  requireMembership: (...args: unknown[]) => mockRequireMembership(...args),
}));
jest.mock('../services/gamification.service');
jest.mock('../services/mission.service');
jest.mock('../services/proof.service');
jest.mock('../services/adaptive.service');
jest.mock('../services/notification.service');

import { getTasksByUser } from '../services/task.service';
import { AppError } from '../lib/errors';

function taskRow(id: string, userId: string) {
  return {
    id, user_id: userId, group_id: 'g1', title: `Tarefa ${id}`, description: null, description_rich: null,
    difficulty: 'easy', priority: 'medium', estimated_minutes: null, status: 'pending', due_date: null,
    overdue_since: null, completed_at: null, points_earned: null, created_at: '', updated_at: '',
    requires_proof: false, task_proofs: null,
  };
}

/** Query encadeável do Supabase que registra os filtros .eq() aplicados */
function tasksQuery(rows: unknown[]) {
  const eqCalls: Array<[string, unknown]> = [];
  const query = {
    select: () => query,
    order:  () => query,
    eq: (col: string, val: unknown) => { eqCalls.push([col, val]); return query; },
    then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
  };
  return { query, eqCalls };
}

function profilesQuery(rows: unknown[]) {
  return { select: () => ({ in: async () => ({ data: rows, error: null }) }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireMembership.mockResolvedValue({ role: 'member' });
});

describe('getTasksByUser com groupId (tarefas do grupo)', () => {
  it('membro vê as tarefas de TODOS do grupo, com o autor de cada uma', async () => {
    const { query, eqCalls } = tasksQuery([taskRow('t1', 'ana'), taskRow('t2', 'bia')]);
    mockFrom.mockImplementation((table: string) => (table === 'tasks' ? query : profilesQuery([
      { id: 'ana', username: 'ana', avatar_url: null },
      { id: 'bia', username: 'bia', avatar_url: 'https://x/bia.png' },
    ])));

    const tasks = await getTasksByUser('bia', { groupId: 'g1' });

    expect(mockRequireMembership).toHaveBeenCalledWith('g1', 'bia');
    expect(eqCalls).toContainEqual(['group_id', 'g1']);
    expect(eqCalls.find(([col]) => col === 'user_id')).toBeUndefined();
    expect(tasks.map((t) => [t.id, t.author?.username])).toEqual([['t1', 'ana'], ['t2', 'bia']]);
  });

  it('quem não é membro não vê nada (403 da checagem de membro)', async () => {
    mockRequireMembership.mockRejectedValue(new AppError('Você não é membro deste grupo.', 403));

    await expect(getTasksByUser('intruso', { groupId: 'g1' })).rejects.toMatchObject({ statusCode: 403 });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('getTasksByUser sem groupId (Minhas tarefas)', () => {
  it('continua mostrando só as tarefas do próprio usuário', async () => {
    const { query, eqCalls } = tasksQuery([taskRow('t1', 'ana')]);
    mockFrom.mockReturnValue(query);

    const tasks = await getTasksByUser('ana');

    expect(eqCalls).toContainEqual(['user_id', 'ana']);
    expect(mockRequireMembership).not.toHaveBeenCalled();
    expect(tasks[0]?.author).toBeUndefined();
  });
});
