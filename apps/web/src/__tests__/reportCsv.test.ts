/**
 * Testes da exportação CSV do relatório de desempenho.
 */

import { describe, it, expect } from 'vitest';
import type { StatsHistoryReport } from '@prodscore/shared';
import { buildStatsCsv } from '../lib/reportCsv';

const report: StatsHistoryReport = {
  from: '2025-06-09',
  to:   '2025-06-10',
  granularity: 'day',
  series: [
    { date: '2025-06-09', tasksCompleted: 2, pointsEarned: 55, totalPoints: 455, streak: 3 },
    { date: '2025-06-10', tasksCompleted: 0, pointsEarned: 0,  totalPoints: 455, streak: 0 },
  ],
  summary: {
    tasksCompleted: 2, pointsEarned: 55, tasksCreated: 3, completionRate: 66.7,
    tasksWithDueDate: 1, tasksOnTime: 1, punctualityRate: 100,
    weeklyGoalsTotal: 1, weeklyGoalsAchieved: 0,
  },
};

describe('buildStatsCsv', () => {
  const lines = buildStatsCsv(report).split('\r\n');

  it('traz o período em datas brasileiras', () => {
    expect(lines[1]).toBe('Período;09/06/2025 a 10/06/2025');
  });

  it('usa ";" e vírgula decimal (abre em colunas no Excel em português)', () => {
    expect(lines).toContain('Taxa de conclusão (%);66,7');
  });

  it('deixa vazio o indicador sem base (taxa null)', () => {
    const csv = buildStatsCsv({ ...report, summary: { ...report.summary, punctualityRate: null } });
    expect(csv.split('\r\n')).toContain('Taxa de pontualidade (%);');
  });

  it('inclui uma linha por dia da série', () => {
    expect(lines).toContain('Dia;Tarefas concluídas;Pontos ganhos;Saldo de pontos;Sequência (dias)');
    expect(lines).toContain('09/06/2025;2;55;455;3');
    expect(lines).toContain('10/06/2025;0;0;455;0');
  });
});
