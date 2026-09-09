import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { levelThreshold } from '@prodscore/shared';
import {
  useGamificationPopupStore,
  type XpGainPayload,
  type AchievementPayload,
} from '../store/gamificationPopupStore';
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_ICON_FALLBACK } from '../constants/achievementIcons';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

const HOLD_MS_XP          = 3200; // quanto tempo o popup de XP fica visível
const HOLD_MS_ACHIEVEMENT = 4000; // conquista tem mais texto pra ler, fica um pouco mais
const FADE_MS      = 300;  // duração do fade/scale de saída
const FILL_MS      = 700;  // duração de cada fase de preenchimento da barra de XP
const LEVEL_UP_GAP = 550;  // pausa entre a barra bater 100% e resetar pro novo nível

/** Progresso (0-100) dentro de um nível, dado o total de pontos */
function progressWithinLevel(level: number, totalPoints: number): number {
  const from  = levelThreshold(level);
  const to    = levelThreshold(level + 1);
  const range = to - from;
  if (range <= 0) return 100;
  return Math.max(0, Math.min(((totalPoints - from) / range) * 100, 100));
}

function XpCard({
  payload, displayLevel, barPct, widthInterpolated, showLevelUp, onClose,
}: {
  payload: XpGainPayload;
  displayLevel: number;
  barPct: number;
  widthInterpolated: Animated.AnimatedInterpolation<string | number>;
  showLevelUp: boolean;
  onClose: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.pointsRow}>
          <Ionicons name="sparkles" size={18} color={COLORS.lime} />
          <Text style={styles.pointsText}>+{payload.points} XP</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {payload.missionBonus?.map((m, i) => (
        <View key={i} style={styles.missionRow}>
          <Ionicons name="trophy" size={13} color={COLORS.amber} />
          <Text style={styles.missionText} numberOfLines={1}>
            Missão &quot;{m.title}&quot; concluída <Text style={styles.missionPts}>+{m.points} pts</Text>
          </Text>
        </View>
      ))}

      {showLevelUp && (
        <View style={styles.levelUpBanner}>
          <Ionicons name="star" size={14} color="#fff" />
          <Text style={styles.levelUpText}>Subiu de nível!</Text>
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
  );
}

function AchievementCardPopup({ payload, onClose }: { payload: AchievementPayload; onClose: () => void }) {
  const IconComp = ACHIEVEMENT_ICONS[payload.icon] ?? ACHIEVEMENT_ICON_FALLBACK;
  return (
    <View style={[styles.card, styles.achievementCard]}>
      <View style={styles.achievementRow}>
        <View style={styles.iconGlow}>
          <View style={styles.iconBox}>
            <Ionicons name={IconComp} size={24} color={COLORS.amber} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.unlockedRow}>
            <Ionicons name="trophy" size={13} color={COLORS.amberText} />
            <Text style={styles.unlockedLabel}>Conquista desbloqueada!</Text>
          </View>
          <Text style={styles.achievementName}>{payload.name}</Text>
          <Text style={styles.achievementDesc}>{payload.description}</Text>
          {payload.rewardPoints > 0 && (
            <View style={styles.ptsPill}>
              <Text style={styles.ptsPillText}>+{payload.rewardPoints} pts</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Popup global de gamificação — montado uma vez em `App.tsx`. Consome a fila
 * única de `gamificationPopupStore.ts` (ganho de XP e conquista desbloqueada),
 * mostrando um item por vez na mesma posição da tela — nunca sobrepostos.
 */
export default function GamificationPopup() {
  const insets  = useSafeAreaInsets();
  const current = useGamificationPopupStore((s) => s.current);
  const advance = useGamificationPopupStore((s) => s.advance);

  const barAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const [displayLevel, setDisplayLevel] = useState(1);
  const [barPct,       setBarPct]       = useState(0);
  const [showLevelUp,  setShowLevelUp]  = useState(false);

  useEffect(() => {
    const id = barAnim.addListener(({ value }) => setBarPct(value));
    return () => barAnim.removeListener(id);
  }, [barAnim]);

  const close = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,    duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: FADE_MS, useNativeDriver: true }),
    ]).start(() => advance());
  };

  useEffect(() => {
    if (!current) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    fadeAnim.setValue(0);
    scaleAnim.setValue(0.92);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
    ]).start();

    if (current.kind === 'xp') {
      const xp = current.payload;
      setShowLevelUp(false);
      setDisplayLevel(xp.previousLevel);
      barAnim.setValue(progressWithinLevel(xp.previousLevel, xp.previousTotalPoints));

      if (xp.leveledUp) {
        Animated.timing(barAnim, { toValue: 100, duration: FILL_MS, useNativeDriver: false }).start();
        t(() => {
          setShowLevelUp(true);
          setDisplayLevel(xp.newLevel);
          barAnim.setValue(0);
          Animated.timing(barAnim, {
            toValue:  progressWithinLevel(xp.newLevel, xp.newTotalPoints),
            duration: FILL_MS,
            useNativeDriver: false,
          }).start();
        }, FILL_MS + LEVEL_UP_GAP);
      } else {
        Animated.timing(barAnim, {
          toValue:  progressWithinLevel(xp.newLevel, xp.newTotalPoints),
          duration: FILL_MS,
          useNativeDriver: false,
        }).start();
      }

      const totalBeforeHold = xp.leveledUp ? FILL_MS + LEVEL_UP_GAP + FILL_MS : FILL_MS;
      t(close, totalBeforeHold + HOLD_MS_XP);
    } else {
      t(close, HOLD_MS_ACHIEVEMENT);
    }

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
      style={[
        styles.container,
        { top: insets.top + SPACING.sm, opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      {current.kind === 'xp' ? (
        <XpCard
          payload={current.payload}
          displayLevel={displayLevel}
          barPct={barPct}
          widthInterpolated={widthInterpolated}
          showLevelUp={showLevelUp}
          onClose={close}
        />
      ) : (
        <AchievementCardPopup payload={current.payload} onClose={close} />
      )}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 6,
  },
  levelUpText: { color: '#fff', fontWeight: '800', fontSize: FONT.sm },

  barSection: { marginTop: SPACING.sm },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  levelLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  pctLabel:   { fontSize: 12, color: COLORS.textMuted },
  track: { height: 8, borderRadius: RADIUS.sm, backgroundColor: COLORS.borderSoft, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: RADIUS.sm, backgroundColor: COLORS.lime },

  achievementCard: { borderColor: COLORS.amberDim },
  achievementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  iconGlow: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.amberDim,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 2, borderColor: COLORS.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  unlockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unlockedLabel: { fontSize: 10, fontWeight: '700', color: COLORS.amberText, textTransform: 'uppercase', letterSpacing: 0.3 },
  achievementName: { fontSize: FONT.base, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  achievementDesc: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, lineHeight: 15 },
  ptsPill: {
    marginTop: SPACING.xs, alignSelf: 'flex-start',
    backgroundColor: COLORS.amberDim, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  ptsPillText: { fontSize: 11, fontWeight: '700', color: COLORS.amberText },
});
