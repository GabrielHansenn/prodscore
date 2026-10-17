import type { GroupStatsReport, ReportGranularity, StatsHistoryReport } from '@prodscore/shared';
import { api } from './api.js';

export interface ReportPeriod {
  from: string;
  to:   string;
  granularity?: ReportGranularity;
}

/** Relatório individual do período (gráficos e indicadores da tela de Estatísticas) */
export async function getStatsHistory(period: ReportPeriod): Promise<StatsHistoryReport> {
  const { data } = await api.get<{ relatorio: StatsHistoryReport }>('/users/me/stats/history', { params: period });
  return data.relatorio;
}

/** Métricas coletivas do grupo no período (só membros) */
export async function getGroupStats(groupId: string, period: ReportPeriod): Promise<GroupStatsReport> {
  const { data } = await api.get<{ relatorio: GroupStatsReport }>(`/groups/${groupId}/stats`, {
    params: { from: period.from, to: period.to },
  });
  return data.relatorio;
}
