import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TaskStatus } from '@prodscore/shared';
import { useUserStore } from '../store/userStore';
import { useTaskStore } from '../store/taskStore';
import LevelBar from '../components/LevelBar';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

/** Largura de cada tile por nº de colunas — espelha os breakpoints sm/lg do Tailwind na web */
function basisFor(cols: number): { flexBasis: DimensionValue } {
  return { flexBasis: cols === 1 ? '100%' : cols === 2 ? '48%' : cols === 3 ? '31%' : '22%' };
}

function StatTile({ icon, iconBg, label, value, color, sub, basis }: {
  icon:   keyof typeof Ionicons.glyphMap;
  iconBg: string;
  label:  string;
  value:  string | number;
  color:  string;
  sub?:   string;
  basis:  { flexBasis: DimensionValue };
}) {
  const styles = useStyles();
  return (
    <View style={[styles.tile, basis]}>
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
  const colors = useThemeColors();
  const styles = useStyles();
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

/** Tela de estatísticas — espelha /estatisticas no web */
export default function StatisticsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { stats, fetchStats } = useUserStore();
  const { tasks, fetchTasks } = useTaskStore();
  const colors = useThemeColors();
  const styles = useStyles();

  useEffect(() => {
    void fetchStats();
    void fetchTasks();
  }, []);

  // Mesmos breakpoints sm(640)/lg(1024) usados pela StatisticsPage web
  const cols3     = width >= 640 ? 3 : 1;
  const cols2     = width >= 640 ? 2 : 1;
  const colsGeral = width >= 1024 ? 4 : width >= 640 ? 2 : 1;

  const completed   = tasks.filter((t) => t.status === TaskStatus.Completed).length;
  const total       = tasks.length;
  const completePct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Estatísticas</Text>
          <Text style={styles.headerSub}>Visão geral do seu desempenho</Text>
        </View>
      </View>

      {!stats ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
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
            <StatTile icon="flash"           iconBg={colors.primary} label="Pontos Ganhos"      value={stats.pointsThisWeek.toLocaleString('pt-BR')} color={colors.primary} basis={basisFor(cols3)} />
            <StatTile icon="checkmark-circle" iconBg={colors.success} label="Tarefas Concluídas" value={stats.tasksCompletedThisWeek} color={colors.success} basis={basisFor(cols3)} />
            <StatTile icon="trending-up"      iconBg={colors.blue}    label="Consistência"       value={`${Math.round(stats.consistencyRate)}%`} color={colors.blue} sub="dos dias ativos" basis={basisFor(cols3)} />
          </View>

          {/* Sequências */}
          <SectionTitle icon="flame-outline">SEQUÊNCIAS</SectionTitle>
          <View style={styles.grid2}>
            <StatTile icon="flame" iconBg="rgba(245,158,11,0.2)" label="Sequência atual (dias)" value={stats.currentStreak} color={colors.amber} basis={basisFor(cols2)} />
            <StatTile icon="flame" iconBg="rgba(249,115,22,0.2)" label="Maior sequência (dias)" value={stats.longestStreak} color={colors.orange} basis={basisFor(cols2)} />
          </View>

          {/* Geral */}
          <SectionTitle icon="trophy-outline">GERAL</SectionTitle>
          <View style={styles.grid2}>
            <StatTile icon="checkmark-circle" iconBg={colors.success} label="Tarefas Concluídas" value={stats.tasksCompleted} color={colors.success} basis={basisFor(colsGeral)} />
            <StatTile icon="clipboard"        iconBg={colors.textSecondary} label="Taxa de Conclusão" value={`${completePct}%`} color={colors.text} sub={`${completed} de ${total} tarefas`} basis={basisFor(colsGeral)} />
            <StatTile icon="trophy"           iconBg={colors.amber} label="Conquistas"    value={stats.achievementsCount} color={colors.amber} basis={basisFor(colsGeral)} />
            <StatTile icon="flash"            iconBg={colors.primary} label="Total de Pontos" value={stats.totalPoints.toLocaleString('pt-BR')} color={colors.primary} basis={basisFor(colsGeral)} />
          </View>

        </ScrollView>
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
  headerSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },

  levelCard: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md, marginBottom: SPACING.md, ...CARD_SHADOW,
  },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  levelIcon: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  levelTitle: { fontSize: FONT.base, fontWeight: '700', color: colors.text },
  levelSub:   { fontSize: FONT.sm, color: colors.textMuted },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm, marginTop: SPACING.xs },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },

  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },

  tile: {
    flexGrow: 1,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  tileIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: FONT.lg, fontWeight: '800' },
  tileLabel: { fontSize: 11, color: colors.textMuted },
  tileSub:   { fontSize: 10, color: colors.textMuted },
}));
