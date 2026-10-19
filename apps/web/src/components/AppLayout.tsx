import { Outlet, useMatch } from 'react-router-dom';
import Sidebar from './Sidebar.js';
import BottomNav from './BottomNav.js';
import { LogoWordmark } from './Logo.js';
import NotificationBell from './NotificationBell.js';
import { HelpHeaderButton } from './HelpLink.js';

/**
 * Layout das telas logadas.
 *
 * - Desktop (a partir de 1024px): barra lateral fixa à esquerda.
 * - Celular e tablet (abaixo de 1024px): cabeçalho com logo e sino, e a barra
 *   de navegação inferior (BottomNav) — no lugar do antigo menu lateral com
 *   botão ☰, ruim de usar com uma mão só.
 */
export default function AppLayout() {
  // Chat tem altura calculada e coluna estreita próprias — fica fora do container padrão
  const isChat = useMatch('/amigos/:id/chat') !== null;

  return (
    <div className="h-app flex overflow-hidden bg-gray-50">
      {/* Barra lateral: só no desktop */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Cabeçalho do celular: logo e notificações (a navegação fica na barra inferior) */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <LogoWordmark className="h-6 w-auto" aria-hidden="true" />
          <div className="ml-auto flex items-center">
            <HelpHeaderButton />
            <NotificationBell variant="header" />
          </div>
        </header>

        {/* Conteúdo — P5: role="main" para skip-link e a11y.
            pb com --bottom-nav-height: o fim da página não fica atrás da barra inferior
            (a variável é 0 no desktop, no chat e com o teclado aberto) */}
        <main id="main-content" className="flex-1 overflow-y-auto pb-[var(--bottom-nav-height,0px)]" tabIndex={-1}>
          {/* O chat ocupa a altura toda de <main> (h-full) e rola por dentro */}
          <div className={isChat ? 'h-full' : 'mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10'}>
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
