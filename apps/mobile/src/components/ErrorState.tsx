import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface ErrorStateProps {
  /** O que não carregou, já em linguagem do usuário */
  message: string;
  /** Tenta carregar de novo; o botão mostra carregamento até a Promise terminar */
  onRetry?: () => unknown;
}

/**
 * Estado de erro padrão das telas do app — espelho do ErrorState do web.
 * Antes, falhas de carregamento apareciam como lista vazia ou carregamento
 * infinito.
 */
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try { await onRetry(); } finally { setRetrying(false); }
  };

  return (
    <View style={styles.box} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={32} color={colors.red} />
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>Verifique sua conexão e tente de novo.</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={() => void retry()} disabled={retrying} accessibilityRole="button">
          {retrying
            ? <ActivityIndicator size="small" color={colors.textSecondary} />
            : <Text style={styles.btnText}>Tentar novamente</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, gap: SPACING.xs },
  message: { fontSize: FONT.base, fontWeight: '600', color: colors.text, textAlign: 'center', marginTop: SPACING.xs },
  hint:    { fontSize: FONT.sm, color: colors.textMuted, textAlign: 'center' },
  btn: {
    marginTop: SPACING.sm, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md,
    paddingVertical: 10, paddingHorizontal: SPACING.lg, minWidth: 160, alignItems: 'center',
  },
  btnText: { fontSize: FONT.sm, fontWeight: '600', color: colors.textSecondary },
}));
