/**
 * Testes unitários das partes puras dos relatórios: validação do período,
 * intervalos da série e reconstrução da sequência (streak) com freeze.
 */

jest.mock('../lib/supabase');

import { parseReportRange, buildBuckets, reconstructStreaks } from '../services/report.service';

const NOW = new Date('2025-06-18T15:00:00.000Z');

describe('parseReportRange', () => {
  it('sem parâmetros usa os últimos 30 dias, por dia', () => {
    expect(parseReportRange({}, NOW)).toEqual({ from: '2025-05-20', to: '2025-06-18', granularity: 'day' });
  });

  it('limita a data final a hoje', () => {
    expect(parseReportRange({ from: '2025-06-10', to: '2025-12-31' }, NOW).to).toBe('2025-06-18');
  });

  it('agrupa por semana automaticamente acima de 31 dias', () => {
    expect(parseReportRange({ from: '2025-03-20', to: '2025-06-18' }, NOW).granularity).toBe('week');
    expect(parseReportRange({ from: '2025-05-19', to: '2025-06-18' }, NOW).granularity).toBe('day');
  });

  it('aceita exatamente 366 dias e recusa 367', () => {
    expect(() => parseReportRange({ from: '2024-06-18', to: '2025-06-18' }, NOW)).not.toThrow();
    expect(() => parseReportRange({ from: '2024-06-17', to: '2025-06-18' }, NOW)).toThrow('no máximo 366 dias');
  });
});

describe('buildBuckets', () => {
  it('semanas começam na segunda e são cortadas nas pontas do período', () => {
    expect(buildBuckets({ from: '2025-06-04', to: '2025-06-18', granularity: 'week' })).toEqual([
      { date: '2025-06-02', firstDay: '2025-06-04', lastDay: '2025-06-08' },
      { date: '2025-06-09', firstDay: '2025-06-09', lastDay: '2025-06-15' },
      { date: '2025-06-16', firstDay: '2025-06-16', lastDay: '2025-06-18' },
    ]);
  });
});

describe('reconstructStreaks', () => {
  const days = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => `2025-06-${String(from + i).padStart(2, '0')}`);

  it('conta dias seguidos e zera no primeiro dia inteiro sem tarefa', () => {
    const result = reconstructStreaks(['2025-06-01', '2025-06-02', '2025-06-03'], new Map(), days(1, 5), '2025-06-18');
    expect([...result.values()]).toEqual([1, 2, 3, 0, 0]);
  });

  it('volta a 1 quando recomeça depois de quebrar', () => {
    const result = reconstructStreaks(['2025-06-01', '2025-06-02', '2025-06-05'], new Map(), ['2025-06-05'], '2025-06-18');
    expect(result.get('2025-06-05')).toBe(1);
  });

  it('dias perdidos cobertos por freeze mantêm a sequência', () => {
    // Perdeu 03 e 04; voltou em 05 consumindo 2 freezes
    const consumed = new Map([['2025-06-05', 2]]);
    const result = reconstructStreaks(['2025-06-01', '2025-06-02', '2025-06-05'], consumed, days(1, 5), '2025-06-18');
    expect([...result.values()]).toEqual([1, 2, 2, 2, 3]);
  });

  it('freezes insuficientes não salvam a sequência', () => {
    const consumed = new Map([['2025-06-05', 1]]);
    const result = reconstructStreaks(['2025-06-01', '2025-06-02', '2025-06-05'], consumed, ['2025-06-05'], '2025-06-18');
    expect(result.get('2025-06-05')).toBe(1);
  });

  it('hoje ainda não quebrou a sequência de quem concluiu ontem', () => {
    const result = reconstructStreaks(['2025-06-16', '2025-06-17'], new Map(), ['2025-06-18'], '2025-06-18');
    expect(result.get('2025-06-18')).toBe(2);
  });
});
