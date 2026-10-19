/**
 * Limite de tentativas por pessoa (usado no cadastro): conta por chave,
 * dentro de uma janela de tempo, e libera de novo quando a janela passa.
 */

import type { Request } from 'express';
import { AttemptLimiter, clientIp } from '../lib/attemptLimiter';

describe('AttemptLimiter', () => {
  it('permite até o limite e recusa a seguinte', () => {
    const limiter = new AttemptLimiter(3, 60_000);
    expect([1, 2, 3].map(() => limiter.tryAttempt('a', 0))).toEqual([true, true, true]);
    expect(limiter.tryAttempt('a', 0)).toBe(false);
  });

  it('cada chave tem a sua contagem', () => {
    const limiter = new AttemptLimiter(1, 60_000);
    expect(limiter.tryAttempt('a', 0)).toBe(true);
    expect(limiter.tryAttempt('b', 0)).toBe(true);
    expect(limiter.tryAttempt('a', 0)).toBe(false);
  });

  it('libera de novo quando a janela passa', () => {
    const limiter = new AttemptLimiter(1, 60_000);
    limiter.tryAttempt('a', 0);
    expect(limiter.tryAttempt('a', 59_999)).toBe(false);
    expect(limiter.tryAttempt('a', 60_000)).toBe(true);
  });

  it('tentativa recusada não prolonga o bloqueio', () => {
    const limiter = new AttemptLimiter(1, 60_000);
    limiter.tryAttempt('a', 0);
    limiter.tryAttempt('a', 30_000); // recusada
    expect(limiter.tryAttempt('a', 60_000)).toBe(true);
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>, ip = '10.0.0.1') => ({ headers, ip }) as unknown as Request;

  it('usa x-real-ip, depois o primeiro IP de x-forwarded-for, depois req.ip', () => {
    expect(clientIp(req({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '1.1.1.1' }))).toBe('203.0.113.5');
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.6, 10.0.0.2' }))).toBe('203.0.113.6');
    expect(clientIp(req({}))).toBe('10.0.0.1');
  });
});
