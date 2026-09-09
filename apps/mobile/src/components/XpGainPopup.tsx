import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { levelThreshold } from '@prodscore/shared';
import { useXpPopupStore } from '../store/xpPopupStore';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

const HOLD_MS      = 3200; // quanto tempo o popup fica visível antes de sumir
const FADE_MS      = 300;  // duração do fade-out
const FILL_MS      = 700;  // duração de cada fase de preenchimento da barra
const LEVEL_UP_GAP = 550;  // pausa entre a barra bater 100% e resetar pro novo nível

/** Progresso (0-100) dentro de um nível, dado o total de pontos */
function progressWithinLevel(level: number, totalPoints: number): number {
  const from  = levelThreshold(level);
  const to    = levelThreshold(level + 1);
  const range = to - from;
  if (range <= 0) return 100;
  return Math.max(0, Math.min(((totalPoints - from) / range) * 100, 100));
}

/**
 * Popup global de ganho de XP — montado uma vez em `App.tsx`. Disparado via
 * `showXpGain()` (store/xpPopupStore.ts) depois de concluir uma tarefa ou
 * missão. Anima a barra do nível anterior pro novo; se houve level up, enche
 * até 100%, destaca "Subiu de nível!" e continua a partir de 0 no novo nível.
 */
export default function XpGainPopup() {
  const insets  = useSafeAreaInsets();
  const current = useXpPopupStore((s) => s.current);
  const dismiss = useXpPopupStore((s) => s.dismiss);

  const barAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [displayLevel, setDisplayLevel] = useState(1);
  const [barPct,       setBarPct]       = useState(0);
  const [showLevelUp,  setShowLevelUp]  = useState(false);

  useEffect(() => {
    const id = barAnim.addListener(({ value }) => setBarPct(value));
    return () => barAnim.removeListener(id);
  }, [barAnim]);

  const closeNow = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: FADE_MS, useNativeDriver: true })
      .start(() => dismiss());
  };

  useEffect(() => {
    if (!current) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    setShowLevelUp(false);
    setDisplayLevel(current.previousLevel);
    barAnim.setValue(progressWithinLevel(current.previousLevel, current.previousTotalPoints));
    fadeAnim.setValue(1);

    if (current.leveledUp) {
      // Fase 1: enche até 100% no nível antigo
      Animated.timing(barAnim, { toValue: 100, duration: FILL_MS, useNativeDriver: false }).start();
      // Fase 2: destaque de level up + reset instantâneo pro novo nível
      t(() => {
        setShowLevelUp(true);
        setDisplayLevel(current.newLevel);
        barAnim.setValue(0);
        // Fase 3: enche a partir de 0 no novo nível
        Animated.timing(barAnim, {
          toValue:  progressWithinLevel(current.newLevel, current.newTotalPoints),
          duration: FILL_MS,
          useNativeDriver: false,
        }).start();
      }, FILL_MS + LEVEL_UP_GAP);
    } else {
      Animated.timing(barAnim, {
        toValue:  progressWithinLevel(current.newLevel, current.newTotalPoints),
        duration: FILL_MS,
        useNativeDriver: false,
      }).start();
    }

    const totalBeforeHold = current.leveledUp ? FILL_MS + LEVEL_UP_GAP + FILL_MS : FILL_MS;
    t(closeNow, totalBeforeHold + HOLD_MS);

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  const widthInterpolated = barAnim.interpolate({
    inputRange:  [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { top: insets.top + SPACING.sm, opacity: fadeAnim }]}
    >
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.pointsRow}>
            <Ionicons name="sparkles" size={18} color={COLORS.lime} />
            <Text style={styles.pointsText}>+{current.points} XP</Text>
          </View>
          <TouchableOpacity onPress={closeNow} hitSlop={8}>
            <Ionicons name="close" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {current.missionBonus?.map((m, i) => (
          <View key={i} style={styles.missionRow}>
            <Ionicons name="trophy" size={13} color={COLORS.amber} />
            <Text style={styles.missionText} numberOfLines={1}>
              Missão &quot;{m.title}&quot; concluída <Text style={styles.missionPts}>+{m.points} pts</Text>
            </Text>
          </View>
        ))}

        {showLevelUp && (
          <View style={styles.levelUpBanner}>
            <Text style={styles.levelUpText}>🎉 Subiu de nível!</Text>
          </View>
        )}

        <View style={styles.barSection}>
          <View style={styles.barLabelRow}>
            <Text style={styles.levelLabel}>Nível {displayLevel}</Text>
            <Text style={styles.pctLabel}>{Math.round(barPct)}%</Text>
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: widthInterpolated }]} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 999,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.primary100,
    padding:         SPACING.md,
    ...CARD_SHADOW,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  pointsText: { fontSize: FONT.lg, fontWeight: '800', color: COLORS.text },

  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
  missionText: { flex: 1, fontSize: 11, color: COLORS.textMuted },
  missionPts: { fontWeight: '700', color: COLORS.amberText },

  levelUpBanner: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 6,
    alignItems: 'center',
  },
  levelUpText: { color: '#fff', fontWeight: '800', fontSize: FONT.sm },

  barSection: { marginTop: SPACING.sm },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  levelLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  pctLabel:   { fontSize: 12, color: COLORS.textMuted },
  track: { height: 8, borderRadius: RADIUS.sm, backgroundColor: COLORS.borderSoft, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: RADIUS.sm, backgroundColor: COLORS.lime },
});
