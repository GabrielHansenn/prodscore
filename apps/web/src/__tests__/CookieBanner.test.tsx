/**
 * Testes do banner de consentimento de cookies (LGPD).
 * O registro na API é mockado para isolar o componente da rede.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/consent.service.js', () => ({
  recordConsent: vi.fn().mockResolvedValue(undefined),
}));

import { CONSENT_VERSION } from '@prodscore/shared';
import CookieBanner from '../components/CookieBanner';
import { useConsentStore } from '../store/consentStore';

const DEFAULT_CONSENT = { essential: true, analytics: false, functional: false, marketing: false };

function resetStore() {
  useConsentStore.setState({
    consent:           DEFAULT_CONSENT,
    version:           null,
    consentedAt:       null,
    isPreferencesOpen: false,
  });
}

function renderBanner() {
  return render(
    <MemoryRouter>
      <CookieBanner />
    </MemoryRouter>,
  );
}

describe('CookieBanner', () => {
  beforeEach(() => {
    resetStore();
  });

  it('deve aparecer quando o usuário ainda não consentiu', () => {
    renderBanner();
    expect(screen.getByRole('dialog', { name: 'Consentimento de cookies' })).toBeInTheDocument();
  });

  it('não deve aparecer quando já existe consentimento salvo na versão atual', () => {
    useConsentStore.setState({ version: CONSENT_VERSION });
    renderBanner();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deve reaparecer quando a versão salva é diferente da versão vigente da política', () => {
    useConsentStore.setState({ version: '0.0.1-antiga' });
    renderBanner();
    expect(screen.getByRole('dialog', { name: 'Consentimento de cookies' })).toBeInTheDocument();
  });

  it('"Recusar todos" deve manter apenas essential ativo e fechar o banner', async () => {
    renderBanner();

    await userEvent.click(screen.getByRole('button', { name: 'Recusar todos' }));

    expect(useConsentStore.getState().consent).toEqual(DEFAULT_CONSENT);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Aceitar todos" deve ativar todas as categorias', async () => {
    renderBanner();

    await userEvent.click(screen.getByRole('button', { name: 'Aceitar todos' }));

    expect(useConsentStore.getState().consent).toEqual({
      essential: true, analytics: true, functional: true, marketing: true,
    });
  });

  it('"Recusar todos" deve ser um botão real (não um link/texto menor) — sem dark pattern', () => {
    renderBanner();

    const rejectButton    = screen.getByRole('button', { name: 'Recusar todos' });
    const acceptButton    = screen.getByRole('button', { name: 'Aceitar todos' });
    const customizeButton = screen.getByRole('button', { name: 'Personalizar' });

    // Todos usam as classes padrão de botão do app (btn-primary/btn-secondary),
    // que têm o mesmo tamanho/peso — nenhum deles é um link discreto de texto
    expect(rejectButton.tagName).toBe('BUTTON');
    expect(rejectButton).toHaveClass('btn-secondary');
    expect(acceptButton.tagName).toBe('BUTTON');
    expect(acceptButton).toHaveClass('btn-primary');
    expect(customizeButton.tagName).toBe('BUTTON');
    expect(customizeButton).toHaveClass('btn-secondary');
  });

  it('deve abrir o modal de preferências ao clicar em "Personalizar"', async () => {
    renderBanner();

    await userEvent.click(screen.getByRole('button', { name: 'Personalizar' }));

    expect(useConsentStore.getState().isPreferencesOpen).toBe(true);
  });
});
