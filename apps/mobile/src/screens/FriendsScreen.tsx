import { useEffect, useState, type ReactNode } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Friend, FriendRequest, FriendUser, UserSearchResult } from '@prodscore/shared';
import {
  searchUsers, getFriends, getFriendRequests,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
} from '../services/friend.service';
import { getFriendlyErrorMessage } from '../lib/errors';
import { showToast } from '../store/toastStore';
import { useChatStore } from '../store/chatStore';
import { useIncomingMessages } from '../lib/useIncomingMessages';
import InlineFeedback from '../components/InlineFeedback';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

type Tab = 'friends' | 'received' | 'sent';

interface Props {
  navigation: {
    goBack: () => void;
    navigate: (screen: 'FriendProfile' | 'Chat', params: { userId: string; username: string }) => void;
  };
}

/** Tela de amigos — busca, pedidos recebidos/enviados e lista de amigos (espelha /amigos do web) */
export default function FriendsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useStyles();
  const { unread, fetchUnread, bumpUnread } = useChatStore((s) => ({ unread: s.unread, fetchUnread: s.fetchUnread, bumpUnread: s.bump }));
  useIncomingMessages((m) => bumpUnread(m.senderId));

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

  const loadAll = async () => {
    try {
      const [f, r, s] = await Promise.all([getFriends(), getFriendRequests('received'), getFriendRequests('sent')]);
      setFriends(f); setReceived(r); setSent(s);
      setError('');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Erro ao carregar amigos.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); void fetchUnread(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(() => {
      searchUsers(q)
        .then(setResults)
        .catch((err: unknown) => showToast(getFriendlyErrorMessage(err, 'Erro ao buscar usuários.'), 'error'))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Não foi possível concluir a ação.'), 'error');
    } finally {
      setBusyIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const refreshAll = async () => {
    await loadAll();
    if (query.trim().length >= 2) setResults(await searchUsers(query.trim()));
  };

  const handleSend    = (userId: string)    => withBusy(userId, async () => { await sendFriendRequest(userId); showToast('Pedido de amizade enviado!'); await refreshAll(); });
  const handleAccept  = (requestId: string) => withBusy(requestId, async () => { await acceptFriendRequest(requestId); showToast('Pedido aceito. Vocês agora são amigos!'); await refreshAll(); });
  const handleDecline = (requestId: string) => withBusy(requestId, async () => { await declineFriendRequest(requestId); showToast('Pedido recusado.'); await refreshAll(); });
  const handleCancel  = (userId: string)    => withBusy(userId, async () => { await removeFriend(userId); showToast('Pedido cancelado.'); await refreshAll(); });

  const handleRemove = (user: FriendUser) => {
    Alert.alert(
      `Remover ${user.username}?`,
      'Vocês deixarão de ser amigos. Você pode enviar um novo pedido depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: () => void withBusy(user.id, async () => { await removeFriend(user.id); showToast('Amizade removida.'); await refreshAll(); }),
        },
      ],
    );
  };

  const renderSearchAction = (r: UserSearchResult): ReactNode => {
    const busy = busyIds.has(r.user.id) || (r.friendshipId !== null && busyIds.has(r.friendshipId));
    switch (r.relation) {
      case 'none':
        return <SmallButton label="Adicionar" variant="primary" disabled={busy} onPress={() => void handleSend(r.user.id)} />;
      case 'declined_by_them':
        return <SmallButton label="Enviar novamente" variant="primary" disabled={busy} onPress={() => void handleSend(r.user.id)} />;
      case 'request_sent':
        return <SmallButton label="Cancelar" disabled={busy} onPress={() => void handleCancel(r.user.id)} />;
      case 'request_received':
        return (
          <>
            <SmallButton label="Aceitar" variant="primary" disabled={busy} onPress={() => r.friendshipId && void handleAccept(r.friendshipId)} />
            <SmallButton label="Recusar" disabled={busy} onPress={() => r.friendshipId && void handleDecline(r.friendshipId)} />
          </>
        );
      case 'friends':
        return <View style={styles.badgeFriends}><Text style={styles.badgeFriendsText}>Amigos</Text></View>;
      case 'declined_by_me':
        return <Text style={styles.mutedNote}>Você recusou</Text>;
    }
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'friends',  label: 'Amigos',    count: friends.length },
    { key: 'received', label: 'Recebidos', count: received.length },
    { key: 'sent',     label: 'Enviados',  count: sent.length },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Amigos</Text>
          <Text style={styles.headerSub}>Adicione amigos pelo nome de usuário</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Busca */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Buscar por nome de usuário</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Ex: maria_dev"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {query.trim().length >= 2 && (
            <View style={styles.resultsBox}>
              {searching && results.length === 0 ? (
                <Text style={styles.mutedCenter}>Buscando…</Text>
              ) : results.length === 0 ? (
                <Text style={styles.mutedCenter}>Nenhum usuário encontrado com "{query.trim()}".</Text>
              ) : (
                results.map((r, i) => (
                  <UserRow key={r.user.id} user={r.user} right={renderSearchAction(r)} last={i === results.length - 1} />
                ))
              )}
            </View>
          )}
        </View>

        {/* Abas */}
        <View style={styles.tabRow}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                {t.count > 0 && (
                  <View style={[styles.tabCount, t.key === 'received' && !active && styles.tabCountAlert]}>
                    <Text style={[styles.tabCountText, t.key === 'received' && !active && styles.tabCountAlertText]}>{t.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <InlineFeedback variant="error" message={error} /> : null}

        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: SPACING.xl }} />
          ) : tab === 'friends' ? (
            friends.length === 0 ? (
              <EmptyState title="Você ainda não tem amigos" hint="Use a busca acima para encontrar pessoas pelo nome de usuário." />
            ) : friends.map((f, i) => (
              <UserRow
                key={f.friendshipId}
                user={f.user}
                showStreak
                last={i === friends.length - 1}
                onPress={() => navigation.navigate('FriendProfile', { userId: f.user.id, username: f.user.username })}
                right={
                  <>
                    <TouchableOpacity
                      style={styles.chatBtn}
                      onPress={() => navigation.navigate('Chat', { userId: f.user.id, username: f.user.username })}
                      hitSlop={6}
                      accessibilityLabel={`Conversar com ${f.user.username}`}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                      {(unread[f.user.id] ?? 0) > 0 && (
                        <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{unread[f.user.id]}</Text></View>
                      )}
                    </TouchableOpacity>
                    <SmallButton label="Remover" disabled={busyIds.has(f.user.id)} onPress={() => handleRemove(f.user)} />
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </>
                }
              />
            ))
          ) : tab === 'received' ? (
            received.length === 0 ? (
              <EmptyState title="Nenhum pedido recebido" hint="Quando alguém te adicionar, o pedido aparece aqui." />
            ) : received.map((r, i) => (
              <UserRow
                key={r.id}
                user={r.requester}
                last={i === received.length - 1}
                right={
                  <>
                    <SmallButton label="Aceitar" variant="primary" disabled={busyIds.has(r.id)} onPress={() => void handleAccept(r.id)} />
                    <SmallButton label="Recusar" disabled={busyIds.has(r.id)} onPress={() => void handleDecline(r.id)} />
                  </>
                }
              />
            ))
          ) : (
            sent.length === 0 ? (
              <EmptyState title="Nenhum pedido enviado" hint="Os pedidos que você enviar ficam aqui até serem respondidos." />
            ) : sent.map((r, i) => (
              <UserRow
                key={r.id}
                user={r.addressee}
                note="aguardando resposta"
                last={i === sent.length - 1}
                right={<SmallButton label="Cancelar" disabled={busyIds.has(r.addressee.id)} onPress={() => void handleCancel(r.addressee.id)} />}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function UserRow({ user, right, note, showStreak, last, onPress }: {
  user: FriendUser; right: ReactNode; note?: string; showStreak?: boolean; last?: boolean; onPress?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        {user.avatarUrl
          ? <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          : <Text style={styles.avatarLetter}>{user.username.charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.username} numberOfLines={1}>{user.username}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Nível {user.level} · {user.totalPoints.toLocaleString('pt-BR')} pts</Text>
          {showStreak && user.currentStreak > 0 && (
            <View style={styles.streak}>
              <Ionicons name="flame" size={11} color={colors.amber} />
              <Text style={styles.streakText}>{user.currentStreak}</Text>
            </View>
          )}
          {note ? <Text style={styles.meta}>· {note}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>{right}</View>
    </TouchableOpacity>
  );
}

function SmallButton({ label, onPress, variant = 'secondary', disabled }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={[styles.smallBtn, variant === 'primary' && styles.smallBtnPrimary, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.smallBtnText, variant === 'primary' && styles.smallBtnTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  const colors = useThemeColors();
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Ionicons name="people-outline" size={36} color={colors.primary400} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  headerTitle: { fontSize: FONT.lg, fontWeight: '800', color: colors.text },
  headerSub:   { fontSize: FONT.sm, color: colors.textMuted },
  scroll: { padding: SPACING.md, paddingTop: 0, paddingBottom: SPACING.xl, gap: SPACING.md },

  card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft, padding: SPACING.md, ...CARD_SHADOW },
  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: colors.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: FONT.base, color: colors.text, paddingVertical: 2 },
  resultsBox: { marginTop: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderSoft, overflow: 'hidden' },
  mutedCenter: { fontSize: FONT.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: SPACING.md },
  mutedNote: { fontSize: 11, color: colors.textMuted },

  tabRow: { flexDirection: 'row', gap: 4, backgroundColor: colors.borderSoft, borderRadius: RADIUS.lg, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: RADIUS.md },
  tabActive: { backgroundColor: colors.card, ...CARD_SHADOW },
  tabText: { fontSize: FONT.sm, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabCount: { backgroundColor: colors.border, borderRadius: RADIUS.xl, paddingHorizontal: 6, paddingVertical: 1 },
  tabCountText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  tabCountAlert: { backgroundColor: colors.primary },
  tabCountAlertText: { color: '#fff' },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xs },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  avatar: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: FONT.md, fontWeight: '700', color: colors.primary },
  username: { fontSize: FONT.base, fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  meta: { fontSize: 11, color: colors.textMuted },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  streakText: { fontSize: 11, fontWeight: '600', color: colors.amber },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  smallBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  smallBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  smallBtnText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  smallBtnTextPrimary: { color: '#fff' },

  chatBtn: { padding: 6, borderRadius: RADIUS.md, backgroundColor: colors.primaryDim },
  unreadBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  unreadBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  badgeFriends: { backgroundColor: colors.successDim, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  badgeFriendsText: { fontSize: 11, fontWeight: '600', color: colors.success },

  empty: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 6 },
  emptyTitle: { fontSize: FONT.base, fontWeight: '600', color: colors.textSecondary, marginTop: SPACING.xs },
  emptyHint: { fontSize: FONT.sm, color: colors.textMuted, textAlign: 'center', paddingHorizontal: SPACING.lg },
}));
