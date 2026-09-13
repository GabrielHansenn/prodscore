import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroupMessage, RichTextDoc } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore.js';
import {
  getGroupMessages, sendGroupMessage, uploadGroupChatImage, markGroupChatRead,
} from '../services/groupChat.service.js';
import { useGroupChatRealtime } from '../lib/useGroupChatRealtime.js';
import { useImageUpload } from '../lib/useImageUpload.js';
import { showToast } from '../store/toastStore.js';
import RichText from './RichText.js';
import RichTextEditor from './RichTextEditor.js';
import FormFeedback from './FormFeedback.js';

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Chat do grupo — texto rico + imagem, tempo real via Supabase Realtime */
export default function GroupChat({ groupId }: { groupId: string }) {
  const me = useAuthStore((s) => s.user);
  const imageUpload = useImageUpload();

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore,  setHasMore]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error,    setError]    = useState('');
  const [draft,    setDraft]    = useState<RichTextDoc | null>(null);
  const [sending,  setSending]  = useState(false);
  const [resetKey, setResetKey] = useState(0);
  /** id da primeira mensagem não lida ao abrir — divisor "Novas mensagens" */
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  const listRef   = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Carga inicial
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const page = await getGroupMessages(groupId);
        if (cancelled) return;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        // Primeira mensagem de outro membro (marcador visual da sessão)
        const firstFromOthers = page.messages.find((m) => m.sender.id !== me?.id);
        setFirstUnreadId(firstFromOthers?.id ?? null);
        await markGroupChatRead(groupId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao abrir o chat.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId, me?.id]);

  // Tempo real: o payload não traz perfil nem URL assinada, então recarrega a última página
  useGroupChatRealtime(groupId, useCallback((messageId: string) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === messageId)) return prev;
      void (async () => {
        try {
          const page = await getGroupMessages(groupId);
          setMessages(page.messages);
          setHasMore(page.hasMore);
          await markGroupChatRead(groupId);
        } catch {
          // sem toast: falha de atualização em tempo real não deve interromper a leitura
        }
      })();
      return prev;
    });
  }, [groupId]));

  useEffect(() => {
    if (!loading && stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: messages.length <= 40 ? 'auto' : 'smooth' });
    }
  }, [messages, loading]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (messages.length === 0 || loadingOlder) return;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const page = await getGroupMessages(groupId, messages[0]!.createdAt);
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar mensagens anteriores.', 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async () => {
    if (sending) return;
    const hasText  = draft !== null;
    const hasImage = imageUpload.file !== null;
    if (!hasText && !hasImage) return;

    setSending(true);
    try {
      let imagePath: string | null = null;
      if (imageUpload.file) {
        imagePath = (await uploadGroupChatImage(groupId, imageUpload.file)).imagePath;
      }
      const sent = await sendGroupMessage(groupId, { content: draft, imagePath });
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setDraft(null);
      setResetKey((k) => k + 1);
      imageUpload.clear();
      stickToBottom.current = true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar mensagem.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (error) return <div className="p-4"><FormFeedback variant="error" message={error} /></div>;

  return (
    <div className="flex h-[32rem] flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      ) : (
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
              Nenhuma mensagem ainda. Comece a conversa com o grupo!
            </p>
          )}

          {messages.map((m, i) => {
            const mine = m.sender.id === me?.id;
            const prev = messages[i - 1];
            const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
            // Agrupa mensagens seguidas do mesmo autor no mesmo minuto
            const sameAuthorBlock = prev && prev.sender.id === m.sender.id && !showDay;

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

                <div className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && (
                    <div className="w-8 shrink-0">
                      {!sameAuthorBlock && (
                        m.sender.avatarUrl ? (
                          <img src={m.sender.avatarUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                            {m.sender.username.charAt(0).toUpperCase()}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                      mine
                        ? 'rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-md bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                    }`}
                  >
                    {!mine && !sameAuthorBlock && (
                      <p className="mb-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">{m.sender.username}</p>
                    )}

                    {m.imageUrl && (
                      <a href={m.imageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={m.imageUrl}
                          alt="Imagem enviada no chat"
                          className="mb-1 max-h-64 w-full rounded-lg object-cover"
                        />
                      </a>
                    )}

                    {m.content && <RichText doc={m.content} />}

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
      )}

      {/* Compositor */}
      <div className="space-y-2 border-t border-gray-100 p-3 dark:border-gray-800">
        {imageUpload.previewUrl && (
          <div className="relative inline-block">
            <img src={imageUpload.previewUrl} alt="Prévia" className="h-20 w-20 rounded-lg object-cover" />
            <button
              type="button"
              onClick={imageUpload.clear}
              aria-label="Remover imagem"
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs text-white"
            >
              ×
            </button>
          </div>
        )}
        {imageUpload.error && <FormFeedback variant="error" message={imageUpload.error} />}

        <RichTextEditor
          onChange={setDraft}
          onSubmit={() => void handleSend()}
          placeholder="Escreva uma mensagem para o grupo…"
          disabled={sending}
          resetKey={resetKey}
        />

        <div className="flex items-center justify-between">
          <div>
            <input
              ref={imageUpload.inputRef}
              type="file"
              accept="image/*"
              onChange={imageUpload.handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageUpload.inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Imagem
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || (draft === null && imageUpload.file === null)}
            className="btn-primary px-4 py-1.5 text-sm"
          >
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
