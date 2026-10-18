import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useUserStore } from '../store/userStore.js';
import { useThemeStore, type Theme } from '../store/themeStore.js';
import { useConsentStore } from '../store/consentStore.js';
import { LogoWordmark } from './Logo.js';
import NotificationBell from './NotificationBell.js';
import {
  HomeIcon, TaskIcon, TrophyIcon, FriendsIcon, GroupIcon, StarIcon, ChartIcon,
  UserIcon, LockIcon, LogoutIcon, SunIcon, MoonIcon, DesktopIcon,
} from './navIcons.js';

const THEME_OPTIONS: ReadonlyArray<{
  value: Theme;
  label:  string;
  icon:   (props: { className?: string }) => React.JSX.Element;
}> = [
  { value: 'light',  label: 'Tema claro',      icon: SunIcon },
  { value: 'dark',   label: 'Tema escuro',     icon: MoonIcon },
  { value: 'system', label: 'Tema do sistema', icon: DesktopIcon },
];

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Dashboard',    icon: HomeIcon },
  { to: '/tarefas',      label: 'Tarefas',       icon: TaskIcon },
  { to: '/ranking',      label: 'Ranking',       icon: TrophyIcon },
  { to: '/grupos',       label: 'Grupos',        icon: GroupIcon },
  { to: '/amigos',       label: 'Amigos',        icon: FriendsIcon },
  { to: '/conquistas',   label: 'Conquistas',    icon: StarIcon },
  { to: '/estatisticas', label: 'Estatísticas',  icon: ChartIcon },
  { to: '/perfil',       label: 'Perfil',        icon: UserIcon },
  { to: '/configuracoes/seguranca', label: 'Segurança', icon: LockIcon },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuthStore((s) => ({ user: s.user, logout: s.logout }));
  const statsLevel = useUserStore((s) => s.stats?.level);
  const { theme, setTheme } = useThemeStore();
  const resetConsent = useConsentStore((s) => s.resetConsent);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <aside className="h-app flex w-60 shrink-0 flex-col bg-sidebar-bg">
      {/* Logo + botão fechar (móvel) */}
      <div className="flex items-center gap-2.5 px-6 py-6">
        <LogoWordmark variant="dark" className="h-7 w-auto flex-1" />
        <NotificationBell onNavigate={onClose} />
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-sidebar-muted hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Navegação principal">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-sidebar-active text-white'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
              }`
            }
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                {isActive && (
                  <span
                    className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-lime-400"
                    aria-hidden="true"
                  />
                )}
                <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-lime-400' : ''}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User card + ações */}
      <div className="border-t border-sidebar-border px-3 py-3">
        {/* Info do usuário */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            {user?.username?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user?.username ?? 'Usuário'}</p>
            <p className="text-xs text-sidebar-muted">Nível {statsLevel ?? user?.level ?? 1}</p>
          </div>
        </div>

        {/* Seletor de tema — claro / escuro / sistema (P9) */}
        <div
          role="radiogroup"
          aria-label="Tema da interface"
          className="mt-1 flex items-center gap-0.5 rounded-lg bg-black/20 p-0.5"
        >
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              aria-label={label}
              onClick={() => setTheme(value)}
              className={`flex min-h-[36px] flex-1 items-center justify-center rounded-md transition-colors duration-150 ${
                theme === value
                  ? 'bg-sidebar-active text-white'
                  : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <button
          onClick={() => void handleLogout()}
          aria-label="Sair da conta"
          className="mt-1 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg text-xs text-sidebar-muted transition-colors duration-150 hover:bg-sidebar-hover hover:text-white"
        >
          <LogoutIcon className="h-4 w-4" />
          <span>Sair</span>
        </button>

        {/* Revogação/troca de consentimento de cookies — sempre acessível (LGPD) */}
        <button
          type="button"
          onClick={resetConsent}
          className="mt-1 w-full rounded-lg px-3 py-1.5 text-center text-[11px] text-sidebar-muted transition-colors duration-150 hover:bg-sidebar-hover hover:text-white"
        >
          Configurações de cookies
        </button>
      </div>
    </aside>
  );
}
