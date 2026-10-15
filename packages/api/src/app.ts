import express, { type Express } from 'express';
import cors from 'cors';

import authRoutes          from './routes/auth.routes.js';
import usersRoutes         from './routes/users.routes.js';
import tasksRoutes         from './routes/tasks.routes.js';
import groupsRoutes        from './routes/groups.routes.js';
import rankingRoutes       from './routes/ranking.routes.js';
import achievementsRoutes  from './routes/achievements.routes.js';
import missionsRoutes      from './routes/missions.routes.js';
import consentRoutes       from './routes/consent.routes.js';
import friendsRoutes       from './routes/friends.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';

interface CreateAppOptions {
  /** Prefixo das rotas: '' no servidor local, '/api' na Vercel (mesmo domínio do site) */
  basePath?: string;
  /** Origem liberada no CORS; sem valor, libera qualquer origem */
  corsOrigin?: string | undefined;
}

/**
 * Monta o app Express com todas as rotas — usado pelo servidor local
 * (index.ts) e pela função da Vercel (vercel-handler.ts).
 *
 * Antes cada ponto de entrada registrava as rotas por conta própria, e o da
 * Vercel tinha ficado sem amigos, notificações e consentimento de cookies.
 */
export function createApp({ basePath = '', corsOrigin }: CreateAppOptions = {}): Express {
  const app = express();

  app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
  app.use(express.json());

  /** Health check — verifica se o servidor está no ar */
  app.get(`${basePath}/health`, (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(`${basePath}/auth`,          authRoutes);
  app.use(`${basePath}/users`,         usersRoutes);
  app.use(`${basePath}/tasks`,         tasksRoutes);
  app.use(`${basePath}/groups`,        groupsRoutes);
  app.use(`${basePath}/ranking`,       rankingRoutes);
  app.use(`${basePath}/achievements`,  achievementsRoutes);
  app.use(`${basePath}/missions`,      missionsRoutes);
  app.use(`${basePath}/consent`,       consentRoutes);
  app.use(`${basePath}/friends`,       friendsRoutes);
  app.use(`${basePath}/notifications`, notificationsRoutes);

  return app;
}
