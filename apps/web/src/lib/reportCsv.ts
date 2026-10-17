import { formatReportDate, type StatsHistoryReport } from '@prodscore/shared';

/** Separador ";" e vírgula decimal: o Excel em português abre o arquivo já em colunas */
const SEP = ';';

function cell(value: string | number | null): string {
  if (value === null) return '';
  const text = typeof value === 'number' ? value.toLocaleString('pt-BR', { useGrouping: false }) : value;
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(values: Array<string | number | null>): string {
  return values.map(cell).join(SEP);
}

/** Monta o CSV do relatório: indicadores do período + a série por dia/semana */
export function buildStatsCsv(report: StatsHistoryReport): string {
  const s = report.summary;
  const periodLabel = report.granularity === 'day' ? 'Dia' : 'Semana (início)';

  const lines = [
    row(['Relatório de desempenho — ProdScore']),
    row(['Período', `${formatReportDate(report.from)} a ${formatReportDate(report.to)}`]),
    '',
    row(['Indicador', 'Valor']),
    row(['Tarefas concluídas', s.tasksCompleted]),
    row(['Pontos ganhos', s.pointsEarned]),
    row(['Tarefas criadas', s.tasksCreated]),
    row(['Taxa de conclusão (%)', s.completionRate]),
    row(['Concluídas com prazo', s.tasksWithDueDate]),
    row(['Concluídas no prazo', s.tasksOnTime]),
    row(['Taxa de pontualidade (%)', s.punctualityRate]),
    row(['Metas semanais batidas', `${s.weeklyGoalsAchieved} de ${s.weeklyGoalsTotal}`]),
    '',
    row([periodLabel, 'Tarefas concluídas', 'Pontos ganhos', 'Saldo de pontos', 'Sequência (dias)']),
    ...report.series.map((p) => row([formatReportDate(p.date), p.tasksCompleted, p.pointsEarned, p.totalPoints, p.streak])),
  ];
  return lines.join('\r\n');
}

/** Baixa o CSV (com BOM, para o Excel reconhecer os acentos) */
export function downloadStatsCsv(report: StatsHistoryReport): void {
  const blob = new Blob(['﻿', buildStatsCsv(report)], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `prodscore-relatorio-${report.from}-a-${report.to}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
