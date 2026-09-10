import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getAchievements, getUserAchievements,
  type AchievementItem, type UserAchievementItem,
} from '../services/achievement.service';
import { useUserStore } from '../store/userStore';
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_ICON_FALLBACK } from '../constants/achievementIcons';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

type Filter = 'todas' | 'conquistadas' | 'bloqueadas';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas',        label: 'Todas' },
  { key: 'conquistadas', label: 'Conquistadas' },
  { key: 'bloqueadas',   label: 'Bloqueadas' },
];

function AchievementCard({ item, earned, earnedAt, progress }: {
  item: AchievementItem; earned: boolean; earnedAt?: string; progress?: number;
}) {
  const colors = useThemeColors();
  const styles = useStyles();
  const threshold = item.criteria?.threshold ?? 0;
  const hasProgress = !earned && progress !== undefined && threshold > 0;
  const pct = hasProgress ? Math.min((progress! / threshold) * 100, 100) : 0;

  return (
    <View style={[styles.card, !earned && styles.cardLocked]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, earned ? styles.iconBoxEarned : styles.iconBoxLocked]}>
          <Ionicons
            name={ACHIEVEMENT_ICONS[item.icon] ?? ACHIEVEMENT_ICON_FALLBACK}
            size={22}
            color={earned ? colors.amber : colors.textMuted}
          />
        </View>
        {earned && (
          <View style={styles.earnedBadge}>
            <Ionicons name="checkmark-circle" size={11} color={colors.amberText} />
            <Text style={styles.earnedText}>Conquistada</Text>
          </View>
        )}
      </View>
      <Text style={[styles.name, !earned && styles.textMuted]} numberOfLines={2}>{item.name}</Text>
      <Text style={[styles.desc, !earned && styles.descLocked]} numberOfLines={2}>{item.description}</Text>

      {hasProgress && (
        <View style={styles.progressBox}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.min(progress!, threshold)}/{threshold}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={[styles.pts, earned ? styles.ptsEarned : styles.textMuted]}>
          +{item.rewardPoints} pts
        </Text>
        {earned && earnedAt && (
          <Text style={styles.date}>
            {new Date(earnedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Tela de conquistas — catálogo completo com filtro e progresso, espelha /conquistas no web */
export default function AchievementsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Mesmos breakpoints sm(640)/lg(1024) usados por "sm:grid-cols-2 lg:grid-cols-3" na web
  const numColumns = width >= 1024 ? 3 : width >= 640 ? 2 : 1;
  const [catalog, setCatalog] = useState<AchievementItem[]>([]);
  const [earned,  setEarned]  = useState<UserAchievementItem[]>([]);
  const [filter,  setFilter]  = useState<Filter>('todas');
  const [loading, setLoading] = useState(true);
  const { stats, fetchStats } = useUserStore();
  const colors = useThemeColors();
  const styles = useStyles();

  useEffect(() => {
    void fetchStats();
    void (async () => {
      try {
        const [all, mine] = await Promise.all([getAchievements(), getUserAchievements()]);
        setCatalog(all);
        setEarned(mine);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const earnedMap = new Map(earned.map((e) => [e.id, e]));
  const filtered  = catalog.filter((a) => {
    if (filter === 'conquistadas') return earnedMap.has(a.id);
    if (filter === 'bloqueadas')   return !earnedMap.has(a.id);
    return true;
  });
  const earnedCount = earned.length;
  const pct = catalog.length > 0 ? Math.round((earnedCount / catalog.length) * 100) : 0;

  /** Progresso atual do usuário pro tipo de critério da conquista, quando já disponível em `stats`. */
  const progressFor = (criteriaType: string): number | undefined => {
    if (!stats) return undefined;
    switch (criteriaType) {
      case 'tasks_completed': return stats.tasksCompleted;
      case 'streak':          return stats.currentStreak;
      case 'points_earned':   return stats.totalPoints;
      case 'level_reached':   return stats.level;
      default:                return undefined;
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Conquistas</Text>
          <Text style={styles.headerSub}>Complete objetivos e desbloqueie recompensas</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          key={`cols-${numColumns}`}
          data={filtered}
          keyExtractor={(a) => a.id}
          numColumns={numColumns}
          {...(numColumns > 1 ? { columnWrapperStyle: { gap: SPACING.sm } } : {})}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              {/* Banner de progresso */}
              <View style={styles.banner}>
                <View style={styles.bannerRow}>
                  <View>
                    <Text style={styles.bannerTitle}>{earnedCount} de {catalog.length} desbloqueadas</Text>
                    <Text style={styles.bannerSub}>{pct}% concluído</Text>
                  </View>
                  <Ionicons name="trophy" size={28} color={colors.amber} />
                </View>
                <View style={styles.bannerTrack}>
                  <View style={[styles.bannerFill, { width: `${pct}%` }]} />
                </View>
              </View>

              {/* Filtros */}
              <View style={styles.filterRow}>
                {FILTERS.map((f) => {
                  const count = f.key === 'conquistadas' ? earnedCount
                    : f.key === 'bloqueadas' ? catalog.length - earnedCount
                    : catalog.length;
                  const active = filter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setFilter(f.key)}
                    >
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>
                        {f.label} {count}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          }
          renderItem={({ item }) => {
            const ua = earnedMap.get(item.id);
            const progress = progressFor(item.criteria?.type);
            return (
              <AchievementCard
                item={item}
                earned={!!ua}
                {...(ua?.earnedAt ? { earnedAt: ua.earnedAt } : {})}
                {...(progress !== undefined ? { progress } : {})}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {filter === 'conquistadas' ? 'Nenhuma conquista desbloqueada ainda' : 'Nenhum resultado'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: colors.text },
  headerSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2, maxWidth: 260 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyText: { fontSize: FONT.base, color: colors.textMuted },

  list: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },

  banner: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     'rgba(245,158,11,0.3)',
    padding:         SPACING.md,
    marginBottom:    SPACING.md,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerTitle: { fontSize: FONT.base, fontWeight: '600', color: colors.amberText },
  bannerSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },
  bannerTrack: { height: 8, borderRadius: RADIUS.sm, backgroundColor: 'rgba(245,158,11,0.15)', overflow: 'hidden', marginTop: SPACING.sm },
  bannerFill:  { height: '100%', borderRadius: RADIUS.sm, backgroundColor: colors.amber },

  filterRow: { flexDirection: 'row', gap: 4, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: SPACING.md },
  filterChip: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center' },
  filterChipActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: '#fff' },

  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     'rgba(245,158,11,0.3)',
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    ...CARD_SHADOW,
  },
  cardLocked: { borderColor: colors.borderSoft },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconBox: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBoxEarned: { backgroundColor: 'rgba(245,158,11,0.15)' },
  iconBoxLocked: { backgroundColor: colors.borderSoft },
  name: { fontSize: FONT.base, fontWeight: '700', color: colors.text, lineHeight: 18, marginTop: SPACING.sm },
  desc: { fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 15 },
  descLocked: { color: colors.textMuted },
  progressBox: { marginTop: SPACING.sm },
  progressTrack: { height: 5, borderRadius: RADIUS.sm, backgroundColor: colors.borderSoft, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: RADIUS.sm, backgroundColor: colors.amber },
  progressText: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  pts: { fontSize: 11, fontWeight: '600' },
  ptsEarned: { color: colors.amberText },
  date: { fontSize: 10, color: colors.textMuted },
  textMuted: { color: colors.textMuted },
  earnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.amberDim, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  earnedText: { fontSize: 10, fontWeight: '600', color: colors.amberText },
}));
