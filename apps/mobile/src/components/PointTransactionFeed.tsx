import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PointReason, type PointTransaction } from '@prodscore/shared';
import { FONT, RADIUS, SPACING, type ColorPalette } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface PointTransactionFeedProps {
  transactions: PointTransaction[];
}

const REASON_LABELS: Record<PointReason, string> = {
  [PointReason.TaskCompleted]:    'Tarefa concluída',
  [PointReason.StreakBonus]:      'Bônus de sequência',
  [PointReason.LatePenalty]:      'Penalidade por atraso',
  [PointReason.MissionReward]:    'Recompensa de missão',
  [PointReason.AchievementBonus]: 'Conquista desbloqueada',
  [PointReason.FreezeShop]:       'Compra de freeze',
  [PointReason.LevelReward]:      'Recompensa de nível',
};

const REASON_ICONS: Record<PointReason, keyof typeof Ionicons.glyphMap> = {
  [PointReason.TaskCompleted]:    'checkmark-circle',
  [PointReason.StreakBonus]:      'flame',
  [PointReason.LatePenalty]:      'warning',
  [PointReason.MissionReward]:    'flag',
  [PointReason.AchievementBonus]: 'trophy',
  [PointReason.FreezeShop]:       'snow',
  [PointReason.LevelReward]:      'flash',
};

function getReasonColors(colors: ColorPalette): Record<PointReason, string> {
  return {
    [PointReason.TaskCompleted]:    colors.success,
    [PointReason.StreakBonus]:      colors.amber,
    [PointReason.LatePenalty]:      colors.red,
    [PointReason.MissionReward]:    colors.primary,
    [PointReason.AchievementBonus]: colors.amber,
    [PointReason.FreezeShop]:       colors.blue,
    [PointReason.LevelReward]:      colors.primary,
  };
}

/** Feed de transações de pontos — espelha PointTransactionFeed.tsx no web */
export default function PointTransactionFeed({ transactions }: PointTransactionFeedProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const REASON_COLORS = getReasonColors(colors);

  if (transactions.length === 0) {
    return <Text style={styles.empty}>Nenhuma transação ainda</Text>;
  }

  return (
    <View style={{ gap: SPACING.xs }}>
      {transactions.map((tx) => (
        <View key={tx.id} style={styles.row}>
          <View style={styles.left}>
            <Ionicons name={REASON_ICONS[tx.reason]} size={14} color={REASON_COLORS[tx.reason]} />
            <Text style={styles.label}>{REASON_LABELS[tx.reason]}</Text>
          </View>
          <Text style={[styles.amount, { color: tx.amount >= 0 ? colors.success : colors.red }]}>
            {tx.amount >= 0 ? '+' : ''}{tx.amount} pts
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: FONT.sm, paddingVertical: SPACING.md },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.background, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 11, color: colors.textSecondary },
  amount: { fontSize: FONT.sm, fontWeight: '700' },
}));
