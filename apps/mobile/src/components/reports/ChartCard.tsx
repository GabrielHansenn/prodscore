import { useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import ErrorState from '../ErrorState';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../../constants/theme';
import { useThemeColors } from '../../lib/useThemeColors';
import { createThemedStyles } from '../../lib/createThemedStyles';

interface ChartCardProps {
  title:      string;
  subtitle?:  string;
  loading:    boolean;
  error:      string | null;
  onRetry:    () => void;
  /** Sem dados no período — mostra a mensagem em vez do gráfico */
  empty:      boolean;
  emptyText?: string;
  height?:    number;
  /** Recebe a largura disponível (os gráficos do gifted-charts precisam dela) */
  children:   (width: number) => ReactNode;
}

/** Moldura dos gráficos com os estados de carregamento, erro e vazio — espelha o web */
export default function ChartCard({
  title, subtitle, loading, error, onRetry, empty, emptyText = 'Nenhum dado neste período.', height = 200, children,
}: ChartCardProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [width, setWidth] = useState(0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={[styles.body, { minHeight: height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : empty ? (
          <View style={[styles.center, styles.empty]}><Text style={styles.emptyText}>{emptyText}</Text></View>
        ) : width > 0 ? children(width) : null}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md, gap: 2, ...CARD_SHADOW,
  },
  title:     { fontSize: FONT.base, fontWeight: '700', color: colors.text },
  subtitle:  { fontSize: FONT.sm, color: colors.textMuted },
  body:      { marginTop: SPACING.sm, justifyContent: 'center' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:     { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: RADIUS.md, padding: SPACING.md },
  emptyText: { fontSize: FONT.sm, color: colors.textMuted, textAlign: 'center' },
}));
