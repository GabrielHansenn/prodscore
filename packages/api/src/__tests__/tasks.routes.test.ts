/**
 * Testes da rota de criação de tarefas (POST /tasks).
 *
 * Foca na camada HTTP: autenticação e validação do corpo da requisição.
 * O serviço createTask é mockado — aqui só importa se a rota deixa (ou não)
 * a requisição chegar até ele, e qual resposta devolve ao cliente.
 *
 * Os IDs (T1, T2...) correspondem à planilha de casos de teste.
 */

jest.mock('../lib/supabase', () => ({
  supabase:            { from: jest.fn() },
  verifySupabaseToken: jest.fn(),
}));
jest.mock('../services/task.service');

import express from 'express';
import request from 'supertest';
import { TaskDifficulty } from '@prodscore/shared';
import taskRoutes from '../routes/tasks.routes';
import { verifySupabaseToken } from '../lib/supabase';
import { createTask } from '../services/task.service';

const mockVerifyToken = verifySupabaseToken as jest.Mock;
const mockCreateTask  = createTask as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/tasks', taskRoutes);
  return app;
}

/** Data ISO daqui a N horas (positivo = futuro, negativo = passado) */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

const validTask = {
  title:      'Estudar para a prova',
  difficulty: TaskDifficulty.Medium,
};

describe('POST /tasks', () => {
  const app = buildApp();

  /** Envia uma requisição autenticada de criação de tarefa */
  function postTask(body: object) {
    return request(app)
      .post('/tasks')
      .set('Authorization', 'Bearer token-valido')
      .send(body);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    // Devolve a própria entrada como "tarefa criada"
    mockCreateTask.mockImplementation(async (input) => ({ id: 'task-1', ...input }));
  });

  // ── Autenticação ─────────────────────────────────────────────────────────

  describe('autenticação', () => {
    it('deve retornar 401 quando a requisição não tem token', async () => {
      const res = await request(app).post('/tasks').send(validTask);

      expect(res.status).toBe(401);
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('deve retornar 401 quando o token é inválido', async () => {
      mockVerifyToken.mockResolvedValue({ user: null, error: 'Token inválido.' });

      const res = await postTask(validTask);

      expect(res.status).toBe(401);
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });

  // ── Título ───────────────────────────────────────────────────────────────

  describe('título', () => {
    it('T1 — título vazio deve ser recusado', async () => {
      const res = await postTask({ ...validTask, title: '' });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('Título é obrigatório.');
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('T1b — requisição sem o campo título deve ser recusada', async () => {
      const res = await postTask({ difficulty: TaskDifficulty.Medium });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('Título é obrigatório.');
    });

    it('T2 — título com 255 caracteres (exatamente no limite) deve ser aceito', async () => {
      const res = await postTask({ ...validTask, title: 'a'.repeat(255) });

      expect(res.status).toBe(201);
      expect(mockCreateTask).toHaveBeenCalledTimes(1);
    });

    it('T3 — título com 256 caracteres (acima do limite) deve ser recusado', async () => {
      const res = await postTask({ ...validTask, title: 'a'.repeat(256) });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('O título deve ter no máximo 255 caracteres.');
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });

  // ── Demais campos ────────────────────────────────────────────────────────

  describe('demais campos', () => {
    it('T4 — descrição com 2001 caracteres deve ser recusada', async () => {
      const res = await postTask({ ...validTask, description: 'a'.repeat(2001) });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('A descrição deve ter no máximo 2000 caracteres.');
    });

    it('T5 — data de entrega no passado deve ser recusada', async () => {
      const res = await postTask({ ...validTask, dueDate: hoursFromNow(-1) });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('A data de entrega deve ser no futuro.');
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('T5b — data de entrega no futuro deve ser aceita', async () => {
      const res = await postTask({ ...validTask, dueDate: hoursFromNow(24) });

      expect(res.status).toBe(201);
    });

    it('T5c — data em formato inválido deve ser recusada', async () => {
      const res = await postTask({ ...validTask, dueDate: '31/12/2026' });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('Data de entrega inválida.');
    });

    it('T6 — tempo estimado igual a 0 deve ser recusado', async () => {
      const res = await postTask({ ...validTask, estimatedMinutes: 0 });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('Tempo estimado deve ser de pelo menos 1 minuto.');
    });

    it('T6b — dificuldade fora das opções deve ser recusada', async () => {
      const res = await postTask({ ...validTask, difficulty: 'impossivel' });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('Dificuldade inválida.');
    });
  });

  // ── Caminho feliz ────────────────────────────────────────────────────────

  describe('criação com sucesso', () => {
    it('T7 — só título e dificuldade (sem data) deve criar a tarefa', async () => {
      const res = await postTask(validTask);

      expect(res.status).toBe(201);
      expect(res.body.tarefa).toMatchObject({ id: 'task-1', title: 'Estudar para a prova' });
    });

    it('deve criar a tarefa no nome do usuário autenticado', async () => {
      await postTask(validTask);

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', title: validTask.title }),
      );
    });
  });
});
