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
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

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
  const colors = useThemeColors();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.pointsRow}>
          <Ionicons name="sparkles" size={18} color={colors.lime} />
          <Text style={styles.pointsText}>+{payload.points} XP</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {payload.missionBonus?.map((m, i) => (
        <View key={i} style={styles.missionRow}>
          <Ionicons name="trophy" size={13} color={colors.amber} />
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
  const colors = useThemeColors();
  const styles = useStyles();
  return (
    <View style={[styles.card, styles.achievementCard]}>
      <View style={styles.achievementRow}>
        <View style={styles.iconGlow}>
          <View style={styles.iconBox}>
            <Ionicons name={IconComp} size={24} color={colors.amber} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.unlockedRow}>
            <Ionicons name="trophy" size={13} color={colors.amberText} />
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
          <Ionicons name="close" size={18} color={colors.textMuted} />
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
  const styles = useStyles();

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

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 999,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.primary100,
    padding:         SPACING.md,
    ...CARD_SHADOW,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  pointsText: { fontSize: FONT.lg, fontWeight: '800', color: colors.text },

  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
  missionText: { flex: 1, fontSize: 11, color: colors.textMuted },
  missionPts: { fontWeight: '700', color: colors.amberText },

  levelUpBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: SPACING.sm,
    backgroundColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 6,
  },
  levelUpText: { color: '#fff', fontWeight: '800', fontSize: FONT.sm },

  barSection: { marginTop: SPACING.sm },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  levelLabel: { fontSize: 12, fontWeight: '700', color: colors.primary },
  pctLabel:   { fontSize: 12, color: colors.textMuted },
  track: { height: 8, borderRadius: RADIUS.sm, backgroundColor: colors.borderSoft, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: RADIUS.sm, backgroundColor: colors.lime },

  achievementCard: { borderColor: colors.amberDim },
  achievementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  iconGlow: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.amberDim,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 2, borderColor: colors.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  unlockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unlockedLabel: { fontSize: 10, fontWeight: '700', color: colors.amberText, textTransform: 'uppercase', letterSpacing: 0.3 },
  achievementName: { fontSize: FONT.base, fontWeight: '800', color: colors.text, marginTop: 2 },
  achievementDesc: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  ptsPill: {
    marginTop: SPACING.xs, alignSelf: 'flex-start',
    backgroundColor: colors.amberDim, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  ptsPillText: { fontSize: 11, fontWeight: '700', color: colors.amberText },
}));
