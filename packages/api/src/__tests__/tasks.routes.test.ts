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
import { createTask, updateTask } from '../services/task.service';

const mockVerifyToken = verifySupabaseToken as jest.Mock;
const mockCreateTask  = createTask as jest.Mock;
const mockUpdateTask  = updateTask as jest.Mock;

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

// ---------------------------------------------------------------------------
// Descrição com texto rico
// ---------------------------------------------------------------------------

describe('descrição com texto rico', () => {
  const app = buildApp();

  /** Documento com negrito + lista, no formato que o editor envia */
  const richDoc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Revisar', marks: [{ type: 'bold' }] }, { type: 'text', text: ' o capítulo' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'resumo' }] }] },
      ] },
    ],
  };

  function send(method: 'post' | 'patch', path: string, body: object) {
    return request(app)[method](path)
      .set('Authorization', 'Bearer token-valido')
      .send(body);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mockCreateTask.mockImplementation(async (input) => ({ id: 'task-1', ...input }));
    mockUpdateTask.mockImplementation(async (_id, _userId, input) => ({ id: 'task-1', ...input }));
  });

  it('cria a tarefa com o documento normalizado e a cópia em texto puro', async () => {
    const res = await send('post', '/tasks', { ...validTask, descriptionRich: richDoc });

    expect(res.status).toBe(201);
    expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      description:     'Revisar o capítulo\n• resumo',
      descriptionRich: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Revisar', marks: ['bold'] }, { type: 'text', text: ' o capítulo' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'resumo' }] }] },
          ] },
        ],
      },
    }));
  });

  it('descarta conteúdo fora da allowlist (ex: imagem, link) antes de gravar', async () => {
    const malicioso = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'clique', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
        { type: 'image', attrs: { src: 'https://evil.example/x.png' } },
      ],
    };

    await send('post', '/tasks', { ...validTask, descriptionRich: malicioso });

    expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      descriptionRich: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'clique' }] }] },
    }));
  });

  it('recusa descrição com mais de 2000 caracteres de texto', async () => {
    const longo = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(2001) }] }] };

    const res = await send('post', '/tasks', { ...validTask, descriptionRich: longo });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('A descrição deve ter no máximo 2000 caracteres.');
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('aceita texto sem espaços muito longo (dentro do limite) — o layout é que quebra a linha', async () => {
    const semEspacos = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(2000) }] }] };

    const res = await send('post', '/tasks', { ...validTask, descriptionRich: semEspacos });

    expect(res.status).toBe(201);
  });

  it('documento vazio na edição limpa as duas colunas', async () => {
    const vazio = { type: 'doc', content: [{ type: 'paragraph' }] };

    const res = await send('patch', '/tasks/task-1', { descriptionRich: vazio });

    expect(res.status).toBe(200);
    expect(mockUpdateTask).toHaveBeenCalledWith('task-1', 'user-1', expect.objectContaining({
      description: null, descriptionRich: null,
    }));
  });

  it('cliente antigo (só texto puro) limpa o documento formatado para não ficar desatualizado', async () => {
    await send('patch', '/tasks/task-1', { description: 'texto novo' });

    expect(mockUpdateTask).toHaveBeenCalledWith('task-1', 'user-1', expect.objectContaining({
      description: 'texto novo', descriptionRich: null,
    }));
  });

  it('edição sem descrição não mexe nas colunas de descrição', async () => {
    await send('patch', '/tasks/task-1', { title: 'Só o título' });

    const input = mockUpdateTask.mock.calls[0]![2];
    expect(input.description).toBeUndefined();
    expect(input.descriptionRich).toBeUndefined();
  });
});
