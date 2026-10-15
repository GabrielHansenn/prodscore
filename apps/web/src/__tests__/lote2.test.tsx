/**
 * Testes de interface do lote 2 da auditoria de UX:
 * - X1: erro de carregamento aparece como erro, com "Tentar novamente";
 * - X3: "Esqueci minha senha";
 * - X4: trocar senha e excluir conta pedem a senha atual (sem exigir 2FA).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockPost, mockPatch, mockDelete, mockLogout } = vi.hoisted(() => ({
  mockPost: vi.fn(), mockPatch: vi.fn(), mockDelete: vi.fn(), mockLogout: vi.fn(),
}));

vi.mock('../services/api.js', () => ({
  api: { post: mockPost, patch: mockPatch, delete: mockDelete, get: vi.fn() },
}));
vi.mock('../store/authStore.js', () => ({
  useAuthStore: (selector: (s: { logout: typeof mockLogout }) => unknown) => selector({ logout: mockLogout }),
}));
// EnrollMFA fala com o Supabase; aqui só importa o resto da tela de Segurança
vi.mock('../components/EnrollMFA.js', () => ({ default: () => <p>2FA</p> }));

import ErrorState from '../components/ErrorState';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import SecurityPage from '../pages/SecurityPage';

/** Erro no formato que o axios lança para uma resposta de erro da API */
function apiError(status: number, body: object) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true, response: { status, data: body },
  });
}

beforeEach(() => { vi.clearAllMocks(); });

// ---------------------------------------------------------------------------
// X1
// ---------------------------------------------------------------------------

describe('ErrorState (X1)', () => {
  it('mostra a mensagem e tenta de novo', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(<ErrorState message="Não foi possível carregar suas tarefas." onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar suas tarefas.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// X3
// ---------------------------------------------------------------------------

describe('Esqueci minha senha (X3)', () => {
  const renderPage = () => render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

  it('valida o e-mail antes de enviar', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText('E-mail'), 'gabriel@gmail.comm');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(screen.getByText('E-mail em formato inválido. Você quis dizer gabriel@gmail.com?')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('envia e mostra a confirmação', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderPage();
    await userEvent.type(screen.getByLabelText('E-mail'), 'gabriel@gmail.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'gabriel@gmail.com' });
    expect(await screen.findByText('Confira seu e-mail')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// X4
// ---------------------------------------------------------------------------

describe('Segurança (X4)', () => {
  const renderPage = () => render(<MemoryRouter><SecurityPage /></MemoryRouter>);

  it('troca de senha aparece para todos (não exige mais o 2FA ativo)', () => {
    renderPage();
    expect(screen.getByLabelText('Senha atual')).toBeInTheDocument();
    expect(screen.queryByText(/Esta ação exige verificação em duas etapas/)).not.toBeInTheDocument();
  });

  it('envia a senha atual junto com a nova', async () => {
    mockPatch.mockResolvedValue({ data: {} });
    renderPage();
    await userEvent.type(screen.getByLabelText('Senha atual'), 'antiga123');
    await userEvent.type(screen.getByLabelText('Nova senha'), 'nova12345');
    await userEvent.type(screen.getByLabelText('Confirmar nova senha'), 'nova12345');
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(mockPatch).toHaveBeenCalledWith('/auth/password', { currentPassword: 'antiga123', newPassword: 'nova12345' });
    expect(await screen.findByText('Senha alterada com sucesso!')).toBeInTheDocument();
  });

  it('senha atual errada aparece no campo "Senha atual"', async () => {
    mockPatch.mockRejectedValue(apiError(400, { erro: 'Senha atual incorreta.', codigo: 'SENHA_ATUAL_INCORRETA' }));
    renderPage();
    await userEvent.type(screen.getByLabelText('Senha atual'), 'errada');
    await userEvent.type(screen.getByLabelText('Nova senha'), 'nova12345');
    await userEvent.type(screen.getByLabelText('Confirmar nova senha'), 'nova12345');
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('Senha atual incorreta.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha atual')).toHaveAttribute('aria-invalid', 'true');
  });

  it('excluir conta pede a senha atual e só sai depois de excluir', async () => {
    mockDelete.mockResolvedValue({ data: {} });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir conta' }));

    const dialog = screen.getByRole('dialog', { name: 'Excluir conta' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir permanentemente' }));
    expect(dialog).toHaveTextContent('Digite sua senha atual para confirmar.');
    expect(mockDelete).not.toHaveBeenCalled();

    await userEvent.type(screen.getAllByLabelText('Senha atual')[1]!, 'minhasenha1');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir permanentemente' }));

    expect(mockDelete).toHaveBeenCalledWith('/users/me', { data: { currentPassword: 'minhasenha1' } });
    expect(mockLogout).toHaveBeenCalled();
  });
});
