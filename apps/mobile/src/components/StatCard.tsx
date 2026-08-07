import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

interface StatCardProps {
  label:    string;
  value:    string | number;
  /** Sub-legenda opcional, como no StatCard do DashboardPage web */
  sub?:     string;
  /** Tipo de destaque de cor do valor */
  accent:   'lime' | 'amber' | 'primary' | 'blue';
  icon?:    string;
}

const ACCENT_COLOR = {
  lime:    COLORS.limeText,
  amber:   COLORS.amber,
  primary: COLORS.primary,
  blue:    COLORS.blue,
};

/**
 * Mini card de estatística — espelha o StatCard do DashboardPage web:
 * card branco liso (sem fundo colorido no tema claro), valor grande colorido.
 */
export default function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
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

const styles = StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.borderSoft,
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
    color:      COLORS.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize:   FONT.xl,
    fontWeight: '700',
    marginTop:  SPACING.xs,
  },
  sub: {
    fontSize:  11,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
});
