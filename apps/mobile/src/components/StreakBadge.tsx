import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface StreakBadgeProps {
  currentStreak:  number;
  longestStreak:  number;
  streakFreezes?: number;
}

/** Card de sequência com recorde pessoal — espelha StreakBadge.tsx no web */
export default function StreakBadge({ currentStreak, longestStreak, streakFreezes = 0 }: StreakBadgeProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const isActive = currentStreak > 0;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconCircle, isActive ? styles.iconCircleActive : styles.iconCircleIdle]}>
          <Ionicons name={isActive ? 'flame' : 'moon'} size={22} color={isActive ? colors.amber : colors.textMuted} />
        </View>
        <View>
          <Text style={styles.label}>Sequência atual</Text>
          <Text style={[styles.value, { color: isActive ? colors.amber : colors.textMuted }]}>
            {currentStreak} <Text style={styles.unit}>{currentStreak === 1 ? 'dia' : 'dias'}</Text>
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Ionicons name="trophy" size={13} color={colors.amber} />
          <Text style={styles.footerText}>
            Recorde pessoal: <Text style={styles.footerStrong}>{longestStreak} {longestStreak === 1 ? 'dia' : 'dias'}</Text>
          </Text>
        </View>
        {streakFreezes > 0 && (
          <View style={styles.footerRow}>
            <Text>🧊</Text>
            <Text style={styles.freezeText}>
              {streakFreezes} {streakFreezes === 1 ? 'freeze disponível' : 'freezes disponíveis'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  iconCircleActive: { backgroundColor: 'rgba(245,158,11,0.15)' },
  iconCircleIdle:   { backgroundColor: colors.borderSoft },
  label: { fontSize: 11, color: colors.textMuted },
  value: { fontSize: FONT.xxl, fontWeight: '800' },
  unit:  { fontSize: FONT.base, fontWeight: '400' },
  footer: { marginTop: SPACING.sm, borderTopWidth: 1, borderColor: colors.borderSoft, paddingTop: SPACING.sm, gap: 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 11, color: colors.textMuted },
  footerStrong: { fontWeight: '700', color: '#b45309' },
  freezeText: { fontSize: 11, color: colors.blue },
}));
