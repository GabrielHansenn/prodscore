import { defineConfig, mergeConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import viteConfig from './vite.config';

/**
 * Configuração do Vitest para testes do app web.
 * Herda os aliases e plugins do vite.config.ts para garantir consistência.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Simula o ambiente browser (DOM) para testes de componentes React
      environment: 'jsdom',
      // Torna as APIs do Vitest globais (describe, it, expect, vi)
      globals: true,
      // Arquivo de setup executado antes de cada arquivo de teste
      setupFiles: ['./src/test/setup.ts'],
      // Inclui somente arquivos de teste nos diretórios corretos
      include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
      // Dependências hoisted na raiz do monorepo que importam React. Por padrão
      // o Vitest as carrega direto pelo Node, que ignora o alias de
      // react/react-dom do vite.config.ts — elas acabavam pegando o React 19 da
      // raiz (do apps/mobile) em vez do React 18 do apps/web, gerando duas
      // instâncias e o erro "reading 'useRef'" nos hooks. Pré-empacotá-las com
      // o optimizer (como o Vite já faz no dev) aplica o alias, inclusive nos
      // require() CommonJS do use-sync-external-store usado pelo zustand.
      deps: {
        optimizer: {
          web: {
            enabled: true,
            include: ['zustand', 'use-sync-external-store', 'react-router', 'react-router-dom'],
          },
        },
      },
      // Cobertura gerada pela engine V8 nativa
      coverage: {
        provider:   'v8',
        reporter:   ['text', 'lcov'],
        include:    ['src/**/*.{ts,tsx}'],
        exclude:    ['src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
      },
    },
    resolve: {
      alias: {
        '@prodscore/shared': fileURLToPath(
          new URL('../../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    },
  }),
);
