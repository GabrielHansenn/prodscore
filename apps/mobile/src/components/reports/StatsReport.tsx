import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import {
  REPORT_DEFAULT_DAYS, formatReportDay, formatReportDate,
  type StatsHistoryPoint, type StatsHistoryReport,
} from '@prodscore/shared';
import { getStatsHistory } from '../../services/report.service';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../../constants/theme';
import { useThemeColors } from '../../lib/useThemeColors';
import { createThemedStyles } from '../../lib/createThemedStyles';
import PeriodFilter, { presetPeriod, type PeriodValue } from './PeriodFilter';
import ChartCard from './ChartCard';

const Y_AXIS_WIDTH = 36;

/** Rótulo só em alguns pontos, para não encavalar no eixo (máx. ~6) */
function labelled(series: StatsHistoryPoint[], value: (p: StatsHistoryPoint) => number) {
  const every = Math.max(1, Math.ceil(series.length / 6));
  return series.map((p, i) => ({ value: value(p), label: i % every === 0 ? formatReportDay(p.date) : '' }));
}

const pct = (value: number | null) => (value === null ? '—' : `${value.toLocaleString('pt-BR')}%`);

/**
 * Relatório individual da tela de Estatísticas (mobile): filtro de período,
 * indicadores e os três gráficos (pontos, tarefas, sequência). Espelha o web,
 * sem a exportação CSV (exclusiva do web).
 */
export default function StatsReport() {
  const colors = useThemeColors();
  const styles = useStyles();
  const [period,  setPeriod]  = useState<PeriodValue>(() => presetPeriod(REPORT_DEFAULT_DAYS));
  const [report,  setReport]  = useState<StatsHistoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStatsHistory(period)
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((err) => { if (!cancelled) setError(getFriendlyErrorMessage(err, 'Não foi possível carregar o relatório.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period.from, period.to, reloadKey]);

  const retry  = () => setReloadKey((k) => k + 1);
  const series = report?.series ?? [];
  const s      = report?.summary;
  const byWeek = report?.granularity === 'week';
  const dash   = loading || !s;

  const axis = {
    yAxisTextStyle:      { color: colors.textMuted, fontSize: 10 },
    xAxisLabelTextStyle: { color: colors.textMuted, fontSize: 9, width: 40 },
    rulesColor:          colors.border,
    xAxisColor:          colors.border,
    yAxisColor:          colors.border,
    yAxisLabelWidth:     Y_AXIS_WIDTH,
    noOfSections:        4,
    // 18000 → "18 mil": o número inteiro não cabe na largura do eixo
    formatYLabel:        (label: string) => Number(label).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 0 }),
    height:              150,
  };

  const kpis: Array<{ label: string; value: string; sub?: string }> = [
    { label: 'Tarefas concluídas', value: dash ? '…' : s.tasksCompleted.toLocaleString('pt-BR') },
    { label: 'Pontos ganhos',      value: dash ? '…' : s.pointsEarned.toLocaleString('pt-BR') },
    { label: 'Taxa de conclusão',  value: dash ? '…' : pct(s.completionRate),  ...(s ? { sub: `das ${s.tasksCreated} criadas` } : {}) },
    { label: 'Pontualidade',       value: dash ? '…' : pct(s.punctualityRate), ...(s ? { sub: `${s.tasksOnTime} de ${s.tasksWithDueDate} com prazo` } : {}) },
    { label: 'Metas semanais',     value: dash ? '…' : `${s.weeklyGoalsAchieved}/${s.weeklyGoalsTotal}`, sub: 'batidas' },
  ];

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.sectionTitle}>RELATÓRIO DO PERÍODO</Text>
        {report && (
          <Text style={styles.sectionSub}>
            {formatReportDate(report.from)} a {formatReportDate(report.to)} · {byWeek ? 'por semana' : 'por dia'}
          </Text>
        )}
      </View>

      <PeriodFilter value={period} onChange={setPeriod} />

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
        title="Evolução de pontos" subtitle="Saldo no fim de cada dia/semana"
        loading={loading} error={error} onRetry={retry}
        empty={series.every((p) => p.totalPoints === 0 && p.pointsEarned === 0)}
      >
        {(width) => (
          <LineChart
            {...axis}
            data={labelled(series, (p) => p.totalPoints)}
            width={width - Y_AXIS_WIDTH - 16}
            adjustToWidth initialSpacing={4} endSpacing={4} disableScroll
            color={colors.primary} thickness={2.5} hideDataPoints curved
            areaChart startFillColor={colors.primary} endFillColor={colors.primary} startOpacity={0.2} endOpacity={0.02}
          />
        )}
      </ChartCard>

      <ChartCard
        title={byWeek ? 'Tarefas concluídas por semana' : 'Tarefas concluídas por dia'}
        loading={loading} error={error} onRetry={retry}
        empty={series.every((p) => p.tasksCompleted === 0)}
        emptyText="Nenhuma tarefa concluída neste período."
      >
        {(width) => {
          const plot = width - Y_AXIS_WIDTH - 16;
          const slot = plot / Math.max(series.length, 1);
          const barWidth = Math.max(3, Math.min(22, slot * 0.6));
          return (
            <BarChart
              {...axis}
              data={labelled(series, (p) => p.tasksCompleted)}
              width={plot}
              barWidth={barWidth} spacing={Math.max(1, slot - barWidth)} initialSpacing={4}
              frontColor={colors.limeText} roundedTop disableScroll
            />
          );
        }}
      </ChartCard>

      <ChartCard
        title="Evolução da sequência" subtitle="Dias seguidos com tarefa concluída (considera os freezes)"
        loading={loading} error={error} onRetry={retry}
        empty={series.every((p) => p.streak === 0)}
        emptyText="Sem sequência ativa neste período."
      >
        {(width) => (
          <LineChart
            {...axis}
            data={labelled(series, (p) => p.streak)}
            width={width - Y_AXIS_WIDTH - 16}
            adjustToWidth initialSpacing={4} endSpacing={4} disableScroll
            color={colors.amber} thickness={2} hideDataPoints stepChart
            areaChart startFillColor={colors.amber} endFillColor={colors.amber} startOpacity={0.25} endOpacity={0.05}
          />
        )}
      </ChartCard>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap:         { gap: SPACING.sm, marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT.sm, fontWeight: '600', letterSpacing: 0.8, color: colors.textMuted },
  sectionSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },
  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpi: {
    flexGrow: 1, flexBasis: '45%',
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.sm + 4, ...CARD_SHADOW,
  },
  kpiLabel: { fontSize: FONT.sm, color: colors.textMuted },
  kpiValue: { fontSize: FONT.xl, fontWeight: '800', color: colors.text, marginTop: 2 },
  kpiSub:   { fontSize: 11, color: colors.textMuted, marginTop: 1 },
}));
