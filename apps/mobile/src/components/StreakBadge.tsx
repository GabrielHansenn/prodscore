import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FreezeState } from '@prodscore/shared';
import { getFreezeState, armFreeze, disarmFreeze } from '../services/freeze.service';
import { getFriendlyErrorMessage } from '../lib/errors';
import { showToast } from '../store/toastStore';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface StreakBadgeProps {
  currentStreak:  number;
  longestStreak:  number;
  streakFreezes?: number;
}

/**
 * Card de sequência com o controle de freeze — espelha StreakBadge.tsx no web.
 *
 * O freeze não é automático: precisa ser ARMADO antes do dia ser perdido
 * (ver freeze.service.ts na API).
 */
export default function StreakBadge({ currentStreak, longestStreak, streakFreezes = 0 }: StreakBadgeProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const isActive = currentStreak > 0;

  const [freeze,  setFreeze]  = useState<FreezeState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getFreezeState()
      .then(({ state }) => setFreeze(state))
      .catch(() => { /* o card continua útil sem o bloco de freeze */ });
  }, [streakFreezes]);

  const handleToggleArm = async () => {
    if (!freeze || loading) return;
    setLoading(true);
    try {
      if (freeze.armedAt) {
        setFreeze(await disarmFreeze());
        showToast('Freeze desarmado.');
      } else {
        setFreeze(await armFreeze());
        showToast('Freeze armado! Seu streak está protegido por 1 dia sem tarefas.');
      }
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Não foi possível concluir a ação.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const balance    = freeze?.balance ?? streakFreezes;
  const maxBalance = freeze?.maxBalance ?? 3;
  const isArmed    = Boolean(freeze?.armedAt);
  const canArm     = isArmed || balance > 0;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconCircle, isActive ? styles.iconCircleActive : styles.iconCircleIdle]}>
          <Ionicons name={isActive ? 'flame' : 'moon'} size={22} color={isActive ? colors.amber : colors.textMuted} />
        </View>
        <View>
          <Text style={styles.label}>Sequência atual</Text>
          <Text style={[styles.value, { color: isActive ? colors.amber : colors.textMuted }]}>
            {currentStreak} <Text style={styles.unit}>{currentStreak === 1 ? 'dia' : 'dias'}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Ionicons name="trophy" size={13} color={colors.amber} />
          <Text style={styles.footerText}>
            Recorde pessoal: <Text style={styles.footerStrong}>{longestStreak} {longestStreak === 1 ? 'dia' : 'dias'}</Text>
          </Text>
        </View>

        {/* Saldo + progresso até o próximo */}
        <View style={styles.footerRow}>
          <Ionicons name="snow" size={13} color={colors.blue} />
          <Text style={styles.freezeText}>
            <Text style={styles.freezeStrong}>{balance} de {maxBalance}</Text>{' '}
            {balance === 1 ? 'freeze' : 'freezes'}
            {freeze && (
              freeze.atMaxBalance
                ? <Text style={styles.footerText}> · saldo cheio</Text>
                : freeze.daysUntilNextFreeze !== null
                  ? <Text style={styles.footerText}> · próximo em {freeze.daysUntilNextFreeze} {freeze.daysUntilNextFreeze === 1 ? 'dia' : 'dias'}</Text>
                  : <Text style={styles.footerText}> · conclua tarefas para ganhar</Text>
            )}
          </Text>
        </View>

        {/* Estado armado */}
        {isArmed && (
          <View style={styles.armedBox}>
            <Ionicons name="snow" size={13} color={colors.blue} />
            <Text style={styles.armedText}>Freeze armado — seu streak está protegido.</Text>
          </View>
        )}

        {freeze && (
          <TouchableOpacity
            style={[styles.actionBtn, isArmed ? styles.actionBtnGhost : styles.actionBtnPrimary, (loading || !canArm) && { opacity: 0.5 }]}
            onPress={() => void handleToggleArm()}
            disabled={loading || !canArm}
          >
            <Text style={[styles.actionBtnText, isArmed ? styles.actionBtnTextGhost : styles.actionBtnTextPrimary]}>
              {loading
                ? 'Aguarde…'
                : isArmed
                  ? 'Desarmar freeze'
                  : balance === 0
                    ? 'Sem freezes disponíveis'
                    : 'Armar freeze'}
            </Text>
          </TouchableOpacity>
        )}

        {!isArmed && balance > 0 && (
          <Text style={styles.hint}>
            Arme antes de ficar um dia sem concluir tarefas — o freeze não recupera dias já perdidos.
          </Text>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  iconCircleActive: { backgroundColor: 'rgba(245,158,11,0.15)' },
  iconCircleIdle:   { backgroundColor: colors.borderSoft },
  label: { fontSize: 11, color: colors.textMuted },
  value: { fontSize: FONT.xxl, fontWeight: '800' },
  unit:  { fontSize: FONT.base, fontWeight: '400' },

  footer: { marginTop: SPACING.sm, borderTopWidth: 1, borderColor: colors.borderSoft, paddingTop: SPACING.sm, gap: 5 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 11, color: colors.textMuted },
  footerStrong: { fontWeight: '700', color: colors.amberText },
  freezeText: { fontSize: 11, color: colors.blue, flex: 1 },
  freezeStrong: { fontWeight: '700', color: colors.blue },

  armedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.blueDim, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
  },
  armedText: { fontSize: 11, color: colors.blue, flex: 1 },

  actionBtn: { borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  actionBtnPrimary: { backgroundColor: colors.blue },
  actionBtnGhost:   { borderWidth: 1, borderColor: colors.border },
  actionBtnText: { fontSize: FONT.sm, fontWeight: '700' },
  actionBtnTextPrimary: { color: '#fff' },
  actionBtnTextGhost:   { color: colors.textSecondary },

  hint: { fontSize: 10, color: colors.textMuted, lineHeight: 14 },
}));
