import { View, Text, StyleSheet } from 'react-native';
import { FONT, RADIUS, SPACING, CARD_SHADOW, type ColorPalette } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface StatCardProps {
  label:    string;
  value:    string | number;
  /** Sub-legenda opcional, como no StatCard do DashboardPage web */
  sub?:     string;
  /** Tipo de destaque de cor do valor */
  accent:   'lime' | 'amber' | 'primary' | 'blue';
  icon?:    string;
}

function getAccentColor(colors: ColorPalette) {
  return {
    lime:    colors.limeText,
    amber:   colors.amber,
    primary: colors.primary,
    blue:    colors.blue,
  };
}

/**
 * Mini card de estatística — espelha o StatCard do DashboardPage web:
 * card branco liso (sem fundo colorido no tema claro), valor grande colorido.
 */
export default function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const ACCENT_COLOR = getAccentColor(colors);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      </View>
      <Text style={[styles.value, { color: ACCENT_COLOR[accent] }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    padding:         SPACING.md,
    minWidth:        70,
    ...CARD_SHADOW,
  },
  top: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize:   FONT.sm,
    color:      colors.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize:   FONT.xl,
    fontWeight: '700',
    marginTop:  SPACING.xs,
  },
  sub: {
    fontSize:  11,
    color:     colors.textMuted,
    marginTop: 2,
  },
}));
