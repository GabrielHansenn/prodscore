import type { GroupStatsReport, StatsHistoryReport } from '@prodscore/shared';
import { api } from './api';

export interface ReportPeriod {
  from: string;
  to:   string;
}

/** Relatório individual do período (gráficos e indicadores da tela de Estatísticas) */
export async function getStatsHistory(period: ReportPeriod): Promise<StatsHistoryReport> {
  const { data } = await api.get<{ relatorio: StatsHistoryReport }>('/users/me/stats/history', {
    params: { from: period.from, to: period.to },
  });
  return data.relatorio;
}

/** Métricas coletivas do grupo no período (só membros) */
export async function getGroupStats(groupId: string, period: ReportPeriod): Promise<GroupStatsReport> {
  const { data } = await api.get<{ relatorio: GroupStatsReport }>(`/groups/${groupId}/stats`, {
    params: { from: period.from, to: period.to },
  });
  return data.relatorio;
}
