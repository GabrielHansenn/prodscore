import { Link } from 'react-router-dom';
import { useConsentStore, needsConsent } from '../store/consentStore.js';

/**
 * Banner de consentimento de cookies (LGPD).
 *
 * Não bloqueia o restante da página (não é um modal com overlay) — apenas
 * uma barra fixa no rodapé, navegável por teclado, que some assim que o
 * usuário toma uma decisão. "Aceitar todos" e "Recusar todos" têm o mesmo
 * peso visual (mesmo tamanho/estilo de botão) para não induzir a aceitação.
 */
export default function CookieBanner() {
  const shouldShow = useConsentStore(needsConsent);
  const { acceptAll, rejectAll, openPreferences } = useConsentStore((s) => ({
    acceptAll:       s.acceptAll,
    rejectAll:       s.rejectAll,
    openPreferences: s.openPreferences,
  }));

  if (!shouldShow) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      aria-describedby="cookie-banner-description"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:p-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p id="cookie-banner-description" className="text-sm text-gray-600 dark:text-gray-300">
          Usamos cookies essenciais para o funcionamento do ProdScore e, com a sua permissão,
          cookies analíticos e funcionais para melhorar sua experiência. Você pode aceitar,
          recusar ou personalizar sua escolha a qualquer momento. Saiba mais na nossa{' '}
          <Link
            to="/politica-de-privacidade"
            className="font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        {/* Três ações com o mesmo peso visual — sem dark pattern */}
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={rejectAll} className="btn-secondary">
            Recusar todos
          </button>
          <button type="button" onClick={openPreferences} className="btn-secondary">
            Personalizar
          </button>
          <button type="button" onClick={acceptAll} className="btn-primary">
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
