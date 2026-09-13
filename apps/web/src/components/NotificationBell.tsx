import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationType, type Notification } from '@prodscore/shared';
import { useNotificationStore } from '../store/notificationStore.js';
import { TrophyIcon, BoltIcon, UsersIcon, ChatIcon, BellIcon } from './icons.js';

/** Ícone e cor por tipo de notificação */
const TYPE_STYLES: Record<NotificationType, { icon: (p: { className?: string }) => React.JSX.Element; bg: string; fg: string }> = {
  [NotificationType.FriendMessage]: { icon: ChatIcon,   bg: 'bg-blue-100 dark:bg-blue-900/30',   fg: 'text-blue-600 dark:text-blue-400' },
  [NotificationType.GroupMessage]:  { icon: UsersIcon,  bg: 'bg-brand-100 dark:bg-brand-900/30', fg: 'text-brand-600 dark:text-brand-400' },
  [NotificationType.Achievement]:   { icon: TrophyIcon, bg: 'bg-amber-100 dark:bg-amber-900/30', fg: 'text-amber-600 dark:text-amber-400' },
  [NotificationType.LevelUp]:       { icon: BoltIcon,   bg: 'bg-lime-100 dark:bg-lime-900/30',   fg: 'text-lime-700 dark:text-lime-400' },
};

/** "agora", "há 5 min", "há 2 h", "há 3 d" — datas antigas viram data curta */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diffMs / 60_000);
  if (min < 1)  return 'agora';
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Destino do clique conforme o tipo (null = sem navegação) */
function destinationFor(n: Notification): string | null {
  switch (n.type) {
    case NotificationType.FriendMessage: return n.actorId ? `/amigos/${n.actorId}/chat` : '/amigos';
    case NotificationType.GroupMessage:  return n.entityId ? `/grupos/${n.entityId}` : '/grupos';
    case NotificationType.Achievement:   return '/conquistas';
    case NotificationType.LevelUp:       return '/estatisticas';
  }
}

/** Sino de notificações com badge de não lidas e painel suspenso */
export default function NotificationBell({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, hasMore, isLoading, fetch, loadMore, markAsRead, markAllAsRead, clearAll } =
    useNotificationStore((s) => ({
      notifications: s.notifications,
      unreadCount:   s.unreadCount,
      hasMore:       s.hasMore,
      isLoading:     s.isLoading,
      fetch:         s.fetch,
      loadMore:      s.loadMore,
      markAsRead:    s.markAsRead,
      markAllAsRead: s.markAllAsRead,
      clearAll:      s.clearAll,
    }));

  // Carrega a lista ao abrir (o contador já vem do Realtime)
  useEffect(() => {
    if (open) void fetch();
  }, [open, fetch]);

  // Fecha ao clicar fora ou apertar Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleClick = (n: Notification) => {
    void markAsRead(n.id);
    const to = destinationFor(n);
    setOpen(false);
    onNavigate?.();
    if (to) navigate(to);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute left-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Notificações</p>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={() => void markAllAsRead()} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                    Marcar todas
                  </button>
                )}
                <button onClick={() => void clearAll()} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  Limpar
                </button>
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="flex justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <BellIcon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nenhuma notificação ainda</p>
                <p className="mt-1 text-xs text-gray-400">Conquistas, níveis e mensagens aparecem aqui.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {notifications.map((n) => {
                  const { icon: Icon, bg, fg } = TYPE_STYLES[n.type];
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                          n.readAt ? '' : 'bg-brand-50/60 dark:bg-brand-900/10'
                        }`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                          <Icon className={`h-4 w-4 ${fg}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm ${n.readAt ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-white'}`}>
                            {n.title}
                          </p>
                          {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{n.body}</p>}
                          <p className="mt-1 text-[11px] text-gray-400">{relativeTime(n.createdAt)}</p>
                        </div>
                        {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Não lida" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {hasMore && (
              <div className="border-t border-gray-100 p-2 text-center dark:border-gray-800">
                <button
                  onClick={() => void loadMore()}
                  disabled={isLoading}
                  className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400"
                >
                  {isLoading ? 'Carregando…' : 'Ver mais antigas'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
