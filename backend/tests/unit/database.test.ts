import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryResult } from 'pg';
import { checkDatabaseConnection, query } from '../../src/config/database.js';
import { pool } from '../../src/config/database.js';

describe('database.ts (Baseline Functions Regression Tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('checkDatabaseConnection returns true on successful probe query', async () => {
    const querySpy = vi.spyOn(pool, 'query').mockImplementation((async () => {
      return {
        rows: [{ ready: 1 }],
        rowCount: 1,
      } as unknown as QueryResult;
    }) as any);

    const isReady = await checkDatabaseConnection();

    expect(isReady).toBe(true);
    expect(querySpy).toHaveBeenCalledWith('SELECT 1 AS ready');
  });

  it('checkDatabaseConnection returns false and does not throw when probe fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(pool, 'query').mockImplementation((async () => {
      throw new Error('Connection refused');
    }) as any);

    const isReady = await checkDatabaseConnection();

    expect(isReady).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('query delegates directly to pool.query with parameters', async () => {
    const querySpy = vi.spyOn(pool, 'query').mockImplementation((async () => {
      return {
        rows: [{ id: 1 }],
        rowCount: 1,
      } as unknown as QueryResult;
    }) as any);

    const result = await query('SELECT $1::int AS id', [1]);

    expect(querySpy).toHaveBeenCalledWith('SELECT $1::int AS id', [1]);
    expect(result.rows[0]?.id).toBe(1);
  });
});
