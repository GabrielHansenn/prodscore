import { useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NotificationType, type Notification } from '@prodscore/shared';
import { useNotificationStore } from '../store/notificationStore';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { ColorPalette } from '../constants/theme';

interface Props {
  navigation: {
    goBack: () => void;
    navigate: (screen: 'Chat' | 'GroupDetail' | 'Achievements' | 'Statistics', params?: Record<string, unknown>) => void;
  };
}

/** Ícone por tipo de notificação */
const TYPE_ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  [NotificationType.FriendMessage]: 'chatbubble-ellipses',
  [NotificationType.GroupMessage]:  'people',
  [NotificationType.Achievement]:   'trophy',
  [NotificationType.LevelUp]:       'flash',
};

function getTypeColors(colors: ColorPalette): Record<NotificationType, string> {
  return {
    [NotificationType.FriendMessage]: colors.blue,
    [NotificationType.GroupMessage]:  colors.primary,
    [NotificationType.Achievement]:   colors.amber,
    [NotificationType.LevelUp]:       colors.limeText,
  };
}

/** "agora", "há 5 min", "há 2 h", "há 3 d" — datas antigas viram data curta */
function relativeTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1)  return 'agora';
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Central de notificações — espelha o painel do sino da web */
export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useStyles();
  const TYPE_COLORS = getTypeColors(colors);

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

  useEffect(() => { void fetch(); }, [fetch]);

  const handlePress = (n: Notification) => {
    void markAsRead(n.id);
    switch (n.type) {
      case NotificationType.FriendMessage:
        if (n.actorId) navigation.navigate('Chat', { userId: n.actorId, username: n.title });
        break;
      case NotificationType.GroupMessage:
        if (n.entityId) navigation.navigate('GroupDetail', { groupId: n.entityId, groupName: n.title });
        break;
      case NotificationType.Achievement:
        navigation.navigate('Achievements');
        break;
      case NotificationType.LevelUp:
        navigation.navigate('Statistics');
        break;
    }
  };

  const confirmClear = () => {
    Alert.alert('Limpar notificações?', 'Todo o histórico será removido.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: () => void clearAll() },
    ]);
  };

  const renderItem = ({ item: n }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.row, !n.readAt && styles.rowUnread]}
      onPress={() => handlePress(n)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${TYPE_COLORS[n.type]}22` }]}>
        <Ionicons name={TYPE_ICONS[n.type]} size={16} color={TYPE_COLORS[n.type]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, !n.readAt && styles.titleUnread]} numberOfLines={1}>{n.title}</Text>
        {n.body ? <Text style={styles.body} numberOfLines={2}>{n.body}</Text> : null}
        <Text style={styles.time}>{relativeTime(n.createdAt)}</Text>
      </View>
      {!n.readAt && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notificações</Text>
          <Text style={styles.headerSub}>
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
          </Text>
        </View>
        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={() => void markAllAsRead()} hitSlop={8}>
                <Text style={styles.headerAction}>Marcar todas</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={confirmClear} hitSlop={8}>
              <Text style={styles.headerActionMuted}>Limpar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading && notifications.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasMore && !isLoading) void loadMore(); }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={40} color={colors.primary400} />
              <Text style={styles.emptyTitle}>Nenhuma notificação ainda</Text>
              <Text style={styles.emptyHint}>Conquistas, níveis e mensagens aparecem aqui.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore && isLoading ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: SPACING.md }} /> : null
          }
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: FONT.lg, fontWeight: '800', color: colors.text },
  headerSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerAction:      { fontSize: 11, fontWeight: '600', color: colors.primary },
  headerActionMuted: { fontSize: 11, color: colors.textMuted },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.md, paddingTop: 0, gap: SPACING.xs, flexGrow: 1 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: colors.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  rowUnread: { borderColor: colors.primary100, backgroundColor: colors.primaryDim },
  iconCircle: { width: 32, height: 32, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: FONT.base, color: colors.textSecondary },
  titleUnread: { fontWeight: '700', color: colors.text },
  body:  { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },
  time:  { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },

  empty: { alignItems: 'center', paddingVertical: SPACING.xl * 2, gap: 6 },
  emptyTitle: { fontSize: FONT.base, fontWeight: '600', color: colors.textSecondary, marginTop: SPACING.xs },
  emptyHint:  { fontSize: FONT.sm, color: colors.textMuted, textAlign: 'center', paddingHorizontal: SPACING.lg },
}));
