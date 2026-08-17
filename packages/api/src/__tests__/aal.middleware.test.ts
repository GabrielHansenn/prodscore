/**
 * Testes do middleware de AAL (Authenticator Assurance Level).
 * Verifica que rotas sensíveis bloqueiam sessões em aal1 e liberam aal2.
 */

import express from 'express';
import request from 'supertest';
import { requireAAL2 } from '../middleware/aal';

/** Monta um JWT com payload arbitrário sem se preocupar com assinatura real */
function fakeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

function buildApp() {
  const app = express();
  app.get('/rota-sensivel', requireAAL2, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('requireAAL2', () => {
  const app = buildApp();

  it('deve bloquear com 403 quando a sessão está em aal1', async () => {
    const token = fakeToken({ sub: 'user-1', aal: 'aal1' });

    const res = await request(app).get('/rota-sensivel').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('AAL2_REQUERIDO');
    expect(res.body.erro).toEqual(expect.any(String));
  });

  it('deve bloquear com 403 quando não há cabeçalho Authorization', async () => {
    const res = await request(app).get('/rota-sensivel');

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('AAL2_REQUERIDO');
  });

  it('deve bloquear com 403 quando o token está malformado', async () => {
    const res = await request(app).get('/rota-sensivel').set('Authorization', 'Bearer nao-e-um-jwt');

    expect(res.status).toBe(403);
  });

  it('deve liberar o acesso quando a sessão está em aal2', async () => {
    const token = fakeToken({ sub: 'user-1', aal: 'aal2' });

    const res = await request(app).get('/rota-sensivel').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
