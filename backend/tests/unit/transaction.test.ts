import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { withUserTransaction, TransactionContextError } from '../../src/db/transaction.js';
import {
  validateTestDatabaseUrl,
  TestDatabaseIsolationError,
} from '../helpers/testDbGuard.js';

describe('withUserTransaction (Unit Tests)', () => {
  const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  let mockClient: {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };

  let mockPool: {
    connect: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 } as unknown as QueryResult),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient as unknown as PoolClient),
      query: vi.fn().mockRejectedValue(new Error('pool.query should never be called inside transaction')),
    };
  });

  it('1. Executes successful transaction in exact expected sequence', async () => {
    const callbackResult = { processed: true, count: 42 };
    const executionOrder: string[] = [];

    mockPool.connect.mockImplementation(async () => {
      executionOrder.push('pool.connect');
      return mockClient as unknown as PoolClient;
    });

    mockClient.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN') {
        executionOrder.push('BEGIN');
      } else if (typeof sql === 'string' && sql.includes('set_config')) {
        executionOrder.push(`set_config:${params?.[0]}`);
      } else if (sql === 'COMMIT') {
        executionOrder.push('COMMIT');
      } else if (sql === 'ROLLBACK') {
        executionOrder.push('ROLLBACK');
      } else {
        executionOrder.push(`query:${sql}`);
      }
      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    });

    mockClient.release.mockImplementation(() => {
      executionOrder.push('release');
    });

    const result = await withUserTransaction(
      validUserId,
      async (tx) => {
        executionOrder.push('callback_start');
        await tx.query('SELECT * FROM seguridad.usuarios WHERE usuario_id = $1', [validUserId]);
        executionOrder.push('callback_end');
        return callbackResult;
      },
      { pool: mockPool as unknown as Pool }
    );

    expect(result).toEqual(callbackResult);
    expect(executionOrder).toEqual([
      'pool.connect',
      'BEGIN',
      `set_config:${validUserId}`,
      'callback_start',
      'query:SELECT * FROM seguridad.usuarios WHERE usuario_id = $1',
      'callback_end',
      'COMMIT',
      'release',
    ]);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith(); // Released healthy (no boolean or true argument)
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('2. Passes user identity via parameterized query ($1) and never via SQL concatenation', async () => {
    await withUserTransaction(
      validUserId,
      async (tx) => {
        await tx.query('SELECT 1');
      },
      { pool: mockPool as unknown as Pool }
    );

    const setConfigCall = mockClient.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('set_config')
    );

    expect(setConfigCall).toBeDefined();
    expect(setConfigCall![0]).toBe("SELECT set_config('app.usuario_id', $1, true)");
    expect(setConfigCall![1]).toEqual([validUserId]);
    expect(setConfigCall![0]).not.toContain(validUserId); // Not interpolated
  });

  it('3. Rolls back transaction and releases client when callback throws an error', async () => {
    const businessError = new Error('Business validation failed: duplicate matricula');

    await expect(
      withUserTransaction(
        validUserId,
        async (tx) => {
          await tx.query('SELECT 1');
          throw businessError;
        },
        { pool: mockPool as unknown as Pool }
      )
    ).rejects.toThrow('Business validation failed: duplicate matricula');

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith();
  });

  it('4. Handles asynchronous rejected promises in callback properly', async () => {
    await expect(
      withUserTransaction(
        validUserId,
        async () => {
          return Promise.reject(new Error('Async service failure'));
        },
        { pool: mockPool as unknown as Pool }
      )
    ).rejects.toThrow('Async service failure');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('5. Releases client without attempting ROLLBACK if BEGIN fails', async () => {
    const beginError = new Error('Connection lost before BEGIN');
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') {
        throw beginError;
      }
      return { rows: [] } as unknown as QueryResult;
    });

    const callback = vi.fn();

    await expect(
      withUserTransaction(validUserId, callback, { pool: mockPool as unknown as Pool })
    ).rejects.toThrow('Connection lost before BEGIN');

    expect(callback).not.toHaveBeenCalled();
    expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('6. Rolls back and releases client if set_config fails', async () => {
    const setConfigError = new Error('Database permission error on set_config');
    mockClient.query.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('set_config')) {
        throw setConfigError;
      }
      return { rows: [] } as unknown as QueryResult;
    });

    const callback = vi.fn();

    await expect(
      withUserTransaction(validUserId, callback, { pool: mockPool as unknown as Pool })
    ).rejects.toThrow('Database permission error on set_config');

    expect(callback).not.toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('7. Attempts ROLLBACK and releases client if COMMIT fails', async () => {
    const commitError = new Error('Serialization failure during COMMIT');
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'COMMIT') {
        throw commitError;
      }
      return { rows: [] } as unknown as QueryResult;
    });

    await expect(
      withUserTransaction(
        validUserId,
        async (tx) => {
          await tx.query('SELECT 1');
        },
        { pool: mockPool as unknown as Pool }
      )
    ).rejects.toThrow('Serialization failure during COMMIT');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('8. Discards connection (client.release(true)) and propagates original error if ROLLBACK fails', async () => {
    const originalError = new Error('Primary database constraint violation');
    const rollbackError = new Error('Socket closed during ROLLBACK');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'ROLLBACK') {
        throw rollbackError;
      }
      return { rows: [] } as unknown as QueryResult;
    });

    await expect(
      withUserTransaction(
        validUserId,
        async () => {
          throw originalError;
        },
        { pool: mockPool as unknown as Pool }
      )
    ).rejects.toThrow('Primary database constraint violation');

    // Connection must be destroyed (release(true))
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith(true);

    consoleErrorSpy.mockRestore();
  });

  it('9. Rejects invalid user identifiers before requesting a connection from the pool', async () => {
    const invalidIds = [
      '',
      '   ',
      'not-a-uuid',
      '12345',
      'admin',
      'a0eebc99-9c0b-4ef8-bb6d',
      null as unknown as string,
      undefined as unknown as string,
    ];

    for (const invalidId of invalidIds) {
      await expect(
        withUserTransaction(
          invalidId,
          async () => {
            return 'should not run';
          },
          { pool: mockPool as unknown as Pool }
        )
      ).rejects.toThrow(TransactionContextError);

      expect(mockPool.connect).not.toHaveBeenCalled();
    }
  });

  it('10. Encapsulates transaction client: does not expose release, connect or lifecycle methods', async () => {
    let capturedClient: unknown;

    await withUserTransaction(
      validUserId,
      async (tx) => {
        capturedClient = tx;
      },
      { pool: mockPool as unknown as Pool }
    );

    expect(capturedClient).toBeDefined();
    expect(typeof (capturedClient as Record<string, unknown>).query).toBe('function');
    expect((capturedClient as Record<string, unknown>).release).toBeUndefined();
    expect((capturedClient as Record<string, unknown>).connect).toBeUndefined();
    expect((capturedClient as Record<string, unknown>).end).toBeUndefined();
  });

  it('11. Releases client exactly once even if release itself throws an error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockClient.release.mockImplementation(() => {
      throw new Error('Driver pool release error');
    });

    // Should complete successfully because release error in finally is captured safely
    const result = await withUserTransaction(
      validUserId,
      async () => 'completed',
      { pool: mockPool as unknown as Pool }
    );

    expect(result).toBe('completed');
    expect(mockClient.release).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });
});

describe('testDbGuard (Unit Tests)', () => {
  it('rejects empty, undefined or invalid test database URLs', () => {
    expect(() => validateTestDatabaseUrl(undefined)).toThrow(TestDatabaseIsolationError);
    expect(() => validateTestDatabaseUrl('')).toThrow(TestDatabaseIsolationError);
    expect(() => validateTestDatabaseUrl('not-a-url')).toThrow(TestDatabaseIsolationError);
    expect(() => validateTestDatabaseUrl('http://localhost:5432/test')).toThrow(TestDatabaseIsolationError);
  });

  it('CRITICAL SAFETY: strictly rejects connecting to development database "securecampus"', () => {
    expect(() =>
      validateTestDatabaseUrl('postgres://securecampus_app:secret@127.0.0.1:5433/securecampus')
    ).toThrow(/CRITICAL SAFETY VIOLATION/);

    expect(() =>
      validateTestDatabaseUrl('postgresql://postgres:secret@localhost:5432/securecampus')
    ).toThrow(/CRITICAL SAFETY VIOLATION/);
  });

  it('accepts isolated test database conforming to naming policy', () => {
    const validConfig = validateTestDatabaseUrl(
      'postgresql://postgres:secret@127.0.0.1:5433/securecampus_test'
    );
    expect(validConfig.databaseName).toBe('securecampus_test');
    expect(validConfig.connectionString).toBe(
      'postgresql://postgres:secret@127.0.0.1:5433/securecampus_test'
    );

    const customTestConfig = validateTestDatabaseUrl(
      'postgres://user:pass@localhost:5432/my_integration_test'
    );
    expect(customTestConfig.databaseName).toBe('my_integration_test');
  });

  it('rejects arbitrary database names not ending in _test or securecampus_test', () => {
    expect(() =>
      validateTestDatabaseUrl('postgresql://postgres:pass@localhost:5432/production_db')
    ).toThrow(/naming policy/);
  });
});
