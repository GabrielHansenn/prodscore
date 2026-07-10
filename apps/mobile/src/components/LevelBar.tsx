import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { levelThreshold } from '@prodscore/shared';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

interface LevelBarProps {
  level:       number;
  totalPoints: number;
}

/** Barra de progresso animada mostrando XP para o próximo nível */
export default function LevelBar({ level, totalPoints }: LevelBarProps) {
  const current   = levelThreshold(level);
  const next      = levelThreshold(level + 1);
  const progress  = Math.max(0, Math.min((totalPoints - current) / (next - current), 1));
  const xpCurrent = Math.max(0, totalPoints - current);
  const xpNeeded  = next - current;

  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animWidth, {
      toValue:         progress,
      useNativeDriver: false,
      tension:         60,
      friction:        8,
    }).start();
  }, [progress]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.levelText}>Nível {level}</Text>
        <Text style={styles.xpText}>{xpCurrent} / {xpNeeded} XP</Text>
        <Text style={styles.levelText}>Nível {level + 1}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: animWidth.interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  levelText: {
    fontSize: FONT.sm,
    color:    COLORS.violet,
    fontWeight: '600',
  },
  xpText: {
    fontSize: FONT.sm,
    color:    COLORS.textMuted,
  },
  track: {
    height:          8,
    borderRadius:    RADIUS.sm,
    backgroundColor: COLORS.border,
    overflow:        'hidden',
  },
  fill: {
    height:          '100%',
    borderRadius:    RADIUS.sm,
    backgroundColor: COLORS.violet,
  },
});
