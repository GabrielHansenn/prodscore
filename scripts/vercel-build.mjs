/**
 * Build de produção para a Vercel (Build Output API v3).
 *
 * Gera .vercel/output com:
 *   static/              → site (apps/web, Vite)
 *   functions/api.func/  → API (packages/api) empacotada pelo esbuild num
 *                          arquivo só, já com o @prodscore/shared embutido
 *   config.json          → rotas: /api/* vai para a função; o resto é o site,
 *                          com fallback para index.html (rotas do React, ex:
 *                          /tarefas e o /redefinir-senha do e-mail)
 *
 * Rodar localmente: npm run build:vercel
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root   = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.vercel', 'output');
const fnDir  = join(output, 'functions', 'api.func');

const step = (msg) => console.log(`\n▸ ${msg}`);

rmSync(output, { recursive: true, force: true });

// 1. Site — tsc + vite build (as VITE_* vêm das variáveis de ambiente da Vercel)
step('Build do site (apps/web)');
execSync('npm run build --workspace=apps/web', { cwd: root, stdio: 'inherit' });
cpSync(join(root, 'apps', 'web', 'dist'), join(output, 'static'), { recursive: true });

// 2. API — um arquivo CommonJS com tudo dentro (rotas, @prodscore/shared, dependências)
step('Empacotando a API (packages/api)');
mkdirSync(fnDir, { recursive: true });
await build({
  entryPoints: [join(root, 'packages', 'api', 'src', 'vercel-handler.ts')],
  outfile:     join(fnDir, 'index.js'),
  bundle:      true,
  platform:    'node',
  target:      'node20',
  format:      'cjs',
  // Usa os "paths" do tsconfig da API: @prodscore/shared → código-fonte do shared
  tsconfig:    join(root, 'packages', 'api', 'tsconfig.json'),
  // A Vercel chama module.exports como handler (req, res); o app Express é exatamente isso
  footer:      { js: 'module.exports = module.exports.default ?? module.exports;' },
  logLevel:    'warning',
});
writeFileSync(join(fnDir, '.vc-config.json'), JSON.stringify({
  runtime:      'nodejs20.x',
  handler:      'index.js',
  launcherType: 'Nodejs',
  maxDuration:  30,
}, null, 2));

// 3. Rotas
step('Gravando config.json');
writeFileSync(join(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    // API: a função recebe a URL original (/api/tasks...) e o Express roteia
    { src: '^/api(/.*)?$', dest: '/api' },
    // Arquivos do site (JS, CSS, imagens)
    { handle: 'filesystem' },
    // Qualquer outra rota é do React (ex: recarregar em /tarefas)
    { src: '/(.*)', dest: '/index.html' },
  ],
}, null, 2));

console.log('\n✓ .vercel/output pronto');
