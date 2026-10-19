/**
 * Limites de valores digitados pelo usuário, conferidos no servidor:
 * - tempo estimado (antes: qualquer número, estourava o banco);
 * - prazo de tarefa e expiração de missão a no máximo 1 ano;
 * - recompensa de missão proporcional à meta (antes: até 100.000 pontos
 *   para cada membro do grupo).
 */

jest.mock('../lib/supabase', () => ({
  supabase:            { from: jest.fn() },
  verifySupabaseToken: jest.fn(),
}));
jest.mock('../services/task.service');
jest.mock('../services/mission.service');

import express from 'express';
import request from 'supertest';
import {
  TaskDifficulty, TASK_ESTIMATE_MAX_MINUTES, TASK_DUE_DATE_MAX_DAYS,
  MISSION_EXPIRES_MAX_DAYS, maxMissionReward,
} from '@prodscore/shared';
import taskRoutes from '../routes/tasks.routes';
import groupRoutes from '../routes/groups.routes';
import { verifySupabaseToken } from '../lib/supabase';
import { createTask, updateTask } from '../services/task.service';
import { createGroupMission } from '../services/mission.service';

const mockVerifyToken  = verifySupabaseToken as jest.Mock;
const mockCreateTask   = createTask as jest.Mock;
const mockUpdateTask   = updateTask as jest.Mock;
const mockCreateMission = createGroupMission as jest.Mock;

const app = express();
app.use(express.json());
app.use('/tasks', taskRoutes);
app.use('/groups', groupRoutes);

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const auth = { Authorization: 'Bearer token-valido' };
const validTask = { title: 'Estudar', difficulty: TaskDifficulty.Medium, dueDate: daysFromNow(2) };

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyToken.mockResolvedValue({ user: { id: 'user-1' }, error: null });
  mockCreateTask.mockImplementation(async (input) => ({ id: 't1', ...input }));
  mockUpdateTask.mockImplementation(async (_id, _u, input) => ({ id: 't1', ...input }));
  mockCreateMission.mockImplementation(async (input) => ({ id: 'm1', ...input }));
});

describe('Tempo estimado', () => {
  it('aceita até o máximo', async () => {
    const res = await request(app).post('/tasks').set(auth).send({ ...validTask, estimatedMinutes: TASK_ESTIMATE_MAX_MINUTES });
    expect(res.status).toBe(201);
  });

  it('acima do máximo (ex: muitos dígitos) → 400 com mensagem em português, sem chegar no banco', async () => {
    const res = await request(app).post('/tasks').set(auth).send({ ...validTask, estimatedMinutes: 99_999_999_999 });
    expect(res.status).toBe(400);
    expect(res.body.erro).toContain('no máximo');
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('vale também na edição', async () => {
    const res = await request(app).patch('/tasks/t1').set(auth).send({ estimatedMinutes: TASK_ESTIMATE_MAX_MINUTES + 1 });
    expect(res.status).toBe(400);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });
});

describe('Prazo de tarefa (hora do servidor)', () => {
  it(`mais de ${TASK_DUE_DATE_MAX_DAYS} dias à frente → 400`, async () => {
    const res = await request(app).post('/tasks').set(auth).send({ ...validTask, dueDate: daysFromNow(TASK_DUE_DATE_MAX_DAYS + 2) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toContain(`${TASK_DUE_DATE_MAX_DAYS} dias`);
  });

  it('ano 9999 → 400', async () => {
    const res = await request(app).post('/tasks').set(auth).send({ ...validTask, dueDate: '9999-12-31T23:59:00.000Z' });
    expect(res.status).toBe(400);
  });

  it('na edição, um prazo vencido passa pela rota (o serviço decide se é o mesmo de antes)', async () => {
    const res = await request(app).patch('/tasks/t1').set(auth).send({ title: 'Novo título', dueDate: daysFromNow(-1) });
    expect(res.status).toBe(200);
    expect(mockUpdateTask).toHaveBeenCalled();
  });
});

describe('Missão de grupo', () => {
  const mission = (body: object) => request(app).post('/groups/g1/missions').set(auth).send({ title: 'Missão', targetValue: 10, ...body });

  it('recompensa dentro do limite da meta → 201', async () => {
    const res = await mission({ rewardPoints: maxMissionReward(10) });
    expect(res.status).toBe(201);
  });

  it('recompensa acima do limite (o caso de 100.000 pontos) → 400 explicando o máximo', async () => {
    const res = await mission({ targetValue: 1, rewardPoints: 100_000 });
    expect(res.status).toBe(400);
    expect(res.body.erro).toContain(`no máximo ${maxMissionReward(1)} pontos`);
    expect(mockCreateMission).not.toHaveBeenCalled();
  });

  it('o teto cresce com a meta, mas nunca passa do máximo absoluto', () => {
    expect(maxMissionReward(1)).toBeLessThan(maxMissionReward(10));
    expect(maxMissionReward(10_000)).toBe(maxMissionReward(100_000));
  });

  it(`expiração a mais de ${MISSION_EXPIRES_MAX_DAYS} dias → 400`, async () => {
    const res = await mission({ rewardPoints: 0, expiresAt: daysFromNow(MISSION_EXPIRES_MAX_DAYS + 2) });
    expect(res.status).toBe(400);
  });
});
