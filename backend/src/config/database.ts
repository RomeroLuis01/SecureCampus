import pg from 'pg';
import type { QueryResult, QueryResultRow, PoolConfig } from 'pg';
import { config } from './env.js';

const { Pool } = pg;

const poolConfig: PoolConfig = {
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: config.DB_IDLE_TIMEOUT_MS,
};

/**
 * Shared PostgreSQL connection pool instance.
 * Connections are created lazily upon demand.
 */
export const pool = new Pool(poolConfig);

// Listen to unexpected errors on idle clients to prevent crashing the process
pool.on('error', (err: Error) => {
  // Never log connection string, passwords, or credentials
  const sanitizedMessage = err.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_URL]');
  console.error('[Database Pool] Unexpected error on idle client:', sanitizedMessage);
});

/**
 * Executes a parameterized query using the shared connection pool.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Checks connectivity to PostgreSQL by executing an innocuous parameterized query.
 * Returns true if available, false otherwise.
 * Never throws exceptions or leaks credentials.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1 AS ready');
    return Boolean(result && result.rows && result.rows.length > 0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    const sanitized = message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_URL]');
    console.error(`[Database Readiness] Database probe failed: ${sanitized}`);
    return false;
  }
}

let isPoolClosing = false;

/**
 * Closes all active connections in the pool cleanly.
 * Safe against multiple invocations.
 */
export async function closePool(): Promise<void> {
  if (isPoolClosing) {
    return;
  }
  isPoolClosing = true;

  try {
    await pool.end();
    console.log('[Database Pool] PostgreSQL pool closed cleanly.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Database Pool] Error during pool close: ${message}`);
  }
}

export type { QueryResult, QueryResultRow };
