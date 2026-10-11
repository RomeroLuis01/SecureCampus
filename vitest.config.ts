import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['backend/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    reporters: ['verbose'],
    pool: 'forks',
  },
});
