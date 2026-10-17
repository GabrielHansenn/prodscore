/**
 * Relatórios de desempenho — períodos, granularidade e tipos de resposta
 * compartilhados entre a API e os gráficos do web e do mobile.
 *
 * Os dias são dias UTC (AAAA-MM-DD), o mesmo recorte usado pelo streak e pela
 * meta semanal; as semanas começam na segunda-feira.
 */

/** Atalhos de período da tela de Estatísticas (em dias, contando hoje) */
export const REPORT_PERIOD_PRESETS = [7, 30, 90] as const;

/** Período padrão quando from/to não são informados */
export const REPORT_DEFAULT_DAYS = 30;

/** Maior intervalo aceito em um relatório (personalizado) */
export const REPORT_MAX_RANGE_DAYS = 366;

/** Até quantos dias o relatório é agrupado por dia; acima disso, por semana */
export const REPORT_DAILY_MAX_DAYS = 31;

export type ReportGranularity = 'day' | 'week';

/** Granularidade automática: por dia em períodos curtos, por semana nos longos */
export function defaultReportGranularity(days: number): ReportGranularity {
  return days <= REPORT_DAILY_MAX_DAYS ? 'day' : 'week';
}

/** Dias corridos entre duas datas AAAA-MM-DD, contando as duas pontas */
export function reportRangeDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Período dos atalhos (7, 30, 90 dias): de (hoje − dias + 1) até hoje, em dias UTC */
export function reportPresetRange(days: number, now: Date = new Date()): { from: string; to: string } {
  const to   = now.toISOString().slice(0, 10);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

/** AAAA-MM-DD → DD/MM (eixo dos gráficos) */
export function formatReportDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** AAAA-MM-DD → DD/MM/AAAA (filtro e CSV) */
export function formatReportDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Relatório individual — GET /users/me/stats/history
// ---------------------------------------------------------------------------

/** Um ponto da série (um dia ou uma semana) */
export interface StatsHistoryPoint {
  /** Início do dia ou da semana (segunda), AAAA-MM-DD */
  date:           string;
  tasksCompleted: number;
  /** Pontos ganhos no intervalo (só transações positivas) */
  pointsEarned:   number;
  /** Saldo de pontos no fim do intervalo */
  totalPoints:    number;
  /** Sequência (dias) no fim do intervalo — reconstruída do histórico */
  streak:         number;
}

export interface StatsHistorySummary {
  /** Tarefas concluídas no período */
  tasksCompleted:      number;
  /** Pontos ganhos no período (só transações positivas) */
  pointsEarned:        number;
  /** Tarefas criadas no período */
  tasksCreated:        number;
  /** % das tarefas criadas no período que já foram concluídas (null se nenhuma criada) */
  completionRate:      number | null;
  /** Concluídas no período que tinham prazo */
  tasksWithDueDate:    number;
  /** Dessas, quantas foram concluídas até o prazo */
  tasksOnTime:         number;
  /** tasksOnTime ÷ tasksWithDueDate × 100 (null se nenhuma tinha prazo) */
  punctualityRate:     number | null;
  /** Metas semanais das semanas do período */
  weeklyGoalsTotal:    number;
  weeklyGoalsAchieved: number;
}

export interface StatsHistoryReport {
  from:        string;
  to:          string;
  granularity: ReportGranularity;
  series:      StatsHistoryPoint[];
  summary:     StatsHistorySummary;
}

// ---------------------------------------------------------------------------
// Métricas coletivas — GET /groups/:id/stats
// ---------------------------------------------------------------------------

/** Contribuição de um membro no período (só tarefas do grupo) */
export interface GroupMemberContribution {
  userId:         string;
  username:       string;
  avatarUrl:      string | null;
  tasksCompleted: number;
  pointsEarned:   number;
}

export interface GroupStatsSummary {
  /** Tarefas do grupo concluídas no período */
  tasksCompleted:    number;
  /** Soma dos pontos dessas tarefas */
  pointsEarned:      number;
  /** Tarefas do grupo criadas no período */
  tasksCreated:      number;
  /** % das tarefas do grupo criadas no período que já foram concluídas (null se nenhuma) */
  completionRate:    number | null;
  /** Membros atuais com ao menos 1 tarefa do grupo concluída no período */
  activeMembers:     number;
  totalMembers:      number;
  /** Missões do grupo concluídas no período */
  missionsCompleted: number;
}

export interface GroupStatsReport {
  from:    string;
  to:      string;
  summary: GroupStatsSummary;
  /** Membros atuais, do que mais contribuiu para o que menos */
  members: GroupMemberContribution[];
}
