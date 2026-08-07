import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getAchievements, getUserAchievements,
  type AchievementItem, type UserAchievementItem,
} from '../services/achievement.service';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

type Filter = 'todas' | 'conquistadas' | 'bloqueadas';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas',        label: 'Todas' },
  { key: 'conquistadas', label: 'Conquistadas' },
  { key: 'bloqueadas',   label: 'Bloqueadas' },
];

function AchievementCard({ item, earned, earnedAt }: {
  item: AchievementItem; earned: boolean; earnedAt?: string;
}) {
  return (
    <View style={[styles.card, !earned && styles.cardLocked]}>
      <View style={[styles.iconBox, earned ? styles.iconBoxEarned : styles.iconBoxLocked]}>
        <Text style={styles.icon}>{item.icon}</Text>
      </View>
      <Text style={[styles.name, !earned && styles.textMuted]} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
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
      {earned && (
        <View style={styles.earnedBadge}>
          <Ionicons name="checkmark-circle" size={12} color={COLORS.amber} />
          <Text style={styles.earnedText}>Conquistada</Text>
        </View>
      )}
    </View>
  );
}

/** Tela de conquistas — catálogo completo com filtro e progresso, espelha /conquistas no web */
export default function AchievementsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const insets = useSafeAreaInsets();
  const [catalog, setCatalog] = useState<AchievementItem[]>([]);
  const [earned,  setEarned]  = useState<UserAchievementItem[]>([]);
  const [filter,  setFilter]  = useState<Filter>('todas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [all, mine] = await Promise.all([getAchievements(), getUserAchievements()]);
        setCatalog(all);
        setEarned(mine);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const earnedMap = new Map(earned.map((e) => [e.id, e]));
  const filtered  = catalog.filter((a) => {
    if (filter === 'conquistadas') return earnedMap.has(a.id);
    if (filter === 'bloqueadas')   return !earnedMap.has(a.id);
    return true;
  });
  const earnedCount = earned.length;
  const pct = catalog.length > 0 ? Math.round((earnedCount / catalog.length) * 100) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Conquistas</Text>
          <Text style={styles.headerSub}>Complete objetivos e desbloqueie recompensas</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          numColumns={2}
          columnWrapperStyle={{ gap: SPACING.sm }}
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
                  <Ionicons name="trophy" size={28} color={COLORS.amber} />
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
            return (
              <AchievementCard
                item={item}
                earned={!!ua}
                {...(ua?.earnedAt ? { earnedAt: ua.earnedAt } : {})}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="lock-closed-outline" size={40} color={COLORS.textMuted} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2, maxWidth: 260 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyText: { fontSize: FONT.base, color: COLORS.textMuted },

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
  bannerTitle: { fontSize: FONT.base, fontWeight: '600', color: '#b45309' },
  bannerSub:   { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2 },
  bannerTrack: { height: 8, borderRadius: RADIUS.sm, backgroundColor: 'rgba(245,158,11,0.15)', overflow: 'hidden', marginTop: SPACING.sm },
  bannerFill:  { height: '100%', borderRadius: RADIUS.sm, backgroundColor: COLORS.amber },

  filterRow: { flexDirection: 'row', gap: 4, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 4, marginBottom: SPACING.md },
  filterChip: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center' },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  filterTextActive: { color: '#fff' },

  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     'rgba(245,158,11,0.25)',
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    ...CARD_SHADOW,
  },
  cardLocked: { borderColor: COLORS.borderSoft, opacity: 0.7 },
  iconBox: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  iconBoxEarned: { backgroundColor: 'rgba(245,158,11,0.15)' },
  iconBoxLocked: { backgroundColor: COLORS.borderSoft },
  icon: { fontSize: 22 },
  name: { fontSize: FONT.base, fontWeight: '700', color: COLORS.text, lineHeight: 18 },
  desc: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, lineHeight: 15 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  pts: { fontSize: 11, fontWeight: '600' },
  ptsEarned: { color: '#b45309' },
  date: { fontSize: 10, color: COLORS.textMuted },
  textMuted: { color: COLORS.textMuted },
  earnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: SPACING.xs, alignSelf: 'flex-end' },
  earnedText: { fontSize: 10, fontWeight: '600', color: '#b45309' },
});
