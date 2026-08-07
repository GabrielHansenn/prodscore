import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TaskStatus } from '@prodscore/shared';
import { useUserStore } from '../store/userStore';
import { useTaskStore } from '../store/taskStore';
import LevelBar from '../components/LevelBar';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

function StatTile({ icon, iconBg, label, value, color, sub }: {
  icon:   keyof typeof Ionicons.glyphMap;
  iconBg: string;
  label:  string;
  value:  string | number;
  color:  string;
  sub?:   string;
}) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tileValue, { color }]} numberOfLines={1}>{value}</Text>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
        {sub && <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>}
      </View>
    </View>
  );
}

function SectionTitle({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={13} color={COLORS.textMuted} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

/** Tela de estatísticas — espelha /estatisticas no web */
export default function StatisticsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const insets = useSafeAreaInsets();
  const { stats, fetchStats } = useUserStore();
  const { tasks, fetchTasks } = useTaskStore();

  useEffect(() => {
    void fetchStats();
    void fetchTasks();
  }, []);

  const completed   = tasks.filter((t) => t.status === TaskStatus.Completed).length;
  const total       = tasks.length;
  const completePct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Estatísticas</Text>
          <Text style={styles.headerSub}>Visão geral do seu desempenho</Text>
        </View>
      </View>

      {!stats ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Nível e progresso */}
          <View style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <View style={styles.levelIcon}>
                <Ionicons name="flash" size={18} color="#fff" />
              </View>
              <View>
                <Text style={styles.levelTitle}>Nível {stats.level}</Text>
                <Text style={styles.levelSub}>{stats.totalPoints.toLocaleString('pt-BR')} pontos totais</Text>
              </View>
            </View>
            <LevelBar level={stats.level} totalPoints={stats.totalPoints} />
          </View>

          {/* Esta semana */}
          <SectionTitle icon="calendar-outline">ESTA SEMANA</SectionTitle>
          <View style={styles.grid3}>
            <StatTile icon="flash"           iconBg={COLORS.primary} label="Pontos Ganhos"      value={stats.pointsThisWeek.toLocaleString('pt-BR')} color={COLORS.primary} />
            <StatTile icon="checkmark-circle" iconBg={COLORS.success} label="Tarefas Concluídas" value={stats.tasksCompletedThisWeek} color={COLORS.success} />
            <StatTile icon="trending-up"      iconBg={COLORS.blue}    label="Consistência"       value={`${Math.round(stats.consistencyRate)}%`} color={COLORS.blue} sub="dos dias ativos" />
          </View>

          {/* Sequências */}
          <SectionTitle icon="flame-outline">SEQUÊNCIAS</SectionTitle>
          <View style={styles.grid2}>
            <StatTile icon="flame" iconBg="rgba(245,158,11,0.2)" label="Sequência atual (dias)" value={stats.currentStreak} color={COLORS.amber} />
            <StatTile icon="flame" iconBg="rgba(249,115,22,0.2)" label="Maior sequência (dias)" value={stats.longestStreak} color={COLORS.orange} />
          </View>

          {/* Geral */}
          <SectionTitle icon="trophy-outline">GERAL</SectionTitle>
          <View style={styles.grid2}>
            <StatTile icon="checkmark-circle" iconBg={COLORS.success} label="Tarefas Concluídas" value={stats.tasksCompleted} color={COLORS.success} />
            <StatTile icon="clipboard"        iconBg={COLORS.textSecondary} label="Taxa de Conclusão" value={`${completePct}%`} color={COLORS.text} sub={`${completed} de ${total} tarefas`} />
            <StatTile icon="trophy"           iconBg={COLORS.amber} label="Conquistas"    value={stats.achievementsCount} color={COLORS.amber} />
            <StatTile icon="flash"            iconBg={COLORS.primary} label="Total de Pontos" value={stats.totalPoints.toLocaleString('pt-BR')} color={COLORS.primary} />
          </View>

        </ScrollView>
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
  headerSub:   { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },

  levelCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft,
    padding: SPACING.md, marginBottom: SPACING.md, ...CARD_SHADOW,
  },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  levelIcon: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  levelTitle: { fontSize: FONT.base, fontWeight: '700', color: COLORS.text },
  levelSub:   { fontSize: FONT.sm, color: COLORS.textMuted },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm, marginTop: SPACING.xs },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },

  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },

  tile: {
    flexBasis: '47%', flexGrow: 1,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  tileIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: FONT.lg, fontWeight: '800' },
  tileLabel: { fontSize: 11, color: COLORS.textMuted },
  tileSub:   { fontSize: 10, color: COLORS.textMuted },
});
