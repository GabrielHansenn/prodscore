import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '../store/toastStore';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

/**
 * Host global de toasts — montado uma única vez em `App.tsx`, acima da
 * navegação. Use `showToast(message, variant)` (de `store/toastStore.ts`) de
 * qualquer tela para exibir uma notificação, sem precisar de estado local.
 *
 * Fica ancorado embaixo (como o toast do web) — o topo da tela é reservado
 * pro `GamificationPopup` (XP/conquista), pra nunca sobrepor um no outro.
 */
export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="none" style={[styles.container, { bottom: insets.bottom + SPACING.md }]}>
      {toasts.map((toast) => {
        const isError = toast.variant === 'error';
        return (
          <View key={toast.id} style={[styles.toast, isError ? styles.toastError : styles.toastSuccess]}>
            <Ionicons
              name={isError ? 'alert-circle' : 'checkmark-circle'}
              size={18}
              color={isError ? COLORS.red : COLORS.success}
            />
            <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 999,
    gap: SPACING.xs,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...CARD_SHADOW,
  },
  toastError:   { borderColor: COLORS.red },
  toastSuccess: { borderColor: COLORS.success },
  text: { flex: 1, fontSize: FONT.sm, fontWeight: '500', color: COLORS.text },
});
