import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MAX_MESSAGE_LENGTH, type FriendUser, type Message } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore.js';
import { useChatStore } from '../store/chatStore.js';
import { getFriends } from '../services/friend.service.js';
import { getMessages, sendMessage, markConversationRead } from '../services/message.service.js';
import { useIncomingMessages } from '../lib/useIncomingMessages.js';
import { showToast } from '../store/toastStore.js';
import FormFeedback from '../components/FormFeedback.js';

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Chat 1:1 com um amigo — histórico via API, recebimento em tempo real via Supabase Realtime */
export default function ChatPage() {
  const { id: friendId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const clearUnread = useChatStore((s) => s.clear);

  const [friend,   setFriend]   = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore,  setHasMore]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error,    setError]    = useState('');
  const [draft,    setDraft]    = useState('');
  const [sending,  setSending]  = useState(false);
  /** id da primeira mensagem não lida no momento em que a conversa foi aberta — divisor "Novas mensagens" */
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  // Carga inicial: amigo + histórico + marcar lidas
  useEffect(() => {
    if (!friendId || !me) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [friends, page] = await Promise.all([getFriends(), getMessages(friendId)]);
        if (cancelled) return;
        const f = friends.find((x) => x.user.id === friendId);
        if (!f) { setError('Vocês não são amigos — o chat só é permitido entre amigos.'); return; }
        setFriend(f.user);
        setMessages(page.messages);
        setHasMore(page.hasMore);
        const firstUnread = page.messages.find((m) => m.senderId === friendId && m.readAt === null);
        setFirstUnreadId(firstUnread?.id ?? null);
        if (firstUnread) {
          await markConversationRead(friendId);
          clearUnread(friendId);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao abrir a conversa.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [friendId, me, clearUnread]);

  // Tempo real: só mensagens deste amigo interessam aqui; as outras só atualizam o badge
  const bumpUnread = useChatStore((s) => s.bump);
  useIncomingMessages(me?.id, useCallback((incoming: Message) => {
    if (incoming.senderId !== friendId) { bumpUnread(incoming.senderId); return; }
    setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
    void markConversationRead(friendId);
    clearUnread(friendId);
  }, [friendId, bumpUnread, clearUnread]));

  // Auto-scroll quando chegam mensagens (se o usuário já estava no fim)
  useEffect(() => {
    if (!loading && stickToBottom.current) scrollToBottom(messages.length <= 50 ? 'auto' : 'smooth');
  }, [messages, loading]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (!friendId || messages.length === 0 || loadingOlder) return;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const page = await getMessages(friendId, messages[0]!.createdAt);
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
      // Mantém a posição visual após inserir acima
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar mensagens anteriores.', 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!friendId || !content || sending) return;
    if (content.length > MAX_MESSAGE_LENGTH) {
      showToast(`A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`, 'error');
      return;
    }
    setSending(true);
    try {
      const sent = await sendMessage(friendId, content);
      setMessages((prev) => [...prev, sent]);
      setDraft('');
      stickToBottom.current = true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar mensagem.', 'error');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <main className="mx-auto flex h-[calc(100vh-2rem)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      {/* Cabeçalho */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/amigos')}
          aria-label="Voltar para amigos"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        {friend && (
          <>
            {friend.avatarUrl ? (
              <img src={friend.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {friend.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <button
                onClick={() => navigate(`/amigos/${friend.id}`)}
                className="truncate text-base font-semibold text-gray-900 hover:underline dark:text-white"
              >
                {friend.username}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">Nível {friend.level}</p>
            </div>
          </>
        )}
      </div>

      {/* Mensagens */}
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
          </div>
        ) : error ? (
          <div className="p-4"><FormFeedback variant="error" message={error} /></div>
        ) : (
          <>
            <div ref={listRef} onScroll={handleScroll} className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
              {hasMore && (
                <div className="mb-2 text-center">
                  <button
                    onClick={() => void loadOlder()}
                    disabled={loadingOlder}
                    className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400"
                  >
                    {loadingOlder ? 'Carregando…' : 'Carregar mensagens anteriores'}
                  </button>
                </div>
              )}

              {messages.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">
                  Nenhuma mensagem ainda. Diga oi para {friend?.username}!
                </p>
              )}

              {messages.map((m, i) => {
                const mine = m.senderId === me?.id;
                const showDay = i === 0 || dayKey(messages[i - 1]!.createdAt) !== dayKey(m.createdAt);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="my-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                        <span className="text-[11px] text-gray-400">{dayKey(m.createdAt)}</span>
                        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                      </div>
                    )}
                    {m.id === firstUnreadId && (
                      <div className="my-2 flex items-center gap-3">
                        <div className="h-px flex-1 bg-brand-200 dark:bg-brand-800/60" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Novas mensagens</span>
                        <div className="h-px flex-1 bg-brand-200 dark:bg-brand-800/60" />
                      </div>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                          mine
                            ? 'rounded-br-md bg-brand-600 text-white'
                            : 'rounded-bl-md bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                          {timeOf(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <form onSubmit={(e) => void handleSend(e)} className="flex items-end gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
                className="input max-h-32 min-h-[42px] flex-1 resize-none py-2.5 text-sm"
              />
              <button type="submit" disabled={sending || !draft.trim()} className="btn-primary min-h-[42px] px-4" aria-label="Enviar">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
