import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { levelThreshold } from '@prodscore/shared';
import { COLORS, FONT, RADIUS, SPACING, LEVEL_BAR_GRADIENT } from '../constants/theme';

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
  const pct       = Math.round(progress * 100);

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
            styles.fillWrap,
            {
              width: animWidth.interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={LEVEL_BAR_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fill}
          />
        </Animated.View>
      </View>
      <Text style={styles.pctText}>
        <Text style={styles.pctValue}>{pct}%</Text> completo
      </Text>
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
    color:    COLORS.primary400,
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
  fillWrap: {
    height: '100%',
  },
  fill: {
    flex:         1,
    borderRadius: RADIUS.sm,
  },
  pctText:  { fontSize: FONT.sm, color: COLORS.textMuted },
  pctValue: { fontSize: FONT.sm, color: COLORS.limeText, fontWeight: '600' },
});
