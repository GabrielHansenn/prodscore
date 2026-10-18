import { useEffect, useRef } from 'react';
import { useScrollLock } from '../lib/useScrollLock.js';
import { useDragToClose } from '../lib/useDragToClose.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useUserStore } from '../store/userStore.js';
import { useThemeStore, type Theme } from '../store/themeStore.js';
import { useConsentStore } from '../store/consentStore.js';
import {
  TrophyIcon, UserIcon, FriendsIcon, StarIcon, ChartIcon, LockIcon,
  LogoutIcon, SunIcon, MoonIcon, DesktopIcon,
} from './navIcons.js';

const ITEMS = [
  { to: '/ranking',                 label: 'Ranking',      icon: TrophyIcon },
  { to: '/perfil',                  label: 'Perfil',       icon: UserIcon },
  { to: '/amigos',                  label: 'Amigos',       icon: FriendsIcon },
  { to: '/conquistas',              label: 'Conquistas',   icon: StarIcon },
  { to: '/estatisticas',            label: 'Estatísticas', icon: ChartIcon },
  { to: '/configuracoes/seguranca', label: 'Segurança',    icon: LockIcon },
] as const;

const THEMES: ReadonlyArray<{ value: Theme; label: string; icon: (p: { className?: string }) => React.JSX.Element }> = [
  { value: 'light',  label: 'Claro',   icon: SunIcon },
  { value: 'dark',   label: 'Escuro',  icon: MoonIcon },
  { value: 'system', label: 'Sistema', icon: DesktopIcon },
];

/**
 * Menu do celular: folha que sobe do rodapé com as telas que não cabem na
 * barra inferior, o tema, as configurações de cookies e o Sair (o que antes
 * ficava no menu lateral). Fecha com Esc, toque fora, arrastando para baixo
 * ou ao escolher uma tela.
 */
export default function MobileMenuSheet({ onClose, unreadMessages }: { onClose: () => void; unreadMessages: number }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore((s) => ({ user: s.user, logout: s.logout }));
  const level = useUserStore((s) => s.stats?.level) ?? user?.level ?? 1;
  const { theme, setTheme } = useThemeStore();
  const resetConsent = useConsentStore((s) => s.resetConsent);
  const panelRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useScrollLock();
  useDragToClose(sheetRef, panelRef, () => onCloseRef.current());

  // Foco no primeiro item, Esc fecha e o foco volta para o botão "Menu"
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[1px] lg:hidden"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}
    >
      {/* Camada que acompanha o dedo ao arrastar. Separada do painel porque a
          animação de entrada (animate-in) prende o transform do painel */}
      <div ref={sheetRef} className="w-full max-w-[480px]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
        className="max-h-dialog w-full overflow-y-auto overscroll-contain rounded-t-3xl border-t border-gray-200 bg-white px-4 pt-3 shadow-2xl animate-in pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-[#1c1b32]"
      >
        {/* Puxador: área de toque maior que o tracinho, para arrastar e fechar */}
        <div data-drag-handle className="-mx-4 -mt-3 mb-1 flex touch-none justify-center pb-2 pt-3" aria-hidden="true">
          <div className="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" />
        </div>

        {/* Quem está logado */}
        <div className="mb-4 flex items-center gap-3 px-1">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
              {user?.username?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
          <div className="min-w-0">
            <p id="mobile-menu-title" className="truncate font-semibold text-gray-900 dark:text-white">{user?.username ?? 'Menu'}</p>
            <p className="text-xs text-gray-500">Nível {level}</p>
          </div>
        </div>

        {/* Telas */}
        <nav aria-label="Mais telas" className="grid grid-cols-3 gap-2">
          {ITEMS.map(({ to, label, icon: Icon }) => {
            const current = pathname === to || pathname.startsWith(`${to}/`);
            const badge = to === '/amigos' && unreadMessages > 0 ? unreadMessages : 0;
            return (
              <Link
                key={to}
                to={to}
                onClick={onClose}
                aria-current={current ? 'page' : undefined}
                aria-label={badge > 0 ? `${label}, ${badge} ${badge === 1 ? 'mensagem não lida' : 'mensagens não lidas'}` : undefined}
                className={`relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-medium transition-colors ${
                  current
                    ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-700/60 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-white/5 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
                {badge > 0 && (
                  <span aria-hidden="true" className="absolute right-3 top-2.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Tema */}
        <div role="radiogroup" aria-label="Tema da interface" className="mt-4 flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-black/20">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors ${
                theme === value
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-white/10 dark:text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Conta */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { onClose(); resetConsent(); }}
            className="min-h-[44px] rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
          >
            Configurações de cookies
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogoutIcon className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
