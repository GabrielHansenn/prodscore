/**
 * Testes da confirmação de ações sensíveis (X4 da auditoria de UX): trocar a
 * senha e excluir a conta pedem a senha atual de todos, e o código do 2FA só
 * de quem tem 2FA ativo. Antes, quem não usava 2FA ficava bloqueado.
 */

const mockSignIn       = jest.fn();
const mockListFactors  = jest.fn();
const mockUpdateUser   = jest.fn();
const mockVerifyToken  = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { admin: { mfa: { listFactors: mockListFactors }, updateUserById: mockUpdateUser } },
  },
  createEphemeralAuthClient: () => ({ auth: { signInWithPassword: mockSignIn } }),
  createUserScopedClient:    jest.fn(),
  verifySupabaseToken:       (...args: unknown[]) => mockVerifyToken(...args),
}));

import express from 'express';
import request from 'supertest';
import authRoutes from '../routes/auth.routes';

/** JWT falso só com o payload que importa (aal) — a assinatura não é checada aqui */
function tokenWithAal(aal: 'aal1' | 'aal2') {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64({ aal })}.assinatura`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  return app;
}

describe('PATCH /auth/password — confirmação da ação', () => {
  const app = buildApp();
  const send = (aal: 'aal1' | 'aal2', body: object) =>
    request(app).patch('/auth/password').set('Authorization', `Bearer ${tokenWithAal(aal)}`).send(body);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockVerifyToken.mockResolvedValue({ user: { id: 'user-1', email: 'gabriel@test.com' }, error: null });
    mockSignIn.mockResolvedValue({ data: {}, error: null });
    mockListFactors.mockResolvedValue({ data: { factors: [] }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('sem 2FA: troca com a senha atual correta (antes era bloqueado)', async () => {
    const res = await send('aal1', { currentPassword: 'antiga123', newPassword: 'nova12345' });

    expect(res.status).toBe(200);
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'gabriel@test.com', password: 'antiga123' });
    expect(mockUpdateUser).toHaveBeenCalledWith('user-1', { password: 'nova12345' });
  });

  it('sem a senha atual → 400 pedindo a senha', async () => {
    const res = await send('aal1', { newPassword: 'nova12345' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('SENHA_ATUAL_OBRIGATORIA');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('senha atual errada → 400 (não 401, que derrubaria a sessão do web)', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials', status: 400 } });

    const res = await send('aal1', { currentPassword: 'errada', newPassword: 'nova12345' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: 'Senha atual incorreta.', codigo: 'SENHA_ATUAL_INCORRETA' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('com 2FA ativo e sessão sem código (aal1) → 403', async () => {
    mockListFactors.mockResolvedValue({ data: { factors: [{ id: 'f1', status: 'verified' }] }, error: null });

    const res = await send('aal1', { currentPassword: 'antiga123', newPassword: 'nova12345' });

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('AAL2_REQUERIDO');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('com 2FA ativo e sessão verificada (aal2) → troca', async () => {
    const res = await send('aal2', { currentPassword: 'antiga123', newPassword: 'nova12345' });

    expect(res.status).toBe(200);
    expect(mockListFactors).not.toHaveBeenCalled();
  });

  it('fator de 2FA só iniciado (não verificado) não bloqueia', async () => {
    mockListFactors.mockResolvedValue({ data: { factors: [{ id: 'f1', status: 'unverified' }] }, error: null });

    const res = await send('aal1', { currentPassword: 'antiga123', newPassword: 'nova12345' });

    expect(res.status).toBe(200);
  });

  it('nova senha segue as regras do cadastro e precisa ser diferente da atual', async () => {
    const fraca = await send('aal1', { currentPassword: 'antiga123', newPassword: 'abcdefgh' });
    expect(fraca.status).toBe(400);
    expect(fraca.body.erro).toBe('A senha precisa conter pelo menos um número.');

    const igual = await send('aal1', { currentPassword: 'antiga123', newPassword: 'antiga123' });
    expect(igual.status).toBe(400);
    expect(igual.body.erro).toBe('A nova senha precisa ser diferente da atual.');
  });
});
