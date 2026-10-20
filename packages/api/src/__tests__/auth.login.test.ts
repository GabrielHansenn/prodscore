/**
 * Testes do login com e-mail não confirmado e do reenvio da confirmação
 * (M2 da auditoria de UX): antes, a senha certa com e-mail não confirmado
 * respondia "E-mail ou senha incorretos" e o app não tinha como reenviar.
 */

const mockSignIn = jest.fn();
const mockResend = jest.fn();
const mockResetPassword = jest.fn();
const mockFrom = jest.fn();
const mockGetUserById = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase:                  {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { admin: { getUserById: (...args: unknown[]) => mockGetUserById(...args) } },
  },
  createEphemeralAuthClient: () => ({ auth: { signInWithPassword: mockSignIn, resend: mockResend, resetPasswordForEmail: mockResetPassword } }),
  createUserScopedClient:    jest.fn(),
  verifySupabaseToken:       jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import authRoutes, { loginFailureLimiter, loginIpFailureLimiter } from '../routes/auth.routes';

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
    loginFailureLimiter.reset();
    loginIpFailureLimiter.reset();
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
    expect(res.body).toEqual({ erro: 'E-mail, usuário ou senha incorretos.', codigo: 'CREDENCIAIS_INVALIDAS' });
  });

  // ── Login com nome de usuário ────────────────────────────────────────────

  /** Busca de profiles: `exact` = resultado do eq; `loose` = resultado do ilike */
  function profilesLookup(exact: { id: string } | null, loose: Array<{ id: string }> = []) {
    mockFrom.mockReturnValue({
      select: () => ({
        eq:    () => ({ maybeSingle: async () => ({ data: exact, error: null }) }),
        ilike: () => ({ limit: async () => ({ data: loose, error: null }) }),
      }),
    });
  }

  it('entra com o NOME DE USUÁRIO: o servidor acha o e-mail e faz o login com ele', async () => {
    profilesLookup({ id: 'u1' });
    mockGetUserById.mockResolvedValue({ data: { user: { email: 'gabriel@test.com' } }, error: null });
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 } });

    await request(app).post('/auth/login').send({ login: 'GabrielHansenn', password: 'abcd1234' });

    expect(mockGetUserById).toHaveBeenCalledWith('u1');
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'gabriel@test.com', password: 'abcd1234' });
  });

  it('nome de usuário sem diferenciar maiúsculas, quando só há uma conta parecida', async () => {
    profilesLookup(null, [{ id: 'u1' }]);
    mockGetUserById.mockResolvedValue({ data: { user: { email: 'gabriel@test.com' } }, error: null });
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'x', code: 'invalid_credentials', status: 400 } });

    await request(app).post('/auth/login').send({ login: 'gabrielhansenn', password: 'abcd1234' });

    expect(mockSignIn).toHaveBeenCalledWith(expect.objectContaining({ email: 'gabriel@test.com' }));
  });

  it('usuário inexistente → MESMA resposta de senha errada, e o e-mail nunca aparece na resposta', async () => {
    profilesLookup(null, []);

    const res = await request(app).post('/auth/login').send({ login: 'ninguem', password: 'abcd1234' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: 'E-mail, usuário ou senha incorretos.', codigo: 'CREDENCIAIS_INVALIDAS' });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('o campo antigo "email" continua funcionando (versões antigas do app)', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'x', code: 'invalid_credentials', status: 400 } });

    await request(app).post('/auth/login').send({ email: 'Gabriel@Test.com', password: 'abcd1234' });

    expect(mockSignIn).toHaveBeenCalledWith({ email: 'gabriel@test.com', password: 'abcd1234' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('muitas tentativas ERRADAS na mesma conta → 429 só para ela; outra conta no MESMO IP continua', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'x', code: 'invalid_credentials', status: 400 } });
    const tryLogin = (login: string, ip = '203.0.113.1') =>
      request(app).post('/auth/login').set('X-Forwarded-For', ip).send({ login, password: 'errada123' });

    for (let i = 0; i < loginFailureLimiter.maxAttempts; i++) expect((await tryLogin('alvo@test.com')).status).toBe(401);
    const blocked = await tryLogin('alvo@test.com');
    expect(blocked.status).toBe(429);
    expect(blocked.body.codigo).toBe('MUITAS_TENTATIVAS');

    // Mesma rede (sala de aula, família): outra pessoa não é afetada
    expect((await tryLogin('colega@test.com')).status).toBe(401);
    // A conta-alvo, de outro IP, também não
    expect((await tryLogin('alvo@test.com', '198.51.100.2')).status).toBe(401);
  });

  it('muitas contas erradas do mesmo IP → 429 para o IP', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'x', code: 'invalid_credentials', status: 400 } });
    for (let i = 0; i < loginIpFailureLimiter.maxAttempts; i++) {
      await request(app).post('/auth/login').set('X-Forwarded-For', '203.0.113.9').send({ login: `c${i}@test.com`, password: 'errada123' });
    }
    const res = await request(app).post('/auth/login').set('X-Forwarded-For', '203.0.113.9').send({ login: 'nova@test.com', password: 'x' });
    expect(res.status).toBe(429);
  });

  it('sem e-mail nem usuário → 400', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'abcd1234' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toContain('e-mail ou nome de usuário');
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
