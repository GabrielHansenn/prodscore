import { Link } from 'react-router-dom';
import { helpHref, HELP_PATH, type HelpSectionId } from '@prodscore/shared';
import { HelpIcon } from './navIcons.js';

/**
 * Atalho "?" ao lado de um card ou título: abre a página de Ajuda já na
 * seção certa (ex: /ajuda#sequencia), com ela aberta.
 *
 * O círculo é pequeno, mas a área de toque tem 44px (o ::after invisível
 * em volta), como pede a acessibilidade no celular.
 */
export function HelpLink({ section, topic }: { section: HelpSectionId; topic: string }) {
  return (
    <Link
      to={helpHref(section)}
      aria-label={`Ajuda: ${topic}`}
      title={`Como funciona: ${topic}`}
      className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[11px] font-bold leading-none text-gray-500 transition-colors after:absolute after:-inset-3 after:content-[''] hover:border-brand-500 hover:text-brand-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-brand-400 dark:hover:text-brand-300"
    >
      ?
    </Link>
  );
}

/**
 * Botão "?" do cabeçalho do celular, ao lado do sino. No desktop não aparece:
 * lá a barra lateral já tem o item "Ajuda" sempre visível (e ao lado do logo
 * não cabe mais um botão sem encolher o logo).
 */
export function HelpHeaderButton() {
  return (
    <Link
      to={HELP_PATH}
      aria-label="Ajuda: como funcionam os pontos"
      title="Ajuda"
      className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 active:bg-gray-200"
    >
      <HelpIcon className="h-5 w-5" />
    </Link>
  );
}
