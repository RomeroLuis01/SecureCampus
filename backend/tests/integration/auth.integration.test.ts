import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import type { Pool } from 'pg';
import { createApp } from '../../src/app.js';
import { config } from '../../src/config/env.js';
import {
  validateTestDatabaseUrl,
  isTestEnvironmentConfigured,
} from '../helpers/testDbGuard.js';

const { Pool: PgPool } = pg;

describe('Authentication API (Integration Suite & Safety)', () => {
  const isConfigured = isTestEnvironmentConfigured();

  it('verifies integration safety policy: refuses to run integration suite against unverified database', () => {
    expect(() => {
      validateTestDatabaseUrl('postgresql://securecampus_app:secret@localhost:5432/securecampus');
    }).toThrow(/CRITICAL SAFETY VIOLATION/);
  });

  describe.skipIf(!isConfigured)('Active Auth Integration Suite (requires isolated TEST_DATABASE_URL)', () => {
    let testPool: Pool;
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
      const dbConfig = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
      testPool = new PgPool({
        connectionString: dbConfig.connectionString,
        max: 2,
      });
      app = createApp(config);
    });

    afterAll(async () => {
      if (testPool) {
        await testPool.end();
      }
    });

    it('dummy test placeholder when test environment is enabled', () => {
      expect(app).toBeDefined();
    });
  });
});
