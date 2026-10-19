import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { HelpSectionId } from '@prodscore/shared';
import { RADIUS } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AppStackParamList } from '../navigation/index';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Botão "?" do topo do Início, ao lado do sino — abre a Ajuda */
export function HelpHeaderButton() {
  const navigation = useNavigation<Nav>();
  const colors = useThemeColors();
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={() => navigation.navigate('Help')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Ajuda: como funcionam os pontos"
    >
      <Ionicons name="help-circle-outline" size={22} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

/**
 * Atalho "?" pequeno ao lado de um card ou título: abre a Ajuda já na seção
 * certa. O círculo é pequeno, mas o hitSlop deixa a área de toque com ~44px.
 */
export function HelpLink({ section, topic }: { section: HelpSectionId; topic: string }) {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={styles.link}
      onPress={() => navigation.navigate('Help', { section })}
      hitSlop={12}
      accessibilityRole="link"
      accessibilityLabel={`Ajuda: ${topic}`}
      testID={`help-link-${section}`}
    >
      <Text style={styles.linkText}>?</Text>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  headerButton: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft,
  },
  link: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  linkText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, lineHeight: 13 },
}));
