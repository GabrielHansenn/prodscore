import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GroupMessage } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore';
import {
  getGroupMessages, sendGroupMessage, uploadGroupChatImage, markGroupChatRead,
} from '../services/groupChat.service';
import { subscribeGroupMessages } from '../lib/realtime';
import { markdownToRichText, toggleWrap, toggleListPrefix } from '../lib/markdownToRichText';
import { useImageUpload } from '../lib/useImageUpload';
import { getFriendlyErrorMessage } from '../lib/errors';
import { showToast } from '../store/toastStore';
import RichText from './RichText';
import InlineFeedback from './InlineFeedback';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Botões de formatação do compositor — espelham a barra do editor web */
const FORMAT_BUTTONS: { label: string; wrapper: string; icon: string }[] = [
  { label: 'Negrito',    wrapper: '**', icon: 'B' },
  { label: 'Itálico',    wrapper: '*',  icon: 'I' },
  { label: 'Sublinhado', wrapper: '__', icon: 'U' },
  { label: 'Tachado',    wrapper: '~~', icon: 'S' },
  { label: 'Código',     wrapper: '`',  icon: '</>' },
];

/** Chat do grupo — texto rico + imagem, tempo real via Supabase Realtime */
export default function GroupChat({ groupId }: { groupId: string }) {
  const colors = useThemeColors();
  const styles = useStyles();
  const me = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const imagePicker = useImageUpload();

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore,  setHasMore]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error,    setError]    = useState('');
  const [draft,    setDraft]    = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [sending,  setSending]  = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  const listRef = useRef<FlatList<GroupMessage>>(null);
  const stickToBottom = useRef(true);

  const reload = useCallback(async () => {
    const page = await getGroupMessages(groupId);
    setMessages(page.messages);
    setHasMore(page.hasMore);
    await markGroupChatRead(groupId);
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await getGroupMessages(groupId);
        if (cancelled) return;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        const firstFromOthers = page.messages.find((m) => m.sender.id !== me?.id);
        setFirstUnreadId(firstFromOthers?.id ?? null);
        await markGroupChatRead(groupId);
      } catch (err) {
        if (!cancelled) setError(getFriendlyErrorMessage(err, 'Erro ao abrir o chat.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId, me?.id]);

  // Tempo real
  useEffect(() => {
    if (!accessToken) return;
    try {
      return subscribeGroupMessages(groupId, accessToken, (messageId) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === messageId)) return prev;
          void reload().catch(() => { /* atualização em tempo real não interrompe a leitura */ });
          return prev;
        });
      });
    } catch (err) {
      console.warn('[GroupChat] Realtime indisponível:', err);
      return undefined;
    }
  }, [groupId, accessToken, reload]);

  const loadOlder = async () => {
    if (messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await getGroupMessages(groupId, messages[0]!.createdAt);
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Erro ao carregar mensagens anteriores.'), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const applyFormat = (wrapper: string) => {
    const result = toggleWrap(draft, selection, wrapper);
    setDraft(result.text);
    setSelection(result.selection);
  };

  const applyList = (kind: 'bullet' | 'ordered') => {
    const result = toggleListPrefix(draft, selection, kind);
    setDraft(result.text);
    setSelection(result.selection);
  };

  const handleSend = async () => {
    if (sending) return;
    const doc = markdownToRichText(draft);
    if (!doc && !imagePicker.image) return;

    setSending(true);
    try {
      let imagePath: string | null = null;
      if (imagePicker.image) {
        imagePath = (await uploadGroupChatImage(groupId, imagePicker.image)).imagePath;
      }
      const sent = await sendGroupMessage(groupId, { content: doc, imagePath });
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setDraft('');
      imagePicker.clear();
      stickToBottom.current = true;
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Erro ao enviar mensagem.'), 'error');
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item: m, index }: { item: GroupMessage; index: number }) => {
    const mine = m.sender.id === me?.id;
    const prev = index > 0 ? messages[index - 1] : undefined;
    const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
    const sameAuthorBlock = prev && prev.sender.id === m.sender.id && !showDay;

    return (
      <View>
        {showDay && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{dayKey(m.createdAt)}</Text>
            <View style={styles.dividerLine} />
          </View>
        )}
        {m.id === firstUnreadId && (
          <View style={styles.divider}>
            <View style={[styles.dividerLine, styles.dividerLineNew]} />
            <Text style={styles.dividerTextNew}>NOVAS MENSAGENS</Text>
            <View style={[styles.dividerLine, styles.dividerLineNew]} />
          </View>
        )}

        <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          {!mine && (
            <View style={styles.avatarSlot}>
              {!sameAuthorBlock && (
                m.sender.avatarUrl
                  ? <Image source={{ uri: m.sender.avatarUrl }} style={styles.avatar} />
                  : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{m.sender.username.charAt(0).toUpperCase()}</Text></View>
              )}
            </View>
          )}

          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            {!mine && !sameAuthorBlock && <Text style={styles.senderName}>{m.sender.username}</Text>}

            {m.imageUrl && <Image source={{ uri: m.imageUrl }} style={styles.messageImage} resizeMode="cover" />}

            {m.content && <RichText doc={m.content} color={mine ? '#fff' : undefined} />}

            <Text style={[styles.time, mine && styles.timeMine]}>{timeOf(m.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (error) return <View style={{ padding: SPACING.md }}><InlineFeedback variant="error" message={error} /></View>;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => { if (stickToBottom.current) listRef.current?.scrollToEnd({ animated: messages.length > 40 }); }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            stickToBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
          }}
          scrollEventThrottle={100}
          ListHeaderComponent={hasMore ? (
            <TouchableOpacity onPress={() => void loadOlder()} disabled={loadingOlder} style={styles.loadOlder}>
              <Text style={styles.loadOlderText}>{loadingOlder ? 'Carregando…' : 'Carregar mensagens anteriores'}</Text>
            </TouchableOpacity>
          ) : null}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma mensagem ainda. Comece a conversa com o grupo!</Text>}
        />
      )}

      {/* Compositor */}
      <View style={styles.composer}>
        {imagePicker.image && (
          <View style={styles.previewRow}>
            <Image source={{ uri: imagePicker.image.uri }} style={styles.preview} />
            <TouchableOpacity onPress={imagePicker.clear} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        {imagePicker.error ? <InlineFeedback variant="error" message={imagePicker.error} /> : null}

        {/* Barra de formatação — envolve a seleção na marcação equivalente à do web */}
        <View style={styles.toolbar}>
          {FORMAT_BUTTONS.map((b) => (
            <TouchableOpacity key={b.label} style={styles.toolBtn} onPress={() => applyFormat(b.wrapper)} accessibilityLabel={b.label}>
              <Text style={[styles.toolBtnText, b.label === 'Negrito' && { fontWeight: '700' }, b.label === 'Itálico' && { fontStyle: 'italic' }]}>
                {b.icon}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.toolDivider} />
          <TouchableOpacity style={styles.toolBtn} onPress={() => applyList('bullet')} accessibilityLabel="Lista com marcadores">
            <Ionicons name="list" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => applyList('ordered')} accessibilityLabel="Lista numerada">
            <Ionicons name="reorder-four-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.toolBtn} onPress={() => void imagePicker.pickFromLibrary()} accessibilityLabel="Anexar imagem">
            <Ionicons name="image-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            selection={selection}
            placeholder="Escreva uma mensagem para o grupo…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (sending || (!draft.trim() && !imagePicker.image)) && { opacity: 0.5 }]}
            onPress={() => void handleSend()}
            disabled={sending || (!draft.trim() && !imagePicker.image)}
            accessibilityLabel="Enviar"
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  // Ocupa o espaço restante da tela (o pai já reservou cabeçalho/abas)
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.sm, gap: 4, flexGrow: 1 },
  emptyText: { color: colors.textMuted, fontSize: FONT.sm, textAlign: 'center', paddingVertical: SPACING.xl },
  loadOlder: { alignSelf: 'center', paddingVertical: SPACING.sm },
  loadOlderText: { fontSize: FONT.sm, fontWeight: '600', color: colors.primary },

  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: SPACING.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  dividerLineNew: { backgroundColor: colors.primary100 },
  dividerText: { fontSize: 10, color: colors.textMuted },
  dividerTextNew: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },

  bubbleRow: { flexDirection: 'row', gap: 6, marginVertical: 2 },
  bubbleRowMine:   { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  avatarSlot: { width: 28 },
  avatar: { width: 28, height: 28, borderRadius: RADIUS.sm },
  avatarFallback: { width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 11, fontWeight: '700', color: colors.primary },

  bubble: { maxWidth: '78%', borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine:   { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderBottomLeftRadius: 6 },
  senderName: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  messageImage: { width: '100%', height: 160, borderRadius: RADIUS.md, marginBottom: 6 },
  time: { fontSize: 10, color: colors.textMuted, marginTop: 3, textAlign: 'right' },
  timeMine: { color: 'rgba(255,255,255,0.7)' },

  composer: {
    borderTopWidth: 1, borderTopColor: colors.borderSoft, backgroundColor: colors.card,
    paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm, paddingBottom: SPACING.sm, gap: SPACING.xs,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  preview: { width: 56, height: 56, borderRadius: RADIUS.md },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  toolBtn: { width: 30, height: 30, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  toolBtnText: { fontSize: 12, color: colors.textSecondary },
  toolDivider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 4 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  input: {
    flex: 1, maxHeight: 110, minHeight: 40,
    backgroundColor: colors.input, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: SPACING.md, paddingVertical: 8, fontSize: FONT.base, color: colors.text,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
