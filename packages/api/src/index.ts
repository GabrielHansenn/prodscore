import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes        from './routes/auth.routes.js';
import usersRoutes       from './routes/users.routes.js';
import tasksRoutes       from './routes/tasks.routes.js';
import groupsRoutes      from './routes/groups.routes.js';
import rankingRoutes     from './routes/ranking.routes.js';
import achievementsRoutes from './routes/achievements.routes.js';
import missionsRoutes    from './routes/missions.routes.js';
import consentRoutes     from './routes/consent.routes.js';

const app = express();
const PORT = process.env['PORT'] ?? 3333;

/** Configuração de middlewares globais */
app.use(cors());
app.use(express.json());

/** Health check — verifica se o servidor está no ar */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Registro das rotas da API */
app.use('/auth',         authRoutes);
app.use('/users',        usersRoutes);
app.use('/tasks',        tasksRoutes);
app.use('/groups',       groupsRoutes);
app.use('/ranking',      rankingRoutes);
app.use('/achievements', achievementsRoutes);
app.use('/missions',     missionsRoutes);
app.use('/consent',      consentRoutes);

app.listen(PORT, () => {
  console.log(`🚀 ProdScore API rodando na porta ${PORT}`);
});

export default app;
