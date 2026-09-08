import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

/**
 * Bloco de feedback de formulário (erro ou sucesso) — visual único reusado em
 * toda a tela, no lugar de cada componente reimplementar seu próprio estilo.
 */
export default function InlineFeedback({ variant, message }: { variant: 'error' | 'success'; message: string }) {
  const isError = variant === 'error';
  return (
    <View style={[styles.box, isError ? styles.boxError : styles.boxSuccess]}>
      <Ionicons
        name={isError ? 'alert-circle-outline' : 'checkmark-circle-outline'}
        size={16}
        color={isError ? COLORS.red : COLORS.success}
      />
      <Text style={[styles.text, { color: isError ? COLORS.red : COLORS.success }]}>{message}</Text>
    </View>
  );
}

/** Erro de um campo específico, exibido logo abaixo do input. */
export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <Text style={styles.fieldError}>{msg}</Text>;
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  boxError:   { borderColor: COLORS.red,     backgroundColor: COLORS.redDim },
  boxSuccess: { borderColor: COLORS.success, backgroundColor: COLORS.successDim },
  text:       { flex: 1, fontSize: FONT.sm },
  fieldError: { marginTop: 4, fontSize: 11, color: COLORS.red },
});
