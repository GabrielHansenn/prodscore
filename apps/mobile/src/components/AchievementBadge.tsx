import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_ICON_FALLBACK } from '../constants/achievementIcons';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

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
  const colors = useThemeColors();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Ionicons name={ACHIEVEMENT_ICONS[badge.icon] ?? ACHIEVEMENT_ICON_FALLBACK} size={24} color={colors.amber} />
      </View>
      <Text style={styles.name} numberOfLines={2}>{badge.name}</Text>
      <Text style={styles.pts}>+{badge.rewardPoints}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
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
  name: {
    fontSize:  FONT.sm,
    color:     colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  pts: {
    fontSize:   FONT.sm,
    fontWeight: '700',
    color:      colors.amber,
  },
}));
