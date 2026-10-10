import { defineConfig } from 'vitest/config';

/**
 * Testes da camada de dados em Node, contra sql.js (sem dispositivo nem browser).
 *   npm run test:core
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/app/**/*.test.ts'],
  },
});
