/**
 * Testes da descrição com texto rico nas rotas de grupo (POST /groups e
 * PATCH /groups/:id). Os serviços são mockados — aqui importa o que a rota
 * repassa para eles depois de validar e normalizar a descrição.
 */

jest.mock('../lib/supabase', () => ({
  supabase:            { from: jest.fn() },
  verifySupabaseToken: jest.fn(),
}));
jest.mock('../services/group.service');
jest.mock('../services/mission.service');
jest.mock('../services/groupMessage.service');

import express from 'express';
import request from 'supertest';
import groupRoutes from '../routes/groups.routes';
import { verifySupabaseToken } from '../lib/supabase';
import { createGroup, updateGroup } from '../services/group.service';

const mockVerifyToken = verifySupabaseToken as jest.Mock;
const mockCreateGroup = createGroup as jest.Mock;
const mockUpdateGroup = updateGroup as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/groups', groupRoutes);
  return app;
}

/** Documento com uma palavra em negrito e uma lista, como o editor envia */
const richDoc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Grupo de', marks: [{ type: 'bold' }] }, { type: 'text', text: ' estudos' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'segundas' }] }] },
    ] },
  ],
};

function docWithText(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

describe('descrição do grupo com texto rico', () => {
  const app = buildApp();

  function send(method: 'post' | 'patch', path: string, body: object) {
    return request(app)[method](path)
      .set('Authorization', 'Bearer token-valido')
      .send(body);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mockCreateGroup.mockImplementation(async (input) => ({ id: 'grupo-1', ...input }));
    mockUpdateGroup.mockImplementation(async (_id, _userId, input) => ({ id: 'grupo-1', ...input }));
  });

  it('cria o grupo com o documento normalizado e a cópia em texto puro', async () => {
    const res = await send('post', '/groups', { name: 'Estudos', descriptionRich: richDoc });

    expect(res.status).toBe(201);
    expect(mockCreateGroup).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Grupo de estudos\n• segundas',
      descriptionRich: expect.objectContaining({ type: 'doc' }),
    }));
    // Marca do Tiptap ({ type: 'bold' }) vira o formato compacto do documento
    const saved = mockCreateGroup.mock.calls[0]![0].descriptionRich;
    expect(saved.content[0].content[0]).toEqual({ type: 'text', text: 'Grupo de', marks: ['bold'] });
  });

  it('respeita o limite de 500 caracteres do grupo (diferente do de tarefa)', async () => {
    const ok = await send('post', '/groups', { name: 'A', descriptionRich: docWithText('a'.repeat(500)) });
    expect(ok.status).toBe(201);

    const res = await send('post', '/groups', { name: 'B', descriptionRich: docWithText('a'.repeat(501)) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('A descrição deve ter no máximo 500 caracteres.');
  });

  it('descarta conteúdo fora da allowlist antes de gravar', async () => {
    await send('post', '/groups', {
      name: 'X',
      descriptionRich: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'oi', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
          { type: 'image', attrs: { src: 'https://evil.example/x.png' } },
        ],
      },
    });

    expect(mockCreateGroup).toHaveBeenCalledWith(expect.objectContaining({
      descriptionRich: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'oi' }] }] },
    }));
  });

  it('edição com descriptionRich null limpa as duas colunas', async () => {
    const res = await send('patch', '/groups/grupo-1', { descriptionRich: null });

    expect(res.status).toBe(200);
    expect(mockUpdateGroup).toHaveBeenCalledWith('grupo-1', 'user-1', { description: null, descriptionRich: null });
  });

  it('cliente antigo (só texto puro) limpa o documento formatado', async () => {
    await send('patch', '/groups/grupo-1', { description: 'texto novo' });

    expect(mockUpdateGroup).toHaveBeenCalledWith('grupo-1', 'user-1', { description: 'texto novo', descriptionRich: null });
  });

  it('edição só do nome não mexe na descrição', async () => {
    await send('patch', '/groups/grupo-1', { name: 'Novo nome' });

    expect(mockUpdateGroup).toHaveBeenCalledWith('grupo-1', 'user-1', { name: 'Novo nome' });
  });
});
