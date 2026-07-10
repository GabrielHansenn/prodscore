import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.js';
import { LogoWordmark } from './Logo.js';

export default function AppLayout() {
  const [open, setOpen] = useState(false);

  // P2/P9: fechar sidebar com Escape (teclado)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) setOpen(false);
  }, [open]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* P2: Backdrop com aria-hidden (é decorativo, botão de fechar existe) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: drawer no mobile, estático no desktop */}
      {/* P7: ease-out ao entrar, ease-in ao sair */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0 ${
          open
            ? 'translate-x-0 transition-transform duration-300 ease-out'
            : '-translate-x-full transition-transform duration-200 ease-in lg:transition-none'
        }`}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra superior móvel */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu de navegação"
            aria-expanded={open}
            aria-controls="sidebar"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 active:bg-gray-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <LogoWordmark variant="light" className="h-6 w-auto" aria-hidden="true" />
        </header>

        {/* Conteúdo — P5: role="main" para skip-link e a11y */}
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
