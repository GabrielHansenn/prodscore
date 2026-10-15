import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getFriendRequests } from '../services/friend.service';
import { RADIUS } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AppStackParamList } from '../navigation/index';

/**
 * Atalho para Amigos no topo do Início, ao lado do sino, com o número de
 * pedidos de amizade esperando resposta. No web, Amigos é item da navegação
 * principal; no app ficava escondido num menu dentro do Perfil.
 */
export default function FriendsShortcut() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useThemeColors();
  const styles = useStyles();
  const [pending, setPending] = useState(0);

  // Atualiza sempre que o Início volta a aparecer (ex: depois de aceitar pedidos)
  useFocusEffect(useCallback(() => {
    let active = true;
    getFriendRequests('received')
      .then((requests) => { if (active) setPending(requests.length); })
      .catch(() => { /* o atalho continua funcionando sem o contador */ });
    return () => { active = false; };
  }, []));

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => navigation.navigate('Friends')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={pending > 0 ? `Amigos (${pending} ${pending === 1 ? 'pedido' : 'pedidos'} de amizade)` : 'Amigos'}
    >
      <Ionicons name="people-outline" size={22} color={colors.textSecondary} />
      {pending > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pending > 99 ? '99+' : pending}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  button: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft,
  },
  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
}));
