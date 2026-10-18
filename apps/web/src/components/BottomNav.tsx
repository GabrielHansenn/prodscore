import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useChatStore, totalUnread } from '../store/chatStore.js';
import { activeMobileTab, hidesBottomNav, BOTTOM_NAV_SPACE, type MobileTab } from '../lib/mobileNav.js';
import { useKeyboardOpen } from '../lib/useKeyboardOpen.js';
import { HomeIcon, TaskIcon, GroupIcon, PlusIcon, MenuIcon } from './navIcons.js';
import MobileMenuSheet from './MobileMenuSheet.js';

type IconComponent = (p: { className?: string }) => React.JSX.Element;

/** Aba da barra: ícone + rótulo, com tracinho e cor da marca quando ativa */
function TabContent({ icon: Icon, label, active }: { icon: IconComponent; label: string; active: boolean }) {
  return (
    <>
      {active && <span aria-hidden="true" className="absolute top-0 h-1 w-5 rounded-full bg-brand-600 dark:bg-brand-400" />}
      <Icon className={`h-6 w-6 ${active ? '[stroke-width:2.2]' : ''}`} />
      <span className={active ? 'font-semibold' : ''}>{label}</span>
    </>
  );
}

const tabClass = (active: boolean) =>
  `relative flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl pt-2 text-[11px] font-medium transition-colors ${
    active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500 hover:text-gray-800 dark:text-[#8f8fb8] dark:hover:text-gray-200'
  }`;

const TABS: Array<{ key: Exclude<MobileTab, 'menu'>; to: string; label: string; icon: IconComponent }> = [
  { key: 'inicio',  to: '/dashboard', label: 'Início',  icon: HomeIcon },
  { key: 'tarefas', to: '/tarefas',   label: 'Tarefas', icon: TaskIcon },
];
const GROUPS_TAB = { key: 'grupos' as const, to: '/grupos', label: 'Grupos', icon: GroupIcon };

/**
 * Barra de navegação inferior do celular (abaixo de 1024px — no desktop
 * continua a barra lateral): Início · Tarefas · (+ nova tarefa) · Grupos · Menu.
 *
 * Some no chat com amigo (tela cheia) e com o teclado aberto. Enquanto está
 * visível, publica a altura que ocupa em --bottom-nav-height, que o <main>,
 * os toasts e o banner de cookies usam para não ficar atrás dela.
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const keyboardOpen = useKeyboardOpen();
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadMessages = useChatStore(totalUnread);
  const fetchUnread = useChatStore((s) => s.fetchUnread);

  const active = activeMobileTab(pathname);
  const hidden = hidesBottomNav(pathname) || keyboardOpen;

  // Mensagens não lidas (badge do Menu, que leva a Amigos): atualiza a cada troca de tela
  useEffect(() => { void fetchUnread(); }, [pathname, fetchUnread]);

  // Fecha o menu ao trocar de tela (ex: link dentro de uma notificação)
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    document.documentElement.style.setProperty('--bottom-nav-height', hidden ? '0px' : BOTTOM_NAV_SPACE);
    return () => { document.documentElement.style.removeProperty('--bottom-nav-height'); };
  }, [hidden]);

  if (hidden) return null;

  // O aria-label substitui o texto visível: inclui contador e "tela atual" (as telas do menu não têm aba própria)
  const menuLabel = [
    'Menu',
    unreadMessages > 0 ? `${unreadMessages} ${unreadMessages === 1 ? 'mensagem não lida' : 'mensagens não lidas'}` : null,
    active === 'menu' ? 'tela atual' : null,
  ].filter(Boolean).join(', ');

  return (
    <>
      <nav
        aria-label="Navegação principal"
        data-testid="bottom-nav"
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="relative mx-auto grid max-w-[480px] grid-cols-5 items-end rounded-[28px] border border-gray-200/80 bg-white/95 px-1 shadow-[0_8px_30px_rgba(23,21,58,0.12)] backdrop-blur dark:border-white/10 dark:bg-[#1c1b32]/95 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {TABS.map((tab) => (
            <Link key={tab.key} to={tab.to} aria-current={active === tab.key ? 'page' : undefined} className={tabClass(active === tab.key)}>
              <TabContent icon={tab.icon} label={tab.label} active={active === tab.key} />
            </Link>
          ))}

          {/* Ação principal no centro, elevada (como nos prints de referência) */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/tarefas?nova=1')}
              aria-label="Nova tarefa"
              className="-mt-7 mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_24px_rgba(124,58,237,0.45)] ring-[6px] ring-gray-50 transition active:scale-95 dark:ring-[#0c0b18]"
            >
              <PlusIcon className="h-6 w-6" />
            </button>
          </div>

          <Link to={GROUPS_TAB.to} aria-current={active === 'grupos' ? 'page' : undefined} className={tabClass(active === 'grupos')}>
            <TabContent icon={GROUPS_TAB.icon} label={GROUPS_TAB.label} active={active === 'grupos'} />
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-label={menuLabel}
            data-current={active === 'menu' ? 'true' : undefined}
            className={tabClass(active === 'menu')}
          >
            <TabContent icon={MenuIcon} label="Menu" active={active === 'menu'} />
            {unreadMessages > 0 && (
              <span aria-hidden="true" className="absolute right-3 top-2 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white dark:ring-[#1c1b32]">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>
        </div>
      </nav>

      {menuOpen && <MobileMenuSheet onClose={() => setMenuOpen(false)} unreadMessages={unreadMessages} />}
    </>
  );
}
