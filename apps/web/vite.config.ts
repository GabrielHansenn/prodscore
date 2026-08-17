import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve @prodscore/shared diretamente do source em desenvolvimento
      '@prodscore/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
      // Força TODO import de react/react-dom (inclusive de dependências hoisted
      // na raiz do monorepo, como zustand e react-router-dom) a resolver a cópia
      // local do apps/web. Sem isso, a raiz resolve React 19 (exigido pelo
      // apps/mobile/Expo) enquanto apps/web usa React 18 localmente — duas
      // instâncias de React ao mesmo tempo quebram hooks ("Cannot read
      // properties of null (reading 'useRef')") em qualquer render que passe
      // por um pacote hoisted (Zustand, react-router-dom).
      'react':     fileURLToPath(new URL('./node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        rewrite: (p: string) => p.replace(/^\/api/, ''),
      },
    },
  },
});
