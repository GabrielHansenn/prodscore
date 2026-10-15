/**
 * Testes da página de cadastro — o bug do e-mail já cadastrado e a validação
 * dos campos. O authStore é mockado: aqui importa o que a TELA mostra para
 * cada resposta do cadastro.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockRegister } = vi.hoisted(() => ({ mockRegister: vi.fn() }));

vi.mock('../store/authStore.js', () => ({
  useAuthStore: (selector: (s: { register: typeof mockRegister; isLoading: boolean }) => unknown) =>
    selector({ register: mockRegister, isLoading: false }),
}));
// O módulo real exige as env vars do Vite; a página só usa o resend da tela de confirmação
vi.mock('../lib/supabase.js', () => ({ supabase: { auth: { resend: vi.fn() } } }));

import RegisterPage from '../pages/RegisterPage';

/** Erro no formato que o axios lança para uma resposta de erro da API */
function apiError(status: number, body: object) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response:     { status, data: body },
  });
}

function renderPage() {
  return render(<MemoryRouter><RegisterPage /></MemoryRouter>);
}

/** Preenche o formulário (valores válidos por padrão) e envia */
async function fillAndSubmit(overrides: Partial<Record<'username' | 'email' | 'password' | 'confirm', string>> = {}) {
  const user = userEvent.setup();
  const v = { username: 'gabriel', email: 'gabriel@test.com', password: 'abcd1234', confirm: undefined as string | undefined, ...overrides };

  await user.type(screen.getByLabelText(/Nome de usuário/), v.username);
  await user.type(screen.getByLabelText(/^E-mail/), v.email);
  await user.type(screen.getByLabelText(/^Senha/), v.password);
  await user.type(screen.getByLabelText(/Confirmar senha/), v.confirm ?? v.password);
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  return user;
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── O bug ────────────────────────────────────────────────────────────────

  it('e-mail já cadastrado: mostra o erro NO CAMPO de e-mail e NÃO mostra sucesso', async () => {
    mockRegister.mockRejectedValue(apiError(409, {
      erro: 'Este e-mail já está cadastrado. Tente fazer login.', codigo: 'EMAIL_JA_CADASTRADO',
    }));
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText('Este e-mail já está cadastrado. Tente fazer login.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^E-mail/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^E-mail/)).toHaveFocus();
    expect(screen.getByRole('link', { name: /Ir para o login/ })).toHaveAttribute('href', '/login');
    expect(screen.queryByText('Verifique seu e-mail')).not.toBeInTheDocument();
  });

  it('username em uso: mostra o erro no campo de nome de usuário', async () => {
    mockRegister.mockRejectedValue(apiError(409, {
      erro: 'Este nome de usuário já está em uso.', codigo: 'USERNAME_JA_EM_USO',
    }));
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText('Este nome de usuário já está em uso.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome de usuário/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('link', { name: /Ir para o login/ })).not.toBeInTheDocument();
  });

  it('editar o e-mail limpa o erro de "já cadastrado"', async () => {
    mockRegister.mockRejectedValue(apiError(409, {
      erro: 'Este e-mail já está cadastrado. Tente fazer login.', codigo: 'EMAIL_JA_CADASTRADO',
    }));
    renderPage();
    const user = await fillAndSubmit();
    await screen.findByText('Este e-mail já está cadastrado. Tente fazer login.');

    await user.type(screen.getByLabelText(/^E-mail/), 'x');

    expect(screen.queryByText('Este e-mail já está cadastrado. Tente fazer login.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ir para o login/ })).not.toBeInTheDocument();
  });

  it('erro sem campo associado (ex: servidor fora) vai para o aviso geral', async () => {
    mockRegister.mockRejectedValue(apiError(500, {
      erro: 'Não foi possível criar a conta. Tente novamente em instantes.', codigo: 'CADASTRO_FALHOU',
    }));
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText('Não foi possível criar a conta. Tente novamente em instantes.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^E-mail/)).toHaveAttribute('aria-invalid', 'false');
  });

  // ── Sucesso ──────────────────────────────────────────────────────────────

  it('conta criada aguardando confirmação → mostra "Verifique seu e-mail"', async () => {
    mockRegister.mockResolvedValue('confirm_email');
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText('Verifique seu e-mail')).toBeInTheDocument();
    expect(screen.getByText('gabriel@test.com')).toBeInTheDocument();
  });

  // ── Validação dos campos (antes de chamar a API) ─────────────────────────

  it.each([
    ['e-mail sem domínio',  { email: 'gabriel@' },          'Informe um e-mail válido (ex: nome@dominio.com).'],
    ['e-mail com ".comm"',  { email: 'gabriel@gmail.comm' }, 'E-mail em formato inválido. Você quis dizer gabriel@gmail.com?'],
    ['senha sem número',    { password: 'abcdefgh' },       'A senha precisa conter pelo menos um número.'],
    ['senha curta',         { password: 'abc123' },         'A senha precisa ter pelo menos 8 caracteres.'],
    ['senhas diferentes',   { confirm: 'abcd12345' },       'As senhas não coincidem.'],
  ])('%s: mostra o erro e não envia', async (_caso, overrides, mensagem) => {
    renderPage();

    await fillAndSubmit(overrides);

    expect(await screen.findByText(mensagem)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
