import { defineConfig } from 'vitest/config';

// Fuso fixo de Brasília nos testes: os testes de data (dates.test.ts)
// reproduzem o bug do prazo que vencia às 20h59 (23h59 gravado em UTC).
// Definido aqui (e não no script npm) porque `TZ=...` não funciona no cmd do
// Windows; os workers do Vitest herdam a variável.
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
