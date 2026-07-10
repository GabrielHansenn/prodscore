/** @type {import('jest').Config} */
module.exports = {
  // Usa ts-jest para transpilar TypeScript no modo CommonJS
  // (evita complexidade do Jest com ESM nativo)
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',

  // Diretórios de testes
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],

  // Remove extensão .js dos imports (compatibilidade ts-jest CJS ↔ ESM source)
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@prodscore/shared$':
      '<rootDir>/../../packages/shared/src/index.ts',
    '^@prodscore/shared/constants$':
      '<rootDir>/../../packages/shared/src/constants/gamification.ts',
  },

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
        // Sobrescreve module para CJS durante os testes
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
        },
      },
    ],
  },

  // Exibe cobertura apenas nos diretórios dos serviços testados
  collectCoverageFrom: [
    'src/services/**/*.ts',
    '!src/**/*.d.ts',
  ],

  clearMocks: true,
};
