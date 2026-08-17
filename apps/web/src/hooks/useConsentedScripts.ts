import { useEffect } from 'react';
import { CookieCategory } from '@prodscore/shared';
import { useConsentStore } from '../store/consentStore.js';

/**
 * Injeta um script externo no `<head>` somente depois que o usuário consentir
 * com a categoria de cookie associada a ele.
 *
 * Implementa o "bloqueio prévio" exigido pela LGPD/ANPD: nenhum script (e,
 * por consequência, nenhum cookie/rastreamento de terceiros que ele carregue)
 * roda antes do consentimento explícito do usuário para aquela categoria.
 *
 * Remove o script automaticamente se o consentimento for revogado depois.
 *
 * @param category - Categoria de cookie associada ao script (ex: Analytics)
 * @param src       - URL do script a ser carregado
 * @param enabled   - Permite desativar a injeção mesmo com consentimento (ex: feature flag)
 */
export function useConsentedScript(category: CookieCategory, src: string, enabled = true): void {
  const hasConsent = useConsentStore((s) => s.consent[category]);

  useEffect(() => {
    if (!enabled || !hasConsent) return;

    // Evita duplicar o script se o componente remontar
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) return;

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [category, src, enabled, hasConsent]);
}

// ---------------------------------------------------------------------------
// Exemplo de uso (padrão de bloqueio prévio) — não integrado a nenhum
// provedor real ainda. Descomente e ajuste a URL quando o analytics do
// produto for definido.
// ---------------------------------------------------------------------------
//
// /** Carrega o script de analytics apenas com consent.analytics === true */
// export function useAnalyticsScript(): void {
//   useConsentedScript(
//     CookieCategory.Analytics,
//     'https://exemplo-analytics.com/script.js',
//   );
// }
//
// Uso em um componente de alto nível (ex: App.tsx):
//   useAnalyticsScript();
