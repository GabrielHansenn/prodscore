import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../store/notificationStore';
import { RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AppStackParamList } from '../navigation/index';

/**
 * Sino com badge de não lidas — abre a tela de notificações.
 * O contador vem do store, alimentado pelo Realtime (useRealtimeNotifications).
 */
export default function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const colors = useThemeColors();
  const styles = useStyles();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => navigation.navigate('Notifications')}
      hitSlop={8}
      accessibilityLabel={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
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
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
}));

export const NOTIFICATION_BELL_GAP = SPACING.sm;
