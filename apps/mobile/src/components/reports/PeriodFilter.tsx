import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import {
  REPORT_PERIOD_PRESETS, REPORT_MAX_RANGE_DAYS, reportPresetRange, reportRangeDays,
} from '@prodscore/shared';
import { maskDateBR, parseDateBR, isoToBR } from '../../lib/dateBR';
import { FONT, RADIUS, SPACING } from '../../constants/theme';
import { useThemeColors } from '../../lib/useThemeColors';
import { createThemedStyles } from '../../lib/createThemedStyles';

export interface PeriodValue {
  from:   string;
  to:     string;
  /** Atalho escolhido (7, 30, 90) ou 'custom' */
  preset: number | 'custom';
}

export function presetPeriod(days: number): PeriodValue {
  return { ...reportPresetRange(days), preset: days };
}

/** Atalhos 7/30/90 dias e intervalo personalizado (datas DD/MM/AAAA) — espelha o web */
export default function PeriodFilter({ value, onChange }: { value: PeriodValue; onChange: (p: PeriodValue) => void }) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const [fromText, setFromText] = useState(isoToBR(value.from));
  const [toText,   setToText]   = useState(isoToBR(value.to));

  const from  = parseDateBR(fromText);
  const to    = parseDateBR(toText);
  const today = reportPresetRange(1).to;
  const error = fromText.length < 10 || toText.length < 10 ? null
    : !from || !to ? 'Essa data não existe.'
    : from > to ? 'A data inicial deve ser anterior à final.'
    : to > today ? 'A data final não pode ser no futuro.'
    : reportRangeDays(from, to) > REPORT_MAX_RANGE_DAYS ? `O período pode ter no máximo ${REPORT_MAX_RANGE_DAYS} dias.`
    : null;
  const canApply = !!from && !!to && error === null;

  return (
    <View style={styles.wrap}>
      <View style={styles.chips} accessibilityRole="tablist">
        {REPORT_PERIOD_PRESETS.map((days) => {
          const active = value.preset === days;
          return (
            <TouchableOpacity
              key={days}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => { setCustomOpen(false); onChange(presetPeriod(days)); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{days} dias</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, (value.preset === 'custom' || customOpen) && styles.chipActive]}
          onPress={() => setCustomOpen((o) => !o)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value.preset === 'custom' }}
        >
          <Text style={[styles.chipText, (value.preset === 'custom' || customOpen) && styles.chipTextActive]}>Outro</Text>
        </TouchableOpacity>
      </View>

      {customOpen && (
        <View style={styles.customRow}>
          <TextInput
            style={styles.input} value={fromText} onChangeText={(t) => setFromText(maskDateBR(t))}
            keyboardType="number-pad" placeholder="De DD/MM/AAAA" placeholderTextColor={colors.textMuted}
            accessibilityLabel="Data inicial"
          />
          <TextInput
            style={styles.input} value={toText} onChangeText={(t) => setToText(maskDateBR(t))}
            keyboardType="number-pad" placeholder="Até DD/MM/AAAA" placeholderTextColor={colors.textMuted}
            accessibilityLabel="Data final"
          />
          <TouchableOpacity
            style={[styles.apply, !canApply && styles.applyDisabled]}
            disabled={!canApply}
            onPress={() => from && to && onChange({ from, to, preset: 'custom' })}
          >
            <Text style={styles.applyText}>Aplicar</Text>
          </TouchableOpacity>
        </View>
      )}
      {customOpen && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap:  { gap: SPACING.sm },
  chips: {
    flexDirection: 'row', gap: 4, padding: 4,
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border,
  },
  chip:           { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center' },
  chipActive:     { backgroundColor: colors.primary },
  chipText:       { fontSize: FONT.sm, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#fff' },
  customRow:      { flexDirection: 'row', gap: SPACING.xs, alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.input,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 8,
    fontSize: FONT.sm, color: colors.text,
  },
  apply:         { backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 9 },
  applyDisabled: { opacity: 0.5 },
  applyText:     { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
  error:         { fontSize: FONT.sm, color: colors.red },
}));
