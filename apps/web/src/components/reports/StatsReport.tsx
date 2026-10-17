import { useEffect, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { REPORT_DEFAULT_DAYS, formatReportDay, formatReportDate, type StatsHistoryReport } from '@prodscore/shared';
import { getStatsHistory } from '../../services/report.service.js';
import { getFriendlyErrorMessage } from '../../lib/errors.js';
import { downloadStatsCsv } from '../../lib/reportCsv.js';
import { useChartColors } from '../../lib/useChartColors.js';
import PeriodFilter, { presetPeriod, type PeriodValue } from './PeriodFilter.js';
import ChartCard from './ChartCard.js';

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

const pct = (value: number | null) => (value === null ? '—' : `${value.toLocaleString('pt-BR')}%`);

/**
 * Relatório individual da tela de Estatísticas: filtro de período,
 * indicadores, três gráficos (pontos, tarefas, sequência) e exportação CSV.
 */
export default function StatsReport() {
  const [period,  setPeriod]  = useState<PeriodValue>(() => presetPeriod(REPORT_DEFAULT_DAYS));
  const [report,  setReport]  = useState<StatsHistoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const colors = useChartColors();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStatsHistory({ from: period.from, to: period.to })
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((err) => { if (!cancelled) setError(getFriendlyErrorMessage(err, 'Não foi possível carregar o relatório.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period.from, period.to, reloadKey]);

  const retry  = () => setReloadKey((k) => k + 1);
  const series = report?.series ?? [];
  const data   = series.map((p) => ({ ...p, label: formatReportDay(p.date) }));
  const s      = report?.summary;
  const byWeek = report?.granularity === 'week';

  const tooltip = {
    contentStyle: {
      backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, borderRadius: 12,
      color: colors.tooltipText, fontSize: 12,
    },
    labelStyle: { color: colors.tooltipText, fontWeight: 600 },
    labelFormatter: (label: unknown) => (byWeek ? `Semana de ${String(label)}` : String(label)),
  };
  const axis = { stroke: colors.axis, tick: { fill: colors.axis, fontSize: 11 }, tickLine: false };

  const noTasks  = series.every((p) => p.tasksCompleted === 0);
  const noPoints = series.every((p) => p.totalPoints === 0 && p.pointsEarned === 0);
  const noStreak = series.every((p) => p.streak === 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Relatório do período</h2>
          {report && (
            <p className="mt-1 text-xs text-gray-400">
              {formatReportDate(report.from)} a {formatReportDate(report.to)} · {byWeek ? 'por semana' : 'por dia'}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary min-h-0 px-3 py-2 text-xs"
          disabled={!report || loading}
          onClick={() => report && downloadStatsCsv(report)}
        >
          Exportar relatório (CSV)
        </button>
      </div>

      <PeriodFilter value={period} onChange={setPeriod} />

      {/* Indicadores do período */}
      {error && !report ? null : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Tarefas concluídas" value={loading || !s ? '…' : s.tasksCompleted.toLocaleString('pt-BR')} />
          <Kpi label="Pontos ganhos"      value={loading || !s ? '…' : s.pointsEarned.toLocaleString('pt-BR')} />
          <Kpi
            label="Taxa de conclusão"
            value={loading || !s ? '…' : pct(s.completionRate)}
            {...(s ? { sub: `das ${s.tasksCreated} criadas no período` } : {})}
          />
          <Kpi
            label="Pontualidade"
            value={loading || !s ? '…' : pct(s.punctualityRate)}
            {...(s ? { sub: `${s.tasksOnTime} de ${s.tasksWithDueDate} com prazo` } : {})}
          />
          <Kpi
            label="Metas semanais"
            value={loading || !s ? '…' : `${s.weeklyGoalsAchieved}/${s.weeklyGoalsTotal}`}
            sub="batidas no período"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Evolução de pontos"
          subtitle="Saldo de pontos no fim de cada dia/semana"
          loading={loading} error={error} onRetry={retry} empty={noPoints}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={16} />
              <YAxis {...axis} width={48} />
              <Tooltip {...tooltip} formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Saldo']} />
              <Line type="monotone" dataKey="totalPoints" stroke={colors.brand} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={byWeek ? 'Tarefas concluídas por semana' : 'Tarefas concluídas por dia'}
          loading={loading} error={error} onRetry={retry} empty={noTasks}
          emptyText="Nenhuma tarefa concluída neste período."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={16} />
              <YAxis {...axis} allowDecimals={false} width={40} />
              <Tooltip {...tooltip} cursor={{ fill: colors.grid, opacity: 0.4 }} formatter={(v) => [v, 'Tarefas']} />
              <Bar dataKey="tasksCompleted" fill={colors.lime} radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Evolução da sequência"
          subtitle="Dias seguidos com tarefa concluída (considera os freezes)"
          loading={loading} error={error} onRetry={retry} empty={noStreak}
          emptyText="Sem sequência ativa neste período."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={16} />
              <YAxis {...axis} allowDecimals={false} width={40} />
              <Tooltip {...tooltip} formatter={(v) => [`${String(v)} dias`, 'Sequência']} />
              <Area type="stepAfter" dataKey="streak" stroke={colors.amber} fill={colors.amber} fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
