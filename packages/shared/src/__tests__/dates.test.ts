/**
 * Testes das datas de calendário no fuso local (X2 da auditoria de UX).
 * Rodam com TZ fixo em America/Sao_Paulo (ver o script de teste do pacote),
 * para reproduzir o bug do prazo que vencia às 20h59.
 */

import { describe, it, expect } from 'vitest';
import { localDateKey, endOfLocalDayISO, isLocalToday } from '../dates';

describe('endOfLocalDayISO', () => {
  it('prazo "20/10" vence às 23h59 de Brasília (02h59 UTC do dia seguinte)', () => {
    expect(endOfLocalDayISO('2026-10-20')).toBe('2026-10-21T02:59:00.000Z');
  });

  it('recusa data inexistente', () => {
    expect(endOfLocalDayISO('2026-02-31')).toBeNull();
    expect(endOfLocalDayISO('20/10/2026')).toBeNull();
  });
});

describe('localDateKey', () => {
  it('às 22h de Brasília ainda é o mesmo dia (em UTC já seria o dia seguinte)', () => {
    const vinteDuasHoras = new Date('2026-10-21T01:00:00.000Z'); // 20/10 22h em Brasília
    expect(localDateKey(vinteDuasHoras)).toBe('2026-10-20');
  });
});

describe('isLocalToday', () => {
  const agora = new Date('2026-10-21T01:00:00.000Z'); // 20/10 22h em Brasília

  it('prazo de hoje às 23h59 conta como hoje às 22h', () => {
    expect(isLocalToday(endOfLocalDayISO('2026-10-20')!, agora)).toBe(true);
  });

  it('prazo de amanhã não conta como hoje às 22h', () => {
    expect(isLocalToday(endOfLocalDayISO('2026-10-21')!, agora)).toBe(false);
  });
});
