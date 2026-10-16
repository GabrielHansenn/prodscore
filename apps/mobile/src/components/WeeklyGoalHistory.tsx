import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { explainWeeklyGoal, utcWeekStartKey, type WeeklyGoalProgress } from '@prodscore/shared';
import { getWeeklyGoalHistory } from '../services/adaptive.service';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

/** "16/06 – 22/06" a partir da segunda-feira AAAA-MM-DD (UTC) */
function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end   = new Date(start.getTime() + 6 * 86_400_000);
  const fmt   = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Histórico das últimas metas semanais (tela de Estatísticas) — espelha o web */
export default function WeeklyGoalHistory() {
  const [goals,  setGoals]  = useState<WeeklyGoalProgress[] | null>(null);
  const [failed, setFailed] = useState(false);
  const colors = useThemeColors();
  const styles = useStyles();

  useEffect(() => {
    getWeeklyGoalHistory(8)
      .then(setGoals)
      .catch(() => setFailed(true));
  }, []);

  const currentWeek = utcWeekStartKey();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="flag" size={14} color={colors.textMuted} />
        <Text style={styles.sectionTitle}>METAS SEMANAIS</Text>
      </View>

      {failed ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Não foi possível carregar o histórico de metas.</Text>
        </View>
      ) : !goals ? (
        <View style={[styles.card, styles.center]}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <View style={styles.card}>
          {goals.map((goal, i) => {
            const isCurrent = goal.weekStart === currentWeek;
            const achieved  = goal.achievedAt !== null;
            const status = achieved
              ? { text: 'Batida',       bg: colors.limeDim,    fg: colors.limeText }
              : isCurrent
                ? { text: 'Em andamento', bg: colors.primaryDim, fg: colors.primary400 }
                : { text: 'Não batida',   bg: colors.borderSoft, fg: colors.textMuted };

            return (
              <View key={goal.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={styles.rowText}>
                  <Text style={styles.week}>{isCurrent ? 'Esta semana' : weekLabel(goal.weekStart)}</Text>
                  <Text style={styles.muted}>{explainWeeklyGoal(goal)}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.count}>{goal.completed}/{goal.target}</Text>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.fg }]}>{status.text}</Text>
                  </View>
                  {achieved && <Text style={styles.reward}>+{goal.rewardPoints} pts</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  section:       { marginTop: SPACING.lg, gap: SPACING.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  sectionTitle:  { fontSize: FONT.sm, fontWeight: '600', letterSpacing: 0.8, color: colors.textMuted },
  card: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    paddingHorizontal: SPACING.md,
    ...CARD_SHADOW,
  },
  center:     { paddingVertical: SPACING.lg, alignItems: 'center' },
  row:        { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: SPACING.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  rowText:    { flex: 1, gap: 2 },
  rowRight:   { alignItems: 'flex-end', gap: 4 },
  week:       { fontSize: FONT.base, fontWeight: '600', color: colors.text },
  muted:      { fontSize: FONT.sm, color: colors.textMuted, lineHeight: 17, paddingVertical: 2 },
  count:      { fontSize: FONT.base, fontWeight: '700', color: colors.text },
  badge:      { borderRadius: 999, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  badgeText:  { fontSize: 11, fontWeight: '600' },
  reward:     { fontSize: FONT.sm, color: colors.amberText },
}));
