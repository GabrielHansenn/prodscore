import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { explainWeeklyGoal, type WeeklyGoalProgress } from '@prodscore/shared';
import { getWeeklyGoal } from '../services/adaptive.service';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface WeeklyGoalCardProps {
  /**
   * Muda quando os pontos do usuário mudam (ex: total de pontos) — recarrega
   * o progresso depois de concluir uma tarefa sem a tela precisar avisar.
   */
  refreshKey?: number;
}

/**
 * Card "Meta da semana" — gamificação adaptativa. Mostra o progresso, o bônus
 * em jogo e por que a meta é essa (calculada a partir do histórico do usuário).
 * Espelha o WeeklyGoalCard do web.
 */
export default function WeeklyGoalCard({ refreshKey }: WeeklyGoalCardProps) {
  const [goal, setGoal] = useState<WeeklyGoalProgress | null>(null);
  const colors = useThemeColors();
  const styles = useStyles();

  useEffect(() => {
    let cancelled = false;
    getWeeklyGoal()
      .then((g) => { if (!cancelled) setGoal(g); })
      // Card complementar: se falhar, simplesmente não aparece
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!goal) return null;

  const achieved  = goal.achievedAt !== null;
  const progress  = Math.min(goal.completed / goal.target, 1);
  const remaining = Math.max(0, goal.target - goal.completed);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconBox, { backgroundColor: achieved ? colors.limeText : colors.primary }]}>
            <Ionicons name={achieved ? 'checkmark-circle' : 'flag'} size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.title}>Meta da semana</Text>
            <Text style={styles.sub}>
              {achieved
                ? `Batida! +${goal.rewardPoints} pts creditados`
                : remaining === 1 ? 'Falta 1 tarefa' : `Faltam ${remaining} tarefas`}
            </Text>
          </View>
        </View>
        <View style={styles.counter}>
          <Text style={styles.count}>
            {goal.completed}<Text style={styles.countTarget}>/{goal.target}</Text>
          </Text>
          {!achieved && <Text style={styles.reward}>+{goal.rewardPoints} pts em jogo</Text>}
        </View>
      </View>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel="Progresso da meta da semana"
        accessibilityValue={{ min: 0, max: goal.target, now: Math.min(goal.completed, goal.target) }}
      >
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: achieved ? colors.lime : colors.primary },
          ]}
        />
      </View>

      <Text style={styles.explanation}>{explainWeeklyGoal(goal)}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    padding:         SPACING.md,
    marginBottom:    SPACING.lg,
    gap:             SPACING.sm,
    ...CARD_SHADOW,
  },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexShrink: 1 },
  iconBox: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  title:       { fontSize: FONT.base, fontWeight: '700', color: colors.text },
  sub:         { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },
  counter:     { alignItems: 'flex-end' },
  count:       { fontSize: FONT.xl, fontWeight: '800', color: colors.text },
  countTarget: { fontSize: FONT.md, fontWeight: '500', color: colors.textMuted },
  reward:      { fontSize: FONT.sm, fontWeight: '600', color: colors.amberText },
  track: {
    height:          8,
    borderRadius:    RADIUS.sm,
    backgroundColor: colors.border,
    overflow:        'hidden',
  },
  fill:        { height: '100%', borderRadius: RADIUS.sm },
  explanation: { fontSize: FONT.sm, color: colors.textMuted, lineHeight: 18 },
}));
