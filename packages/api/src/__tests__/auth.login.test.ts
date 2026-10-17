/**
 * Testes do login com e-mail não confirmado e do reenvio da confirmação
 * (M2 da auditoria de UX): antes, a senha certa com e-mail não confirmado
 * respondia "E-mail ou senha incorretos" e o app não tinha como reenviar.
 */

const mockSignIn = jest.fn();
const mockResend = jest.fn();
const mockResetPassword = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase:                  { from: jest.fn() },
  createEphemeralAuthClient: () => ({ auth: { signInWithPassword: mockSignIn, resend: mockResend, resetPasswordForEmail: mockResetPassword } }),
  createUserScopedClient:    jest.fn(),
  verifySupabaseToken:       jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import authRoutes from '../routes/auth.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  return app;
}

describe('login e confirmação de e-mail', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('senha certa com e-mail não confirmado → 403 EMAIL_NAO_CONFIRMADO', async () => {
    mockSignIn.mockResolvedValue({
      data:  { session: null, user: null },
      error: { message: 'Email not confirmed', code: 'email_not_confirmed', status: 400 },
    });

    const res = await request(app).post('/auth/login').send({ email: 'gabriel@test.com', password: 'abcd1234' });

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('EMAIL_NAO_CONFIRMADO');
  });

  it('senha errada continua com a mensagem genérica', async () => {
    mockSignIn.mockResolvedValue({
      data:  { session: null, user: null },
      error: { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 },
    });

    const res = await request(app).post('/auth/login').send({ email: 'gabriel@test.com', password: 'errada123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: 'E-mail ou senha incorretos.', codigo: 'CREDENCIAIS_INVALIDAS' });
  });

  it('reenvio responde a mesma mensagem com ou sem conta (não revela cadastros)', async () => {
    mockResend.mockResolvedValueOnce({ data: {}, error: null });
    const comConta = await request(app).post('/auth/resend-confirmation').send({ email: 'gabriel@test.com' });

    mockResend.mockResolvedValueOnce({ data: {}, error: { message: 'User not found', status: 400 } });
    const semConta = await request(app).post('/auth/resend-confirmation').send({ email: 'ninguem@test.com' });

    expect(comConta.status).toBe(200);
    expect(semConta.status).toBe(200);
    expect(semConta.body).toEqual(comConta.body);
    // O novo link também leva à página que mostra o resultado da confirmação
    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'gabriel@test.com',
      options: { emailRedirectTo: expect.stringMatching(/\/email-confirmado$/) },
    });
  });

  it('reenvio repassa o limite de envios (429)', async () => {
    mockResend.mockResolvedValue({ data: {}, error: { message: 'For security purposes...', status: 429 } });

    const res = await request(app).post('/auth/resend-confirmation').send({ email: 'gabriel@test.com' });

    expect(res.status).toBe(429);
    expect(res.body.erro).toBe('Aguarde um minuto antes de pedir outro e-mail.');
  });
});

// ---------------------------------------------------------------------------
// Esqueci minha senha (X3)
// ---------------------------------------------------------------------------

describe('POST /auth/forgot-password', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('envia o link apontando para /redefinir-senha do site', async () => {
    process.env['FRONTEND_URL'] = 'https://prodscore.exemplo.com/';
    mockResetPassword.mockResolvedValue({ data: {}, error: null });

    const res = await request(app).post('/auth/forgot-password').send({ email: ' Gabriel@Test.com ' });

    expect(res.status).toBe(200);
    expect(mockResetPassword).toHaveBeenCalledWith('gabriel@test.com', {
      redirectTo: 'https://prodscore.exemplo.com/redefinir-senha',
    });
  });

  it('mesma resposta com ou sem conta (não revela cadastros)', async () => {
    mockResetPassword.mockResolvedValueOnce({ data: {}, error: null });
    const comConta = await request(app).post('/auth/forgot-password').send({ email: 'gabriel@test.com' });

    mockResetPassword.mockResolvedValueOnce({ data: {}, error: { message: 'User not found', status: 400 } });
    const semConta = await request(app).post('/auth/forgot-password').send({ email: 'ninguem@test.com' });

    expect(semConta.status).toBe(200);
    expect(semConta.body).toEqual(comConta.body);
  });

  it('limite de envios → 429', async () => {
    mockResetPassword.mockResolvedValue({ data: {}, error: { message: 'rate limit', status: 429 } });

    const res = await request(app).post('/auth/forgot-password').send({ email: 'gabriel@test.com' });

    expect(res.status).toBe(429);
  });
});
