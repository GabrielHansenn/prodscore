import { useEffect, useState } from 'react';
import { CookieCategory, ALL_COOKIE_CATEGORIES, type ConsentState } from '@prodscore/shared';
import { useConsentStore } from '../store/consentStore.js';

/** Rótulo e descrição em PT-BR de cada categoria, exibidos no modal de preferências */
const CATEGORY_META: Record<CookieCategory, { label: string; description: string }> = {
  [CookieCategory.Essential]: {
    label:       'Essenciais',
    description: 'Necessários para o funcionamento básico do site, como login e segurança. Não podem ser desativados.',
  },
  [CookieCategory.Analytics]: {
    label:       'Analíticos',
    description: 'Ajudam a entender como você usa o ProdScore, para melhorarmos a plataforma.',
  },
  [CookieCategory.Functional]: {
    label:       'Funcionais',
    description: 'Lembram suas preferências (ex: tema) para uma experiência mais personalizada.',
  },
  [CookieCategory.Marketing]: {
    label:       'Marketing',
    description: 'Usados para exibir conteúdo e ofertas mais relevantes para você.',
  },
};

/** Toggle acessível estilo "switch" para uma categoria de cookie */
function CategoryToggle({
  category,
  checked,
  onChange,
}: {
  category: CookieCategory;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const meta         = CATEGORY_META[category];
  const isEssential  = category === CookieCategory.Essential;

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {meta.label}
          {isEssential && <span className="ml-1.5 text-xs font-normal text-gray-400">(sempre ativo)</span>}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{meta.description}</p>
      </div>

      <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={isEssential}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={`Permitir cookies ${meta.label.toLowerCase()}`}
        />
        <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 dark:bg-gray-700" />
        <div className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
      </label>
    </div>
  );
}

/**
 * Modal de preferências granulares de cookies (LGPD).
 *
 * Aberto tanto pelo botão "Personalizar" do banner (primeira visita) quanto
 * pelo link permanente "Configurações de cookies" no rodapé (revogação/troca
 * de escolha a qualquer momento) — mesmo componente, mesma facilidade.
 */
export default function CookiePreferences() {
  const { isOpen, consent, closePreferences, setConsent, acceptAll } = useConsentStore((s) => ({
    isOpen:           s.isPreferencesOpen,
    consent:          s.consent,
    closePreferences: s.closePreferences,
    setConsent:       s.setConsent,
    acceptAll:        s.acceptAll,
  }));

  const [draft, setDraft] = useState<ConsentState>(consent);

  // Reabre sempre a partir da escolha salva atualmente, não da última edição descartada
  useEffect(() => {
    if (isOpen) setDraft(consent);
  }, [isOpen, consent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      >
        <h2 id="cookie-preferences-title" className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
          Preferências de cookies
        </h2>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          Escolha quais categorias de cookies você permite. Você pode alterar essa escolha a qualquer
          momento pelo link "Configurações de cookies" no rodapé.
        </p>

        <div className="space-y-3">
          {ALL_COOKIE_CATEGORIES.map((category) => (
            <CategoryToggle
              key={category}
              category={category}
              checked={draft[category]}
              onChange={(checked) => setDraft((d) => ({ ...d, [category]: checked }))}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={closePreferences} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={() => setConsent(draft)} className="btn-secondary">
            Salvar preferências
          </button>
          <button type="button" onClick={acceptAll} className="btn-primary">
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
