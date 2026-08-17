import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CookieCategory,
  CONSENT_VERSION,
  DEFAULT_CONSENT_STATE,
  ACCEPT_ALL_CONSENT_STATE,
  type ConsentState,
} from '@prodscore/shared';
import { recordConsent } from '../services/consent.service.js';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface ConsentStoreState {
  /** Escolha atual do usuário por categoria de cookie */
  consent: ConsentState;
  /** Versão da política vigente quando o consentimento foi salvo — null = nunca consentiu */
  version: string | null;
  /** Timestamp ISO 8601 de quando o consentimento foi salvo (accountability/LGPD) */
  consentedAt: string | null;
  /** Controla a exibição do modal de preferências granulares — não é persistido */
  isPreferencesOpen: boolean;

  /** Aceita todas as categorias */
  acceptAll: () => void;
  /** Recusa tudo que não seja essencial — tão acessível quanto acceptAll */
  rejectAll: () => void;
  /** Salva uma escolha granular por categoria; `essential` nunca pode ser desligado */
  setConsent: (partial: Partial<ConsentState>) => void;
  /** Reabre o modal de preferências para o usuário revisar/revogar a escolha */
  resetConsent: () => void;
  /** Abre o modal de preferências (usado pelo botão "Personalizar" do banner) */
  openPreferences: () => void;
  /** Fecha o modal de preferências sem alterar o consentimento salvo */
  closePreferences: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useConsentStore = create<ConsentStoreState>()(
  persist(
    (set) => ({
      consent:           DEFAULT_CONSENT_STATE,
      version:           null,
      consentedAt:       null,
      isPreferencesOpen: false,

      acceptAll: () => {
        set({
          consent:           ACCEPT_ALL_CONSENT_STATE,
          version:           CONSENT_VERSION,
          consentedAt:       new Date().toISOString(),
          isPreferencesOpen: false,
        });
        void recordConsent(ACCEPT_ALL_CONSENT_STATE, CONSENT_VERSION);
      },

      rejectAll: () => {
        set({
          consent:           DEFAULT_CONSENT_STATE,
          version:           CONSENT_VERSION,
          consentedAt:       new Date().toISOString(),
          isPreferencesOpen: false,
        });
        void recordConsent(DEFAULT_CONSENT_STATE, CONSENT_VERSION);
      },

      setConsent: (partial) => {
        set((s) => {
          // essential nunca pode ser desligado, mesmo que venha desligado no partial
          const consent: ConsentState = { ...s.consent, ...partial, [CookieCategory.Essential]: true };
          void recordConsent(consent, CONSENT_VERSION);
          return {
            consent,
            version:           CONSENT_VERSION,
            consentedAt:       new Date().toISOString(),
            isPreferencesOpen: false,
          };
        });
      },

      resetConsent: () => set({ isPreferencesOpen: true }),
      openPreferences:  () => set({ isPreferencesOpen: true }),
      closePreferences: () => set({ isPreferencesOpen: false }),
    }),
    {
      name: 'prodscore-consent',
      // isPreferencesOpen é estado de UI transiente — não deve ser persistido
      partialize: (s) => ({ consent: s.consent, version: s.version, consentedAt: s.consentedAt }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Seletores
// ---------------------------------------------------------------------------

/**
 * Retorna true quando o usuário ainda não consentiu ou quando a versão salva
 * é diferente da versão vigente da política — faz o banner reaparecer sempre
 * que a política de cookies mudar.
 *
 * Uso: `const precisaConsentir = useConsentStore(needsConsent);`
 */
export function needsConsent(state: ConsentStoreState): boolean {
  return state.version === null || state.version !== CONSENT_VERSION;
}
