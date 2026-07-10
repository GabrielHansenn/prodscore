/**
 * Handler para deploy serverless na Vercel.
 * Exporta o app Express como handler compatível com Vercel Functions.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes         from './routes/auth.routes.js';
import usersRoutes        from './routes/users.routes.js';
import tasksRoutes        from './routes/tasks.routes.js';
import groupsRoutes       from './routes/groups.routes.js';
import rankingRoutes      from './routes/ranking.routes.js';
import achievementsRoutes from './routes/achievements.routes.js';
import missionsRoutes     from './routes/missions.routes.js';

const app = express();

app.use(cors({
  // Permite apenas a origem do frontend em produção
  origin: process.env['FRONTEND_URL'] ?? '*',
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',         authRoutes);
app.use('/api/users',        usersRoutes);
app.use('/api/tasks',        tasksRoutes);
app.use('/api/groups',       groupsRoutes);
app.use('/api/ranking',      rankingRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/missions',     missionsRoutes);

export default app;
