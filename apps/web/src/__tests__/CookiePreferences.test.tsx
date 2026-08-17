/**
 * Testes do modal de preferências granulares de cookies (LGPD).
 * O registro na API é mockado para isolar o componente da rede.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/consent.service.js', () => ({
  recordConsent: vi.fn().mockResolvedValue(undefined),
}));

import CookiePreferences from '../components/CookiePreferences';
import { useConsentStore } from '../store/consentStore';

const DEFAULT_CONSENT = { essential: true, analytics: false, functional: false, marketing: false };

function resetStore(overrides: Partial<ReturnType<typeof useConsentStore.getState>> = {}) {
  useConsentStore.setState({
    consent:           DEFAULT_CONSENT,
    version:           null,
    consentedAt:       null,
    isPreferencesOpen: true,
    ...overrides,
  });
}

describe('CookiePreferences', () => {
  beforeEach(() => {
    resetStore();
  });

  it('não deve renderizar nada quando o modal está fechado', () => {
    resetStore({ isPreferencesOpen: false });
    render(<CookiePreferences />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deve exibir o toggle de essential marcado e desabilitado', () => {
    render(<CookiePreferences />);

    const toggle = screen.getByLabelText('Permitir cookies essenciais');
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
  });

  it('"Salvar preferências" deve persistir as escolhas feitas nos toggles', async () => {
    render(<CookiePreferences />);

    await userEvent.click(screen.getByLabelText('Permitir cookies analíticos'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar preferências' }));

    const state = useConsentStore.getState();
    expect(state.consent.analytics).toBe(true);
    expect(state.consent.essential).toBe(true);
    expect(state.consent.marketing).toBe(false);
    expect(state.isPreferencesOpen).toBe(false);
  });

  it('"Cancelar" deve fechar sem alterar o consentimento salvo', async () => {
    render(<CookiePreferences />);

    await userEvent.click(screen.getByLabelText('Permitir cookies analíticos'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    const state = useConsentStore.getState();
    expect(state.consent.analytics).toBe(false);
    expect(state.isPreferencesOpen).toBe(false);
  });

  it('"Aceitar todos" deve ativar todas as categorias', async () => {
    render(<CookiePreferences />);

    await userEvent.click(screen.getByRole('button', { name: 'Aceitar todos' }));

    expect(useConsentStore.getState().consent).toEqual({
      essential: true, analytics: true, functional: true, marketing: true,
    });
  });
});
