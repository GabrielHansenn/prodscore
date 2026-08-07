import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

export interface BadgeData {
  id:          string;
  name:        string;
  icon:        string;
  rewardPoints: number;
  earnedAt:    string;
}

interface AchievementBadgeProps {
  badge: BadgeData;
}

/** Badge compacto de conquista desbloqueada para o perfil do usuário */
export default function AchievementBadge({ badge }: AchievementBadgeProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{badge.icon}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>{badge.name}</Text>
      <Text style={styles.pts}>+{badge.rewardPoints}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width:          88,
    alignItems:     'center',
    gap:            SPACING.xs,
  },
  iconBox: {
    width:           56,
    height:          56,
    borderRadius:    RADIUS.lg,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth:     1,
    borderColor:     'rgba(245,158,11,0.3)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  icon: {
    fontSize: 26,
  },
  name: {
    fontSize:  FONT.sm,
    color:     COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  pts: {
    fontSize:   FONT.sm,
    fontWeight: '700',
    color:      COLORS.amber,
  },
});
