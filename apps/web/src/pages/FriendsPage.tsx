import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Friend, FriendRequest, FriendUser, UserSearchResult } from '@prodscore/shared';
import {
  searchUsers, getFriends, getFriendRequests,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
} from '../services/friend.service.js';
import { showToast } from '../store/toastStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useChatStore } from '../store/chatStore.js';
import { useIncomingMessages } from '../lib/useIncomingMessages.js';
import FormFeedback from '../components/FormFeedback.js';
import { UsersIcon, FlameIcon } from '../components/icons.js';

type Tab = 'friends' | 'received' | 'sent';

function Avatar({ user, size = 'md' }: { user: FriendUser; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base';
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className={`${dim} shrink-0 rounded-xl object-cover`} />
  ) : (
    <div className={`${dim} flex shrink-0 items-center justify-center rounded-xl bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300`}>
      {user.username.charAt(0).toUpperCase()}
    </div>
  );
}

function UserRow({ user, right, sub }: { user: FriendUser; right: ReactNode; sub?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{user.username}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Nível {user.level}</span>
          <span>·</span>
          <span>{user.totalPoints.toLocaleString('pt-BR')} pts</span>
          {sub}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </li>
  );
}

function SmallButton({
  children, onClick, variant = 'secondary', disabled,
}: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const base = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const styles = {
    primary:   'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
    danger:    'border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20',
  }[variant];
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

/** Página de amigos — busca, pedidos recebidos/enviados e lista de amigos */
export default function FriendsPage() {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const { unread, fetchUnread, bumpUnread } = useChatStore((s) => ({ unread: s.unread, fetchUnread: s.fetchUnread, bumpUnread: s.bump }));
  useIncomingMessages(me?.id, (m) => bumpUnread(m.senderId));
  const [tab, setTab] = useState<Tab>('friends');
  const [friends,  setFriends]  = useState<Friend[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent,     setSent]     = useState<FriendRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyIds,   setBusyIds]   = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [f, r, s] = await Promise.all([getFriends(), getFriendRequests('received'), getFriendRequests('sent')]);
      setFriends(f); setReceived(r); setSent(s);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar amigos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); void fetchUnread(); }, []);

  // Busca com debounce
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(() => {
      searchUsers(q)
        .then(setResults)
        .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Erro ao buscar usuários.', 'error'))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível concluir a ação.', 'error');
    } finally {
      setBusyIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const refreshSearch = async () => {
    if (query.trim().length >= 2) setResults(await searchUsers(query.trim()));
  };

  const handleSend = (userId: string) => withBusy(userId, async () => {
    await sendFriendRequest(userId);
    showToast('Pedido de amizade enviado!');
    await Promise.all([loadAll(), refreshSearch()]);
  });

  const handleAccept = (requestId: string) => withBusy(requestId, async () => {
    await acceptFriendRequest(requestId);
    showToast('Pedido aceito. Vocês agora são amigos!');
    await Promise.all([loadAll(), refreshSearch()]);
  });

  const handleDecline = (requestId: string) => withBusy(requestId, async () => {
    await declineFriendRequest(requestId);
    showToast('Pedido recusado.');
    await Promise.all([loadAll(), refreshSearch()]);
  });

  const handleRemove = (userId: string, message: string) => withBusy(userId, async () => {
    await removeFriend(userId);
    setConfirmRemove(null);
    showToast(message);
    await Promise.all([loadAll(), refreshSearch()]);
  });

  const renderSearchAction = (r: UserSearchResult) => {
    const busy = busyIds.has(r.user.id) || (r.friendshipId !== null && busyIds.has(r.friendshipId));
    switch (r.relation) {
      case 'none':
        return <SmallButton variant="primary" disabled={busy} onClick={() => void handleSend(r.user.id)}>Adicionar</SmallButton>;
      case 'declined_by_them':
        return <SmallButton variant="primary" disabled={busy} onClick={() => void handleSend(r.user.id)}>Enviar novamente</SmallButton>;
      case 'request_sent':
        return <SmallButton disabled={busy} onClick={() => void handleRemove(r.user.id, 'Pedido cancelado.')}>Cancelar pedido</SmallButton>;
      case 'request_received':
        return (
          <>
            <SmallButton variant="primary" disabled={busy} onClick={() => r.friendshipId && void handleAccept(r.friendshipId)}>Aceitar</SmallButton>
            <SmallButton disabled={busy} onClick={() => r.friendshipId && void handleDecline(r.friendshipId)}>Recusar</SmallButton>
          </>
        );
      case 'friends':
        return <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">Amigos</span>;
      case 'declined_by_me':
        return <span className="text-xs text-gray-400">Você recusou</span>;
    }
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'friends',  label: 'Amigos',    count: friends.length },
    { key: 'received', label: 'Recebidos', count: received.length },
    { key: 'sent',     label: 'Enviados',  count: sent.length },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Amigos</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Adicione amigos pelo nome de usuário e acompanhe o progresso deles.
        </p>
      </div>

      {/* Busca */}
      <div className="card mb-6 p-4">
        <label htmlFor="friend-search" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
          Buscar por nome de usuário
        </label>
        <input
          id="friend-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: maria_dev"
          autoComplete="off"
          className="input w-full"
        />
        {query.trim().length >= 2 && (
          <div className="mt-3">
            {searching && results.length === 0 ? (
              <p className="py-3 text-center text-xs text-gray-400">Buscando…</p>
            ) : results.length === 0 ? (
              <p className="py-3 text-center text-xs text-gray-400">Nenhum usuário encontrado com "{query.trim()}".</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                {results.map((r) => (
                  <UserRow key={r.user.id} user={r.user} right={renderSearchAction(r)} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/60">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-brand-700 shadow-sm dark:bg-gray-900 dark:text-brand-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                t.key === 'received' && tab !== t.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><FormFeedback variant="error" message={error} /></div>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
          </div>
        ) : tab === 'friends' ? (
          friends.length === 0 ? (
            <EmptyState title="Você ainda não tem amigos" hint="Use a busca acima para encontrar pessoas pelo nome de usuário." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {friends.map((f) => (
                <UserRow
                  key={f.friendshipId}
                  user={f.user}
                  sub={f.user.currentStreak > 0 ? (
                    <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                      <FlameIcon className="h-3 w-3" />{f.user.currentStreak}
                    </span>
                  ) : undefined}
                  right={
                    confirmRemove === f.user.id ? (
                      <>
                        <span className="text-xs text-gray-500">Remover?</span>
                        <SmallButton variant="danger" disabled={busyIds.has(f.user.id)} onClick={() => void handleRemove(f.user.id, 'Amizade removida.')}>Confirmar</SmallButton>
                        <SmallButton onClick={() => setConfirmRemove(null)}>Cancelar</SmallButton>
                      </>
                    ) : (
                      <>
                        <span className="relative">
                          <SmallButton variant="primary" onClick={() => navigate(`/amigos/${f.user.id}/chat`)}>Conversar</SmallButton>
                          {(unread[f.user.id] ?? 0) > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                              {unread[f.user.id]}
                            </span>
                          )}
                        </span>
                        <SmallButton onClick={() => navigate(`/amigos/${f.user.id}`)}>Ver perfil</SmallButton>
                        <SmallButton onClick={() => setConfirmRemove(f.user.id)}>Remover</SmallButton>
                      </>
                    )
                  }
                />
              ))}
            </ul>
          )
        ) : tab === 'received' ? (
          received.length === 0 ? (
            <EmptyState title="Nenhum pedido recebido" hint="Quando alguém te adicionar, o pedido aparece aqui." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {received.map((r) => (
                <UserRow
                  key={r.id}
                  user={r.requester}
                  right={
                    <>
                      <SmallButton variant="primary" disabled={busyIds.has(r.id)} onClick={() => void handleAccept(r.id)}>Aceitar</SmallButton>
                      <SmallButton disabled={busyIds.has(r.id)} onClick={() => void handleDecline(r.id)}>Recusar</SmallButton>
                    </>
                  }
                />
              ))}
            </ul>
          )
        ) : (
          sent.length === 0 ? (
            <EmptyState title="Nenhum pedido enviado" hint="Os pedidos que você enviar ficam aqui até serem respondidos." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {sent.map((r) => (
                <UserRow
                  key={r.id}
                  user={r.addressee}
                  sub={<span className="text-gray-400">· aguardando resposta</span>}
                  right={
                    <SmallButton disabled={busyIds.has(r.addressee.id)} onClick={() => void handleRemove(r.addressee.id, 'Pedido cancelado.')}>
                      Cancelar pedido
                    </SmallButton>
                  }
                />
              ))}
            </ul>
          )
        )}
      </div>
    </main>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="py-14 text-center">
      <UsersIcon className="mx-auto h-10 w-10 text-brand-300" />
      <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  );
}
