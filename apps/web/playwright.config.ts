import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Testes de ponta a ponta (Playwright) do web.
 *
 * Rodar (com `npm run dev:api` e `npm run dev:web` no ar):
 *   npm run test:e2e --workspace=apps/web
 *
 * As telas logadas usam TEST_EMAIL e TEST_PASSWORD (variáveis de ambiente ou
 * apps/web/.env.e2e.local, ignorado pelo git). Sem elas, só as telas públicas
 * são verificadas.
 */

// Carrega apps/web/.env.e2e.local sem sobrescrever o que já veio do ambiente
if (existsSync('.env.e2e.local')) {
  for (const line of readFileSync('.env.e2e.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
  }
}

export default defineConfig({
  testDir:   './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './test-results',
  reporter:  [['list']],
  // Uma conta de teste só: rodar em série evita disputa pelo mesmo login
  workers:   1,
  timeout:   60_000,
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:5173',
    trace:   'retain-on-failure',
  },
  projects: [
    {
      name: 'celular-360',
      use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } },
    },
  ],
});
