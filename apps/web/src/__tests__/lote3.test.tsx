/**
 * Testes do lote 3 da auditoria de UX:
 * - W11: página "não encontrada" no lugar do redirecionamento silencioso;
 * - W10: login valida por campo, sem o balão nativo do navegador;
 * - W3:  alertas fechados ficam fechados até o fim do dia;
 * - W13: copiar com plano B e aviso quando nada funciona.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockLogin, mockShowToast, auth } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockShowToast: vi.fn(),
  auth: { isAuthenticated: false },
}));

vi.mock('../store/authStore.js', () => ({
  useAuthStore: (selector: (s: object) => unknown) =>
    selector({ login: mockLogin, isLoading: false, isAuthenticated: auth.isAuthenticated }),
}));
vi.mock('../lib/supabase.js', () => ({ supabase: { auth: { resend: vi.fn() } } }));
vi.mock('../store/toastStore.js', () => ({ showToast: mockShowToast }));

import NotFoundPage from '../pages/NotFoundPage';
import LoginPage from '../pages/LoginPage';
import { getDismissedAlertTypes, dismissAlertType } from '../lib/dismissedAlerts';
import { copyText } from '../lib/clipboard';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Página não encontrada (W11)', () => {
  it('mostra o endereço e leva à página inicial para quem não está logado', () => {
    auth.isAuthenticated = false;
    render(<MemoryRouter initialEntries={['/tarefaz']}><NotFoundPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.getByText('/tarefaz')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para a página inicial' })).toHaveAttribute('href', '/');
  });

  it('leva ao Início para quem está logado', () => {
    auth.isAuthenticated = true;
    render(<MemoryRouter initialEntries={['/x']}><NotFoundPage /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Ir para o Início' })).toHaveAttribute('href', '/dashboard');
  });
});

describe('Login (W10)', () => {
  it('campos vazios mostram erro embaixo de cada campo e não tentam entrar', async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByText('Digite seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Digite sua senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('E-mail')).toHaveFocus();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('tem o link "Esqueci minha senha"', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/esqueci-senha');
  });
});

describe('Alertas fechados no dia (W3)', () => {
  it('lembra os tipos fechados hoje', () => {
    expect(getDismissedAlertTypes().size).toBe(0);
    dismissAlertType('overdue');
    dismissAlertType('stale');
    expect([...getDismissedAlertTypes()].sort()).toEqual(['overdue', 'stale']);
  });

  it('a chave leva a data, então no dia seguinte os alertas voltam', () => {
    dismissAlertType('overdue');
    const keys = Object.keys(localStorage);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^prodscore:alertas-dispensados:\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Copiar (W13)', () => {
  it('quando nada funciona, avisa e mostra o texto para copiar à mão', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('negado')) } });
    document.execCommand = vi.fn().mockReturnValue(false);

    const ok = await copyText('ABC123', 'o código');

    expect(ok).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith('Não foi possível copiar o código. Copie à mão: ABC123', 'error');
  });

  it('usa o método antigo quando a área de transferência moderna falha', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('negado')) } });
    document.execCommand = vi.fn().mockReturnValue(true);

    expect(await copyText('ABC123')).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
