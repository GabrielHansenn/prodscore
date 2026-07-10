import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import AchievementBadge, { type BadgeData } from '../components/AchievementBadge';
import LevelBar from '../components/LevelBar';
import { api } from '../services/api';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

interface PointTransaction {
  id:        string;
  amount:    number;
  reason:    string;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  task_completed:    'Tarefa concluída',
  streak_bonus:      'Bônus de sequência',
  late_penalty:      'Penalidade por atraso',
  mission_reward:    'Recompensa de missão',
  achievement_bonus: 'Bônus de conquista',
};

/** Tela de perfil com stats, conquistas e histórico de atividade */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout }         = useAuthStore();
  const { stats, fetchStats }    = useUserStore();

  const [badges,     setBadges]     = useState<BadgeData[]>([]);
  const [txs,        setTxs]        = useState<PointTransaction[]>([]);
  const [txLoading,  setTxLoading]  = useState(true);

  useEffect(() => {
    void fetchStats();
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      const [achRes, txRes] = await Promise.all([
        api.get<{ conquistas: Array<{ id: string; name: string; icon: string; rewardPoints: number; earnedAt: string }> }>('/achievements/me'),
        api.get<{ transacoes: PointTransaction[] }>('/users/me/transactions', { params: { limite: 10 } }),
      ]);
      setBadges(achRes.data.conquistas.map((a) => ({
        id:          a.id,
        name:        a.name,
        icon:        a.icon,
        rewardPoints: a.rewardPoints,
        earnedAt:    a.earnedAt,
      })));
      setTxs(txRes.data.transacoes);
    } catch {
      // Silencia — seções ficam vazias
    } finally {
      setTxLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => void logout() },
      ],
    );
  };

  if (!user) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header do perfil */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.username}>{user.username}</Text>
            <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Nível {user.level}</Text>
            </View>
          </View>
        </View>

        {/* Barra de XP */}
        {stats && (
          <View style={styles.section}>
            <LevelBar level={stats.level} totalPoints={stats.totalPoints} />
          </View>
        )}

        {/* Grid de 4 estatísticas */}
        {stats && (
          <View style={styles.statsGrid}>
            {[
              { label: 'Pontos',      value: stats.totalPoints.toLocaleString('pt-BR'), color: COLORS.emerald },
              { label: 'Nível',       value: String(stats.level),                       color: COLORS.violet  },
              { label: 'Sequência',   value: `🔥 ${stats.currentStreak}`,              color: COLORS.amber   },
              { label: 'Conquistas',  value: String(stats.achievementsCount),           color: COLORS.amber   },
            ].map((s) => (
              <View key={s.label} style={styles.statCell}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Conquistas em scroll horizontal */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minhas Conquistas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
              {badges.map((b) => (
                <AchievementBadge key={b.id} badge={b} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Atividade recente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atividade Recente</Text>
          <View style={styles.card}>
            {txLoading ? (
              <ActivityIndicator color={COLORS.emerald} size="small" style={{ padding: SPACING.lg }} />
            ) : txs.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma transação ainda.</Text>
            ) : (
              txs.map((tx, i) => (
                <View key={tx.id} style={[styles.txRow, i < txs.length - 1 && styles.txBorder]}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txLabel}>
                      {REASON_LABELS[tx.reason] ?? tx.reason}
                    </Text>
                    <Text style={styles.txDate}>
                      {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.amount >= 0 ? COLORS.emerald : COLORS.red }]}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount} pts
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Botão Sair */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },

  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  avatarCircle:  { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:  { fontSize: FONT.xxl, fontWeight: '700', color: COLORS.text },
  profileInfo:   { flex: 1, gap: 3 },
  username:      { fontSize: FONT.xl, fontWeight: '700', color: COLORS.text },
  email:         { fontSize: FONT.sm, color: COLORS.textMuted },
  levelBadge:    { alignSelf: 'flex-start', backgroundColor: COLORS.violetDim, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  levelBadgeText: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.violet },

  statsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.sm,
    marginBottom:  SPACING.lg,
  },
  statCell: {
    flex:            1,
    minWidth:        '44%',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACING.md,
    alignItems:      'center',
  },
  statValue: { fontSize: FONT.xl, fontWeight: '700' },
  statLabel: { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2 },

  section:      { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },

  badgesRow: { gap: SPACING.md, paddingRight: SPACING.md },

  card:     { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  txRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
  txBorder: { borderBottomWidth: 1, borderColor: COLORS.border },
  txLeft:   { flex: 1, gap: 2 },
  txLabel:  { fontSize: FONT.base, color: COLORS.text, fontWeight: '500' },
  txDate:   { fontSize: FONT.sm, color: COLORS.textMuted },
  txAmount: { fontSize: FONT.base, fontWeight: '700' },
  emptyText: { padding: SPACING.lg, color: COLORS.textMuted, textAlign: 'center' },

  logoutBtn:  { backgroundColor: COLORS.redDim, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm },
  logoutText: { color: COLORS.red, fontWeight: '700', fontSize: FONT.md },
});
