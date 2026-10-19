/**
 * Testes de POST /auth/register — em especial o bug do e-mail já cadastrado:
 * com a confirmação de e-mail ligada, o Supabase NÃO devolve erro para e-mail
 * repetido (devolve um usuário sem identidades e sem sessão), e a rota
 * respondia 201 "Conta criada! Verifique seu e-mail".
 */

const mockSignUp = jest.fn();
const mockFrom   = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase:                   { from: (...args: unknown[]) => mockFrom(...args) },
  createEphemeralAuthClient:  () => ({ auth: { signUp: mockSignUp } }),
  createUserScopedClient:     jest.fn(),
  verifySupabaseToken:        jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import authRoutes, { registerLimiter } from '../routes/auth.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  return app;
}

const validBody = { username: 'gabriel', email: 'gabriel@test.com', password: 'abcd1234' };

/** Mock da consulta de username em profiles (null = username livre) */
function usernameLookup(owner: { id: string } | null) {
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: owner, error: null }) }) }),
  });
}

/** Resposta do signUp para um cadastro novo aguardando confirmação de e-mail */
function newUserAwaitingConfirmation() {
  return {
    data:  { user: { id: 'user-novo', identities: [{ id: 'ident-1' }] }, session: null },
    error: null,
  };
}

describe('POST /auth/register', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    usernameLookup(null);
    registerLimiter.reset();
  });

  // ── Link do e-mail de confirmação ────────────────────────────────────────

  it('o link de confirmação leva à página /email-confirmado do site (FRONTEND_URL)', async () => {
    const previous = process.env['FRONTEND_URL'];
    process.env['FRONTEND_URL'] = 'https://prodscore.exemplo.com/';
    mockSignUp.mockResolvedValue(newUserAwaitingConfirmation());

    await request(app).post('/auth/register').send(validBody);

    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ emailRedirectTo: 'https://prodscore.exemplo.com/email-confirmado' }),
    }));
    process.env['FRONTEND_URL'] = previous;
  });

  // ── O bug ────────────────────────────────────────────────────────────────

  it('e-mail já cadastrado (confirmação ligada: Supabase devolve user sem identidades) → 409', async () => {
    // Exatamente o que o Supabase devolve: nenhum erro, user "fantasma", sem sessão
    mockSignUp.mockResolvedValue({
      data:  { user: { id: 'fake-id', identities: [] }, session: null },
      error: null,
    });

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      erro:   'Este e-mail já está cadastrado. Tente fazer login.',
      codigo: 'EMAIL_JA_CADASTRADO',
    });
    // Não vaza o id do usuário "fantasma" nem a mensagem de sucesso
    expect(JSON.stringify(res.body)).not.toContain('fake-id');
  });

  it('e-mail já cadastrado (confirmação desligada: Supabase devolve erro) → 409', async () => {
    mockSignUp.mockResolvedValue({
      data:  { user: null, session: null },
      error: { message: 'User already registered', code: 'user_already_exists', status: 422 },
    });

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('EMAIL_JA_CADASTRADO');
  });

  // ── Caminho feliz ────────────────────────────────────────────────────────

  it('cadastro novo aguardando confirmação → 201 "verifique seu e-mail"', async () => {
    mockSignUp.mockResolvedValue(newUserAwaitingConfirmation());

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.mensagem).toBe('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
    expect(res.body.sessao).toBeUndefined();
  });

  it('normaliza o e-mail (espaços e maiúsculas) antes de cadastrar', async () => {
    mockSignUp.mockResolvedValue(newUserAwaitingConfirmation());

    await request(app).post('/auth/register').send({ ...validBody, email: '  Gabriel@Test.COM ' });

    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'gabriel@test.com' }));
  });

  // ── Username ─────────────────────────────────────────────────────────────

  it('username já em uso → 409 sem nem chamar o Supabase Auth', async () => {
    usernameLookup({ id: 'outro-user' });

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: 'Este nome de usuário já está em uso.', codigo: 'USERNAME_JA_EM_USO' });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  // ── Validação (mesmas regras do formulário) ──────────────────────────────

  it.each([
    ['sem número',  'abcdefgh', 'A senha precisa conter pelo menos um número.'],
    ['sem letra',   '12345678', 'A senha precisa conter pelo menos uma letra.'],
    ['7 caracteres', 'abc1234', 'A senha precisa ter pelo menos 8 caracteres.'],
  ])('senha %s → 400 com a mesma mensagem do front', async (_caso, password, mensagem) => {
    const res = await request(app).post('/auth/register').send({ ...validBody, password });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe(mensagem);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('e-mail em formato inválido → 400 com a mesma mensagem do front', async () => {
    const res = await request(app).post('/auth/register').send({ ...validBody, email: 'gabriel@' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('Informe um e-mail válido (ex: nome@dominio.com).');
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('terminação inexistente (".comm") → 400 com sugestão, sem chamar o Supabase', async () => {
    const res = await request(app).post('/auth/register').send({ ...validBody, email: 'gabriel@gmail.comm' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('E-mail em formato inválido. Você quis dizer gabriel@gmail.com?');
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  // ── Erros inesperados ────────────────────────────────────────────────────

  it('erro interno do Supabase/banco → 500 genérico, sem vazar a mensagem original', async () => {
    mockSignUp.mockResolvedValue({
      data:  { user: null, session: null },
      error: { message: 'Database error saving new user', status: 500 },
    });

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.erro).toBe('Não foi possível criar a conta. Tente novamente em instantes.');
    expect(JSON.stringify(res.body)).not.toContain('Database');
  });

  // ── Limites de tentativas ────────────────────────────────────────────────

  it('limite do SUPABASE (vale para todos) → 503 sem culpar a pessoa, e o código vai para o log', async () => {
    mockSignUp.mockResolvedValue({
      data:  { user: null, session: null },
      error: { message: 'email rate limit exceeded', status: 429, code: 'over_email_send_rate_limit' },
    });

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(503);
    expect(res.body.codigo).toBe('CADASTRO_INDISPONIVEL');
    expect(res.body.erro).not.toMatch(/muitas tentativas/i);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), 'over_email_send_rate_limit', 'email rate limit exceeded');
  });

  it('cada pessoa (IP) tem o próprio limite: quem repete é barrado, outra pessoa não', async () => {
    mockSignUp.mockResolvedValue(newUserAwaitingConfirmation());
    const from = (ip: string, n: number) =>
      request(app).post('/auth/register').set('X-Forwarded-For', ip).send({ ...validBody, email: `p${n}@test.com` });

    for (let i = 0; i < registerLimiter.maxAttempts; i++) {
      expect((await from('203.0.113.1', i)).status).toBe(201);
    }

    const repeated = await from('203.0.113.1', 99);
    expect(repeated.status).toBe(429);
    expect(repeated.body.codigo).toBe('MUITAS_TENTATIVAS');
    expect(repeated.body.erro).toMatch(/muitas vezes seguidas/);

    // Primeira tentativa de outra pessoa passa normalmente
    expect((await from('198.51.100.7', 100)).status).toBe(201);
  });

  it('erros de validação não gastam tentativa (corrigir o formulário não bloqueia)', async () => {
    for (let i = 0; i < registerLimiter.maxAttempts + 3; i++) {
      await request(app).post('/auth/register').set('X-Forwarded-For', '203.0.113.9').send({ ...validBody, email: 'invalido' });
    }
    mockSignUp.mockResolvedValue(newUserAwaitingConfirmation());

    const res = await request(app).post('/auth/register').set('X-Forwarded-For', '203.0.113.9').send(validBody);

    expect(res.status).toBe(201);
  });
});
