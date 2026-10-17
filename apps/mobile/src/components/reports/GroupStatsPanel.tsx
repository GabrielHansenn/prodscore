import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { REPORT_DEFAULT_DAYS, type GroupStatsReport } from '@prodscore/shared';
import { getGroupStats } from '../../services/report.service';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../../constants/theme';
import { createThemedStyles } from '../../lib/createThemedStyles';
import PeriodFilter, { presetPeriod, type PeriodValue } from './PeriodFilter';
import ChartCard from './ChartCard';

/**
 * Painel de métricas coletivas do grupo (aba "Painel"): indicadores do
 * período e contribuição por membro. Espelha o GroupStatsPanel do web; o
 * gráfico de contribuição é de barras horizontais desenhadas com View (nomes
 * longos não cabem no eixo de um gráfico vertical no celular).
 */
export default function GroupStatsPanel({ groupId, refreshKey }: { groupId: string; refreshKey?: number }) {
  const styles = useStyles();
  const [period,  setPeriod]  = useState<PeriodValue>(() => presetPeriod(REPORT_DEFAULT_DAYS));
  const [report,  setReport]  = useState<GroupStatsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Recargas em segundo plano (tempo real) não piscam o indicador
    if (!report) setLoading(true);
    setError(null);
    getGroupStats(groupId, period)
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((err) => { if (!cancelled) setError(getFriendlyErrorMessage(err, 'Não foi possível carregar as métricas do grupo.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, period.from, period.to, reloadKey, refreshKey]);

  const changePeriod = (p: PeriodValue) => { setReport(null); setPeriod(p); };
  const s = report?.summary;
  const dash = loading || !s;
  const members = report?.members ?? [];
  const maxPoints = Math.max(1, ...members.map((m) => m.pointsEarned));
  const maxTasks  = Math.max(1, ...members.map((m) => m.tasksCompleted));

  const kpis: Array<{ label: string; value: string; sub?: string }> = [
    { label: 'Tarefas concluídas', value: dash ? '…' : s.tasksCompleted.toLocaleString('pt-BR'), sub: 'tarefas do grupo' },
    { label: 'Pontos somados',     value: dash ? '…' : s.pointsEarned.toLocaleString('pt-BR') },
    {
      label: 'Taxa de conclusão',
      value: dash ? '…' : s.completionRate === null ? '—' : `${s.completionRate.toLocaleString('pt-BR')}%`,
      ...(s ? { sub: `das ${s.tasksCreated} criadas` } : {}),
    },
    { label: 'Membros ativos',     value: dash ? '…' : `${s.activeMembers}/${s.totalMembers}` },
    { label: 'Missões concluídas', value: dash ? '…' : s.missionsCompleted.toLocaleString('pt-BR') },
  ];

  return (
    <View style={styles.wrap}>
      <PeriodFilter value={period} onChange={changePeriod} />

      {!(error && !report) && (
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpi}>
              <Text style={styles.kpiLabel}>{k.label}</Text>
              <Text style={styles.kpiValue}>{k.value}</Text>
              {k.sub && <Text style={styles.kpiSub}>{k.sub}</Text>}
            </View>
          ))}
        </View>
      )}

      <ChartCard
        title="Contribuição por membro" subtitle="Tarefas do grupo concluídas e pontos dessas tarefas"
        loading={loading} error={error} onRetry={() => setReloadKey((k) => k + 1)}
        empty={members.every((m) => m.tasksCompleted === 0)}
        emptyText="Nenhuma tarefa do grupo concluída neste período."
        height={120}
      >
        {() => (
          <View style={styles.members}>
            {members.map((m) => (
              <View key={m.userId} style={styles.memberRow} accessible
                accessibilityLabel={`${m.username}: ${m.pointsEarned} pontos, ${m.tasksCompleted} tarefas`}>
                <Text style={styles.memberName} numberOfLines={1}>{m.username}</Text>
                <View style={styles.bars}>
                  <View style={styles.barLine}>
                    <View style={styles.track}>
                      <View style={[styles.barPoints, { width: `${(m.pointsEarned / maxPoints) * 100}%` }]} />
                    </View>
                    <Text style={styles.barValue}>{m.pointsEarned} pts</Text>
                  </View>
                  <View style={styles.barLine}>
                    <View style={styles.track}>
                      <View style={[styles.barTasks, { width: `${(m.tasksCompleted / maxTasks) * 100}%` }]} />
                    </View>
                    <Text style={styles.barValue}>{m.tasksCompleted} {m.tasksCompleted === 1 ? 'tarefa' : 'tarefas'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ChartCard>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap:    { gap: SPACING.sm },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpi: {
    flexGrow: 1, flexBasis: '45%',
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.sm + 4, ...CARD_SHADOW,
  },
  kpiLabel:   { fontSize: FONT.sm, color: colors.textMuted },
  kpiValue:   { fontSize: FONT.xl, fontWeight: '800', color: colors.text, marginTop: 2 },
  kpiSub:     { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  members:    { gap: SPACING.md },
  memberRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  memberName: { width: 84, fontSize: FONT.sm, fontWeight: '600', color: colors.text },
  bars:       { flex: 1, gap: 4 },
  barLine:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track:      { flex: 1 },
  barPoints:  { height: 10, minWidth: 2, borderRadius: RADIUS.sm, backgroundColor: colors.primary },
  barTasks:   { height: 10, minWidth: 2, borderRadius: RADIUS.sm, backgroundColor: colors.limeText },
  barValue:   { width: 64, fontSize: 11, color: colors.textMuted },
}));
