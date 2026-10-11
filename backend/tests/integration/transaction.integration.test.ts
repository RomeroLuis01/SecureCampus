import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import type { Pool } from 'pg';
import { withUserTransaction } from '../../src/db/transaction.js';
import {
  validateTestDatabaseUrl,
  isTestEnvironmentConfigured,
} from '../helpers/testDbGuard.js';

const { Pool: PgPool } = pg;

describe('withUserTransaction (Integration Tests & Isolation Safety)', () => {
  const isConfigured = isTestEnvironmentConfigured();

  it('verifies integration safety policy: integration tests refuse to run against unverified databases', () => {
    // This test always runs regardless of database state to guarantee the safety barrier is active
    expect(() => {
      validateTestDatabaseUrl('postgresql://securecampus_app:secret@localhost:5432/securecampus');
    }).toThrow(/CRITICAL SAFETY VIOLATION/);

    if (!isConfigured) {
      console.info(
        '\n[Integration Test Safety Notice] TEST_DATABASE_URL is not set or points to an unisolated database.\n' +
        'Integration tests against PostgreSQL are intentionally SKIPPED to protect the development database.\n' +
        'To execute integration tests, provision an isolated database (e.g. securecampus_test) and export:\n' +
        '  TEST_DATABASE_URL="postgres://securecampus_app:<password>@127.0.0.1:5433/securecampus_test"\n'
      );
    }
  });

  describe.skipIf(!isConfigured)('Active Integration Suite (requires isolated TEST_DATABASE_URL)', () => {
    let testPool: Pool;
    const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

    beforeAll(() => {
      const config = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
      // Pool with size 1 to guarantee deterministic connection reuse testing
      testPool = new PgPool({
        connectionString: config.connectionString,
        max: 1,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
      });
    });

    afterAll(async () => {
      if (testPool) {
        await testPool.end();
      }
    });

    it('1. Identity context: fn_usuario_actual() reflects usuarioId inside withUserTransaction', async () => {
      const recordedUserId = await withUserTransaction(
        testUserId,
        async (tx) => {
          const res = await tx.query<{ current_user_id: string }>(
            'SELECT seguridad.fn_usuario_actual() AS current_user_id'
          );
          return res.rows[0]?.current_user_id;
        },
        { pool: testPool }
      );

      expect(recordedUserId).toBe(testUserId);
    });

    it('2. Rollback integrity: modifications made in aborted transaction do not persist', async () => {
      await withUserTransaction(
        testUserId,
        async (tx) => {
          await tx.query('CREATE TEMP TABLE IF NOT EXISTS _test_tx_probe (id int, name text)');
          await tx.query('DELETE FROM _test_tx_probe');
        },
        { pool: testPool }
      );

      // Attempt transaction that inserts and then throws
      await expect(
        withUserTransaction(
          testUserId,
          async (tx) => {
            await tx.query("INSERT INTO _test_tx_probe (id, name) VALUES (1, 'aborted')");
            throw new Error('Simulated business abort');
          },
          { pool: testPool }
        )
      ).rejects.toThrow('Simulated business abort');

      // Verify that row was rolled back
      const probeClient = await testPool.connect();
      try {
        const countRes = await probeClient.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM _test_tx_probe'
        );
        expect(countRes.rows[0]?.count).toBe('0');
      } finally {
        probeClient.release();
      }
    });

    it('3. Deterministic connection reuse: client returned to pool does not leak app.usuario_id', async () => {
      // Step A: Run transaction with specific user identity
      await withUserTransaction(
        testUserId,
        async (tx) => {
          const res = await tx.query<{ uid: string }>('SELECT seguridad.fn_usuario_actual() AS uid');
          expect(res.rows[0]?.uid).toBe(testUserId);
        },
        { pool: testPool }
      );

      // Step B: Because pool max is 1, checkout the single physical connection
      const reusedClient = await testPool.connect();
      try {
        // Verify current setting is completely reset/null
        const probeRes = await reusedClient.query<{
          setting_val: string | null;
          fn_val: string | null;
        }>(
          "SELECT current_setting('app.usuario_id', true) AS setting_val, seguridad.fn_usuario_actual() AS fn_val"
        );

        // Under is_local = true, current_setting is reverted to null/empty after COMMIT
        const settingVal = probeRes.rows[0]?.setting_val;
        const fnVal = probeRes.rows[0]?.fn_val;

        expect(settingVal === null || settingVal === '').toBe(true);
        expect(fnVal).toBeNull();
      } finally {
        reusedClient.release();
      }
    });
  });
});
