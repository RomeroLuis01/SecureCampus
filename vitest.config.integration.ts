import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['backend/tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    reporters: ['verbose'],
    testTimeout: 15000,
    pool: 'forks',
  },
});
