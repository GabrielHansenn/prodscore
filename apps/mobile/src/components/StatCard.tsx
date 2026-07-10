import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

interface StatCardProps {
  label:    string;
  value:    string | number;
  /** Tipo de destaque de cor */
  accent:   'emerald' | 'amber' | 'violet' | 'blue';
  icon?:    string;
}

const ACCENT_MAP = {
  emerald: { color: COLORS.emerald, gradient: ['rgba(52,211,153,0.18)', 'rgba(52,211,153,0.04)'] as const },
  amber:   { color: COLORS.amber,   gradient: ['rgba(251,191,36,0.18)',  'rgba(251,191,36,0.04)'] as const },
  violet:  { color: COLORS.violet,  gradient: ['rgba(167,139,250,0.18)', 'rgba(167,139,250,0.04)'] as const },
  blue:    { color: COLORS.blue,    gradient: ['rgba(96,165,250,0.18)',  'rgba(96,165,250,0.04)'] as const },
};

/** Mini card de estatística com gradiente e cor de destaque */
export default function StatCard({ label, value, accent, icon }: StatCardProps) {
  const { color, gradient } = ACCENT_MAP[accent];

  return (
    <LinearGradient
      colors={gradient}
      style={styles.card}
    >
      <View style={styles.top}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex:          1,
    borderRadius:  RADIUS.md,
    borderWidth:   1,
    borderColor:   COLORS.border,
    padding:       SPACING.md,
    minWidth:      70,
  },
  top: {
    marginBottom: SPACING.xs,
  },
  icon: {
    fontSize: 18,
  },
  value: {
    fontSize:   FONT.xl,
    fontWeight: '700',
    marginTop:  SPACING.xs,
  },
  label: {
    fontSize:  FONT.sm,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
});
