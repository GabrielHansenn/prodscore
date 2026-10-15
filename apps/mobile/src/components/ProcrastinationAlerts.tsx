import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { localDateKey, type ProcrastinationAlert, type ProcrastinationAlertType } from '@prodscore/shared';
import { getProcrastinationAlerts } from '../services/behavioral.service';
import * as Storage from '../lib/storage';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

/** Chave do dia: os alertas fechados hoje voltam amanhã */
const storageKey = () => `prodscore.alertas-dispensados.${localDateKey()}`;

async function loadDismissed(): Promise<Set<ProcrastinationAlertType>> {
  try {
    const raw = await Storage.getItemAsync(storageKey());
    return new Set(raw ? (JSON.parse(raw) as ProcrastinationAlertType[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * Alertas de procrastinação no Início do app — espelho dos alertas do
 * Início do web, que o app não tinha. Cada alerta fecha até o dia seguinte.
 */
export default function ProcrastinationAlerts() {
  const colors = useThemeColors();
  const styles = useStyles();
  const [alerts,    setAlerts]    = useState<ProcrastinationAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<ProcrastinationAlertType>>(new Set());

  // Recarrega ao voltar para o Início (tarefas podem ter sido concluídas)
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([getProcrastinationAlerts().catch(() => []), loadDismissed()])
      .then(([list, done]) => {
        if (!active) return;
        setAlerts(list);
        setDismissed(done);
      });
    return () => { active = false; };
  }, []));

  const dismiss = (type: ProcrastinationAlertType) => {
    const next = new Set(dismissed).add(type);
    setDismissed(next);
    void Storage.setItemAsync(storageKey(), JSON.stringify([...next])).catch(() => { /* vale até fechar o app */ });
  };

  const visible = alerts.filter((a) => !dismissed.has(a.type));
  if (visible.length === 0) return null;

  return (
    <View style={styles.list}>
      {visible.map((alert) => {
        const critical = alert.severity === 'critical';
        const fg = critical ? colors.red : colors.amberText;
        return (
          <View key={alert.type} style={[styles.alert, { backgroundColor: critical ? colors.redDim : colors.amberDim }]}>
            <Ionicons name="warning-outline" size={18} color={fg} style={styles.icon} />
            <View style={styles.body}>
              <Text style={[styles.message, { color: fg }]}>{alert.message}</Text>
              {alert.taskTitles.length > 0 && (
                <Text style={[styles.tasks, { color: fg }]} numberOfLines={1}>
                  {alert.taskTitles.slice(0, 3).join(' · ')}
                  {alert.taskTitles.length > 3 ? ` +${alert.taskTitles.length - 3}` : ''}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => dismiss(alert.type)}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Fechar este alerta até amanhã"
            >
              <Ionicons name="close" size={18} color={fg} />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(() => StyleSheet.create({
  list:    { gap: SPACING.sm, marginBottom: SPACING.lg },
  alert:   { flexDirection: 'row', alignItems: 'flex-start', borderRadius: RADIUS.md, paddingLeft: SPACING.md, paddingVertical: SPACING.sm },
  icon:    { marginTop: 2 },
  body:    { flex: 1, marginLeft: SPACING.sm, gap: 2 },
  message: { fontSize: FONT.sm, fontWeight: '600', lineHeight: 18 },
  tasks:   { fontSize: 12, opacity: 0.85 },
  // 44×44: área de toque recomendada
  close:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -SPACING.sm, marginBottom: -SPACING.sm },
}));
