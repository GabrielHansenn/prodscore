/**
 * Testes do recorte de semana (UTC) e do texto explicativo da meta semanal.
 * Rodam com TZ em America/Sao_Paulo: o início da semana precisa continuar
 * sendo segunda 00:00 UTC, igual ao ranking semanal, independente do aparelho.
 */

import { describe, it, expect } from 'vitest';
import { utcWeekStart, utcWeekStartKey } from '../dates';
import { explainWeeklyGoal } from '../constants/adaptive';
import { WeeklyGoalReason } from '../types/index';

describe('utcWeekStart', () => {
  it('quarta-feira cai na segunda anterior', () => {
    expect(utcWeekStart(new Date('2025-06-18T15:00:00.000Z')).toISOString()).toBe('2025-06-16T00:00:00.000Z');
  });

  it('domingo ainda é da semana que começou na segunda anterior', () => {
    expect(utcWeekStartKey(new Date('2025-06-22T23:59:59.000Z'))).toBe('2025-06-16');
  });

  it('segunda 00:00 UTC já é a semana nova', () => {
    expect(utcWeekStartKey(new Date('2025-06-23T00:00:00.000Z'))).toBe('2025-06-23');
  });

  it('domingo 22h em Brasília (segunda 01h UTC) já conta na semana nova, como o ranking semanal', () => {
    expect(utcWeekStartKey(new Date('2025-06-22T22:00:00-03:00'))).toBe('2025-06-23');
  });
});

describe('explainWeeklyGoal', () => {
  it('explica a meta padrão com a média e o acréscimo', () => {
    expect(explainWeeklyGoal({ reason: WeeklyGoalReason.Default, baseAverage: 10, factor: 1.15, target: 12 }))
      .toBe('Calculada a partir da sua média de 10 tarefas por semana, +15% de desafio.');
  });

  it('mostra a média com uma casa decimal', () => {
    expect(explainWeeklyGoal({ reason: WeeklyGoalReason.Default, baseAverage: 10.25, factor: 1.15, target: 12 }))
      .toContain('média de 10,3 tarefas');
  });

  it('explica o desafio de quem bateu as 2 últimas metas', () => {
    expect(explainWeeklyGoal({ reason: WeeklyGoalReason.Challenge, baseAverage: 8, factor: 1.25, target: 10 }))
      .toContain('bateu as 2 últimas metas');
  });

  it('explica a meta de recuperação', () => {
    expect(explainWeeklyGoal({ reason: WeeklyGoalReason.Recovery, baseAverage: 6, factor: 1, target: 6 }))
      .toContain('meta passada não foi batida');
  });

  it('meta inicial de quem ainda não tem histórico', () => {
    expect(explainWeeklyGoal({ reason: WeeklyGoalReason.NewUser, baseAverage: 0, factor: 1, target: 3 }))
      .toBe('Meta inicial: ainda estamos conhecendo o seu ritmo.');
  });

  it('avisa quando a meta foi elevada ao mínimo', () => {
    expect(explainWeeklyGoal({ reason: WeeklyGoalReason.Default, baseAverage: 1, factor: 1.15, target: 3 }))
      .toContain('A meta mínima é 3 tarefas.');
  });
});
