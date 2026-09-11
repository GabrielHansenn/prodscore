import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MAX_MESSAGE_LENGTH, type FriendUser, type Message } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { getFriends } from '../services/friend.service';
import { getMessages, sendMessage, markConversationRead } from '../services/message.service';
import { useIncomingMessages } from '../lib/useIncomingMessages';
import { getFriendlyErrorMessage } from '../lib/errors';
import { showToast } from '../store/toastStore';
import InlineFeedback from '../components/InlineFeedback';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AppStackParamList } from '../navigation/index';

interface Props {
  route:      { params: AppStackParamList['Chat'] };
  navigation: { goBack: () => void; navigate: (screen: 'FriendProfile', params: { userId: string; username: string }) => void };
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Chat 1:1 com um amigo — histórico via API, recebimento em tempo real via Supabase Realtime (espelha /amigos/:id/chat) */
export default function ChatScreen({ route, navigation }: Props) {
  const { userId: friendId, username } = route.params;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useStyles();
  const me = useAuthStore((s) => s.user);
  const { bump: bumpUnread, clear: clearUnread } = useChatStore((s) => ({ bump: s.bump, clear: s.clear }));

  const [friend,   setFriend]   = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore,  setHasMore]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error,    setError]    = useState('');
  const [draft,    setDraft]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  const listRef = useRef<FlatList<Message>>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    let cancelled = false;
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
        if (!cancelled) setError(getFriendlyErrorMessage(err, 'Erro ao abrir a conversa.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [friendId, clearUnread]);

  useIncomingMessages(useCallback((incoming: Message) => {
    if (incoming.senderId !== friendId) { bumpUnread(incoming.senderId); return; }
    setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
    void markConversationRead(friendId);
    clearUnread(friendId);
  }, [friendId, bumpUnread, clearUnread]));

  const loadOlder = async () => {
    if (messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await getMessages(friendId, messages[0]!.createdAt);
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Erro ao carregar mensagens anteriores.'), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
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
      showToast(getFriendlyErrorMessage(err, 'Erro ao enviar mensagem.'), 'error');
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item: m, index }: { item: Message; index: number }) => {
    const mine = m.senderId === me?.id;
    const prev = index > 0 ? messages[index - 1] : undefined;
    const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
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
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.content}</Text>
            <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{timeOf(m.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerUser}
          onPress={() => navigation.navigate('FriendProfile', { userId: friendId, username: friend?.username ?? username })}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {friend?.avatarUrl
              ? <Image source={{ uri: friend.avatarUrl }} style={styles.avatarImage} />
              : <Text style={styles.avatarLetter}>{(friend?.username ?? username).charAt(0).toUpperCase()}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{friend?.username ?? username}</Text>
            {friend && <Text style={styles.headerSub}>Nível {friend.level}</Text>}
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : error ? (
        <View style={{ padding: SPACING.md }}><InlineFeedback variant="error" message={error} /></View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => { if (stickToBottom.current) listRef.current?.scrollToEnd({ animated: messages.length > 50 }); }}
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
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhuma mensagem ainda. Diga oi para {friend?.username}!</Text>
            }
          />

          {/* Composer */}
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Escreva uma mensagem…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (sending || !draft.trim()) && { opacity: 0.5 }]}
              onPress={() => void handleSend()}
              disabled={sending || !draft.trim()}
              accessibilityLabel="Enviar"
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, paddingBottom: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.card,
  },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: { width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: FONT.md, fontWeight: '700', color: colors.primary },
  headerTitle: { fontSize: FONT.md, fontWeight: '700', color: colors.text },
  headerSub:   { fontSize: 11, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: SPACING.md, paddingBottom: SPACING.sm, gap: 4, flexGrow: 1 },
  emptyText: { color: colors.textMuted, fontSize: FONT.sm, textAlign: 'center', paddingVertical: SPACING.xl },
  loadOlder: { alignSelf: 'center', paddingVertical: SPACING.sm },
  loadOlderText: { fontSize: FONT.sm, fontWeight: '600', color: colors.primary },

  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: SPACING.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  dividerLineNew: { backgroundColor: colors.primary100 },
  dividerText: { fontSize: 10, color: colors.textMuted },
  dividerTextNew: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },

  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubbleRowMine:   { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine:   { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: FONT.base, color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 3, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: colors.borderSoft, backgroundColor: colors.card,
  },
  input: {
    flex: 1, maxHeight: 120, minHeight: 42,
    backgroundColor: colors.input, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: FONT.base, color: colors.text,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
