import { useEffect, useState, type ReactNode } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { REPORT_DEFAULT_DAYS, type GroupStatsReport } from '@prodscore/shared';
import { getGroupStats } from '../../services/report.service.js';
import { getFriendlyErrorMessage } from '../../lib/errors.js';
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

/**
 * Painel de métricas coletivas do grupo (aba "Desempenho"): indicadores do
 * período e gráfico de contribuição por membro. Conta só tarefas do grupo.
 */
export default function GroupStatsPanel({ groupId, refreshKey }: { groupId: string; refreshKey?: number }) {
  const [period,  setPeriod]  = useState<PeriodValue>(() => presetPeriod(REPORT_DEFAULT_DAYS));
  const [report,  setReport]  = useState<GroupStatsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const colors = useChartColors();

  useEffect(() => {
    let cancelled = false;
    // Recargas em segundo plano (tempo real) não piscam o spinner
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
  const members = (report?.members ?? []).map((m) => ({ ...m, name: m.username }));
  const noContribution = members.every((m) => m.tasksCompleted === 0);

  return (
    <div className="space-y-4">
      <PeriodFilter value={period} onChange={changePeriod} />

      {!(error && !report) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi label="Tarefas concluídas" value={dash ? '…' : s.tasksCompleted.toLocaleString('pt-BR')} sub="tarefas do grupo" />
          <Kpi label="Pontos somados"     value={dash ? '…' : s.pointsEarned.toLocaleString('pt-BR')} sub="pelas tarefas do grupo" />
          <Kpi
            label="Taxa de conclusão"
            value={dash ? '…' : s.completionRate === null ? '—' : `${s.completionRate.toLocaleString('pt-BR')}%`}
            {...(s ? { sub: `das ${s.tasksCreated} criadas no período` } : {})}
          />
          <Kpi label="Membros ativos"     value={dash ? '…' : `${s.activeMembers}/${s.totalMembers}`} sub="concluíram tarefa do grupo" />
          <Kpi label="Missões concluídas" value={dash ? '…' : s.missionsCompleted.toLocaleString('pt-BR')} />
        </div>
      )}

      <ChartCard
        title="Contribuição por membro"
        subtitle="Tarefas do grupo concluídas e pontos dessas tarefas no período"
        loading={loading} error={error} onRetry={() => setReloadKey((k) => k + 1)}
        empty={noContribution}
        emptyText="Nenhuma tarefa do grupo concluída neste período."
        height={Math.max(224, members.length * 48 + 40)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={members} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke={colors.axis} tick={{ fill: colors.axis, fontSize: 11 }} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke={colors.axis} tick={{ fill: colors.axis, fontSize: 11 }} tickLine={false} width={90} />
            <Tooltip
              cursor={{ fill: colors.grid, opacity: 0.4 }}
              contentStyle={{ backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, borderRadius: 12, color: colors.tooltipText, fontSize: 12 }}
              labelStyle={{ color: colors.tooltipText, fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: colors.axis }} />
            <Bar dataKey="pointsEarned"   name="Pontos"  fill={colors.brand} radius={[0, 6, 6, 0]} maxBarSize={18} />
            <Bar dataKey="tasksCompleted" name="Tarefas" fill={colors.lime}  radius={[0, 6, 6, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
