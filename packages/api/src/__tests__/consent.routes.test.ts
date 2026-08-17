/**
 * Testes da rota de registro de consentimento de cookies (LGPD).
 * Cliente Supabase é mockado para isolar a rota da rede.
 */

jest.mock('../lib/supabase');

import express from 'express';
import request from 'supertest';
import consentRoutes from '../routes/consent.routes';
import { supabase } from '../lib/supabase';

const mockFrom    = supabase.from as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/consent', consentRoutes);
  return app;
}

const validPayload = {
  consent: { essential: true, analytics: true, functional: false, marketing: false },
  version: '1.0.0',
};

describe('POST /consent', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve gravar o registro de consentimento com sucesso sem usuário autenticado', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: insertMock });

    const res = await request(app).post('/consent').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.mensagem).toEqual(expect.any(String));
    expect(mockFrom).toHaveBeenCalledWith('consent_records');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, version: '1.0.0' }),
    );
  });

  it('deve associar o user_id quando um Bearer token válido é enviado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: insertMock });

    const res = await request(app)
      .post('/consent')
      .set('Authorization', 'Bearer token-valido')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1' }));
  });

  it('deve ignorar token inválido e gravar com user_id nulo', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Token inválido' } });
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: insertMock });

    const res = await request(app)
      .post('/consent')
      .set('Authorization', 'Bearer token-invalido')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }));
  });

  it('deve retornar 400 com mensagem em português quando o payload é inválido', async () => {
    const res = await request(app).post('/consent').send({ consent: { essential: true } });

    expect(res.status).toBe(400);
    expect(res.body.erro).toEqual(expect.any(String));
    expect(res.body.codigo).toBe('VALIDACAO_INVALIDA');
  });

  it('deve retornar 400 quando a versão da política está ausente', async () => {
    const res = await request(app).post('/consent').send({ consent: validPayload.consent });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_INVALIDA');
  });

  it('deve retornar 500 com mensagem em português quando a gravação falha', async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: { message: 'db error' } }),
    });

    const res = await request(app).post('/consent').send(validPayload);

    expect(res.status).toBe(500);
    expect(res.body.codigo).toBe('REGISTRO_CONSENTIMENTO_FALHOU');
    expect(res.body.erro).toEqual(expect.any(String));
  });
});
