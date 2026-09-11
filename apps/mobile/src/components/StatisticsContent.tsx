import { View, Text, StyleSheet, useWindowDimensions, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserStats } from '../store/userStore';
import LevelBar from './LevelBar';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

/** Subconjunto de UserStats que a tela exibe — atendido por /me/stats e por /users/:id/stats */
export type StatisticsData = Pick<
  UserStats,
  | 'level' | 'totalPoints' | 'pointsThisWeek' | 'tasksCompletedThisWeek' | 'consistencyRate'
  | 'currentStreak' | 'longestStreak' | 'tasksCompleted' | 'tasksTotal' | 'achievementsCount'
>;

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

/**
 * Corpo da tela de estatísticas (nível, semana, sequências, geral) —
 * usado pela tela própria (StatisticsScreen) e pelo perfil de um amigo
 * (FriendProfileScreen). Espelha StatisticsContent do web.
 */
export default function StatisticsContent({ stats }: { stats: StatisticsData }) {
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const styles = useStyles();

  // Mesmos breakpoints sm(640)/lg(1024) usados pela StatisticsPage web
  const cols3     = width >= 640 ? 3 : 1;
  const cols2     = width >= 640 ? 2 : 1;
  const colsGeral = width >= 1024 ? 4 : width >= 640 ? 2 : 1;

  const completePct = stats.tasksTotal > 0
    ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100)
    : 0;

  return (
    <>
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
      <View style={styles.grid}>
        <StatTile icon="flash"            iconBg={colors.primary} label="Pontos Ganhos"      value={stats.pointsThisWeek.toLocaleString('pt-BR')} color={colors.primary} basis={basisFor(cols3)} />
        <StatTile icon="checkmark-circle" iconBg={colors.success} label="Tarefas Concluídas" value={stats.tasksCompletedThisWeek} color={colors.success} basis={basisFor(cols3)} />
        <StatTile icon="trending-up"      iconBg={colors.blue}    label="Consistência"       value={`${Math.round(stats.consistencyRate)}%`} color={colors.blue} sub="dos dias ativos" basis={basisFor(cols3)} />
      </View>

      {/* Sequências */}
      <SectionTitle icon="flame-outline">SEQUÊNCIAS</SectionTitle>
      <View style={styles.grid}>
        <StatTile icon="flame" iconBg="rgba(245,158,11,0.2)" label="Sequência atual (dias)" value={stats.currentStreak} color={colors.amber} basis={basisFor(cols2)} />
        <StatTile icon="flame" iconBg="rgba(249,115,22,0.2)" label="Maior sequência (dias)" value={stats.longestStreak} color={colors.orange} basis={basisFor(cols2)} />
      </View>

      {/* Geral */}
      <SectionTitle icon="trophy-outline">GERAL</SectionTitle>
      <View style={styles.grid}>
        <StatTile icon="checkmark-circle" iconBg={colors.success}       label="Tarefas Concluídas" value={stats.tasksCompleted} color={colors.success} basis={basisFor(colsGeral)} />
        <StatTile icon="clipboard"        iconBg={colors.textSecondary} label="Taxa de Conclusão"  value={`${completePct}%`} color={colors.text} sub={`${stats.tasksCompleted} de ${stats.tasksTotal} tarefas`} basis={basisFor(colsGeral)} />
        <StatTile icon="trophy"           iconBg={colors.amber}         label="Conquistas"         value={stats.achievementsCount} color={colors.amber} basis={basisFor(colsGeral)} />
        <StatTile icon="flash"            iconBg={colors.primary}       label="Total de Pontos"    value={stats.totalPoints.toLocaleString('pt-BR')} color={colors.primary} basis={basisFor(colsGeral)} />
      </View>
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },

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
