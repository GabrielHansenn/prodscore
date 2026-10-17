/**
 * Testes da página aberta pelo link do e-mail de confirmação de cadastro:
 * confirmado (encerra a sessão e leva ao login), link expirado (com reenvio)
 * e acesso direto sem link.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const { mockGetSession, mockResend, mockSignOut, mockClearSession } = vi.hoisted(() => ({
  mockGetSession:   vi.fn(),
  mockResend:       vi.fn(),
  mockSignOut:      vi.fn(),
  mockClearSession: vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession:        mockGetSession,
      resend:            mockResend,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
  signOut: mockSignOut,
}));
vi.mock('../store/authStore.js', () => ({
  useAuthStore: (selector: (s: object) => unknown) => selector({ clearSession: mockClearSession }),
}));

import EmailConfirmedPage from '../pages/EmailConfirmedPage';

/** Tela de login falsa que mostra o state recebido, para conferir o que a página passa adiante */
function LoginProbe() {
  const state = useLocation().state as { emailConfirmed?: boolean; email?: string } | null;
  return <p>login: {state?.emailConfirmed ? 'confirmado' : 'sem aviso'} / {state?.email}</p>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/email-confirmado']}>
      <Routes>
        <Route path="/email-confirmado" element={<EmailConfirmedPage />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('EmailConfirmedPage', () => {
  it('link válido: mostra "E-mail confirmado!", encerra a sessão do link e "Entrar" leva ao login com o e-mail', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { email: 'ana@exemplo.com' } } } });
    mockSignOut.mockResolvedValue({ data: null, error: null });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'E-mail confirmado!' })).toBeInTheDocument();
    expect(screen.getByText('ana@exemplo.com')).toBeInTheDocument();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockClearSession).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('login: confirmado / ana@exemplo.com')).toBeInTheDocument();
  });

  it('link expirado (erro no endereço): avisa e permite reenviar para a mesma página', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid';
    mockResend.mockResolvedValue({ error: null });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Link expirado ou já usado' })).toBeInTheDocument();
    expect(mockGetSession).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('E-mail do cadastro'), 'ana@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar link de confirmação' }));

    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ana@exemplo.com',
      options: { emailRedirectTo: `${window.location.origin}/email-confirmado` },
    });
    expect(await screen.findByText(/enviamos um novo link/)).toBeInTheDocument();
  });

  it('valida o e-mail antes de reenviar', async () => {
    window.location.hash = '#error_code=otp_expired';
    renderPage();

    await screen.findByRole('heading', { name: 'Link expirado ou já usado' });
    await userEvent.type(screen.getByLabelText('E-mail do cadastro'), 'ana@exemplo.comm');
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar link de confirmação' }));

    expect(mockResend).not.toHaveBeenCalled();
    expect(screen.getByLabelText('E-mail do cadastro')).toHaveAttribute('aria-invalid', 'true');
  });

  it('aberta sem link (sem sessão): trata como link inválido', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Link expirado ou já usado' })).toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
