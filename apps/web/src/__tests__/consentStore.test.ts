/**
 * Testes da store de consentimento de cookies (LGPD).
 * O registro na API é mockado para isolar a lógica de estado da rede.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRecordConsent } = vi.hoisted(() => ({
  mockRecordConsent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/consent.service.js', () => ({
  recordConsent: mockRecordConsent,
}));

import { CONSENT_VERSION } from '@prodscore/shared';
import { useConsentStore, needsConsent } from '../store/consentStore';

const DEFAULT_CONSENT = { essential: true, analytics: false, functional: false, marketing: false };

function resetStore() {
  useConsentStore.setState({
    consent:           DEFAULT_CONSENT,
    version:           null,
    consentedAt:       null,
    isPreferencesOpen: false,
  });
}

describe('consentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('needsConsent', () => {
    it('deve ser true quando o usuário nunca consentiu', () => {
      expect(needsConsent(useConsentStore.getState())).toBe(true);
    });

    it('deve ser false depois de um consentimento salvo na versão atual', () => {
      useConsentStore.getState().acceptAll();
      expect(needsConsent(useConsentStore.getState())).toBe(false);
    });

    it('deve voltar a true quando a versão salva é diferente da versão vigente', () => {
      useConsentStore.getState().acceptAll();
      // Simula uma escolha salva numa versão antiga da política
      useConsentStore.setState({ version: '0.0.1-antiga' });
      expect(needsConsent(useConsentStore.getState())).toBe(true);
    });
  });

  describe('acceptAll', () => {
    it('deve ativar todas as categorias e registrar a versão vigente', () => {
      useConsentStore.getState().acceptAll();
      const state = useConsentStore.getState();

      expect(state.consent).toEqual({ essential: true, analytics: true, functional: true, marketing: true });
      expect(state.version).toBe(CONSENT_VERSION);
      expect(state.consentedAt).not.toBeNull();
    });

    it('deve disparar o registro best-effort do consentimento na API', () => {
      useConsentStore.getState().acceptAll();
      expect(mockRecordConsent).toHaveBeenCalledWith(
        { essential: true, analytics: true, functional: true, marketing: true },
        CONSENT_VERSION,
      );
    });
  });

  describe('rejectAll', () => {
    it('deve manter apenas essential ativo', () => {
      useConsentStore.getState().rejectAll();
      const state = useConsentStore.getState();

      expect(state.consent).toEqual(DEFAULT_CONSENT);
      expect(state.version).toBe(CONSENT_VERSION);
      expect(needsConsent(state)).toBe(false);
    });
  });

  describe('setConsent', () => {
    it('deve salvar a escolha granular informada', () => {
      useConsentStore.getState().setConsent({ analytics: true, marketing: false });
      const state = useConsentStore.getState();

      expect(state.consent.analytics).toBe(true);
      expect(state.consent.marketing).toBe(false);
      expect(state.consent.functional).toBe(false);
    });

    it('nunca deve permitir desligar essential, mesmo se enviado false', () => {
      useConsentStore.getState().setConsent({ essential: false, analytics: true });
      expect(useConsentStore.getState().consent.essential).toBe(true);
    });
  });

  describe('preferências (abrir/fechar)', () => {
    it('resetConsent deve abrir o modal de preferências', () => {
      useConsentStore.getState().resetConsent();
      expect(useConsentStore.getState().isPreferencesOpen).toBe(true);
    });

    it('closePreferences deve fechar sem alterar o consentimento salvo', () => {
      useConsentStore.getState().acceptAll();
      useConsentStore.getState().openPreferences();
      useConsentStore.getState().closePreferences();

      const state = useConsentStore.getState();
      expect(state.isPreferencesOpen).toBe(false);
      expect(state.consent).toEqual({ essential: true, analytics: true, functional: true, marketing: true });
    });
  });
});
