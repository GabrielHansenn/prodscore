/**
 * Função da Vercel (serverless): o mesmo app Express do servidor local, com
 * as rotas sob /api — o site e a API ficam no mesmo domínio.
 *
 * Empacotada pelo scripts/vercel-build.mjs (esbuild) num arquivo só, já com o
 * @prodscore/shared embutido. As variáveis de ambiente vêm do painel da Vercel.
 */

import 'dotenv/config';
import { createApp } from './app.js';

export default createApp({
  basePath:   '/api',
  corsOrigin: process.env['FRONTEND_URL'],
});
