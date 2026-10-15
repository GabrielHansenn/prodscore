import 'dotenv/config';
import { createApp } from './app.js';

/** Servidor local (npm run dev:api) — rotas sem prefixo, CORS liberado */
const app = createApp();
const PORT = process.env['PORT'] ?? 3333;

app.listen(PORT, () => {
  console.log(`🚀 ProdScore API rodando na porta ${PORT}`);
});

export default app;
