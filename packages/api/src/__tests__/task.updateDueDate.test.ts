/**
 * Edição do prazo (updateTask): a regra usa a hora do SERVIDOR.
 * O caso que motivou: adiar o prazo de uma tarefa atrasada e concluí-la
 * "no prazo", trocando a penalidade de atraso pelo bônus.
 */

const mockFrom = jest.fn();
jest.mock('../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
jest.mock('../services/group.service');
jest.mock('../services/gamification.service');
jest.mock('../services/mission.service');
jest.mock('../services/proof.service');
jest.mock('../services/adaptive.service');
jest.mock('../services/notification.service');

import { updateTask } from '../services/task.service';

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/** Tarefa existente + captura do patch gravado */
function setup(existing: { status: string; due_date: string | null }) {
  const patches: Array<Record<string, unknown>> = [];
  mockFrom.mockImplementation(() => ({
    // Leitura da tarefa (ownership)
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 't1', user_id: 'u1', ...existing }, error: null }) }) }) }),
    // Gravação
    update: (patch: Record<string, unknown>) => {
      patches.push(patch);
      return { eq: () => ({ select: () => ({ single: async () => ({ data: {
        id: 't1', user_id: 'u1', group_id: null, title: 'x', description: null, description_rich: null,
        difficulty: 'easy', priority: 'medium', estimated_minutes: null, status: existing.status,
        due_date: existing.due_date, overdue_since: null, completed_at: null, points_earned: null,
        created_at: '', updated_at: '', requires_proof: false, task_proofs: null, ...patch,
      }, error: null }) }) }) };
    },
  }));
  return patches;
}

beforeEach(() => jest.clearAllMocks());

describe('updateTask — mudança de prazo', () => {
  it('tarefa ATRASADA: adiar o prazo é recusado (409)', async () => {
    setup({ status: 'overdue', due_date: daysFromNow(-1) });
    await expect(updateTask('t1', 'u1', { dueDate: daysFromNow(3) }))
      .rejects.toMatchObject({ statusCode: 409, code: 'PRAZO_VENCIDO' });
  });

  it('prazo vencido mas status ainda "pending" (o cron ainda não rodou): também recusa', async () => {
    setup({ status: 'pending', due_date: daysFromNow(-0.1) });
    await expect(updateTask('t1', 'u1', { dueDate: daysFromNow(3) })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('tarefa atrasada: editar só o título (o formulário reenvia o mesmo prazo) funciona', async () => {
    const due = daysFromNow(-1);
    const patches = setup({ status: 'overdue', due_date: due });
    await updateTask('t1', 'u1', { title: 'Novo título', dueDate: due });
    expect(patches[0]).toEqual({ title: 'Novo título' });
  });

  it('tarefa no prazo: mudar para outra data futura funciona', async () => {
    const patches = setup({ status: 'pending', due_date: daysFromNow(1) });
    const novo = daysFromNow(5);
    await updateTask('t1', 'u1', { dueDate: novo });
    expect(patches[0]).toEqual({ due_date: novo });
  });

  it('tarefa no prazo: mudar para uma data no passado é recusado (400)', async () => {
    setup({ status: 'pending', due_date: daysFromNow(1) });
    await expect(updateTask('t1', 'u1', { dueDate: daysFromNow(-2) }))
      .rejects.toMatchObject({ statusCode: 400, code: 'PRAZO_NO_PASSADO' });
  });
});
