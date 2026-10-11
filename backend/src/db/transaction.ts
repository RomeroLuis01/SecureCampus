import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool as defaultPool } from '../config/database.js';

/**
 * Regex for standard UUID format (v1-v5).
 * Validates 8-4-4-4-12 hex characters.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Dedicated error class for transaction context and initialization errors.
 */
export class TransactionContextError extends Error {
  public readonly isTransactionContextError = true;

  constructor(message: string) {
    super(message);
    this.name = 'TransactionContextError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Restricted transactional client interface provided to the callback.
 * Exposes exclusively parameterized query operations within the active transaction.
 * Deliberately hides connection lifecycle methods (`connect`, `release`, `end`)
 * to prevent accidental connection leaks, multiple releases, or queries outside the transaction.
 */
export interface TransactionClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
}

/**
 * Options for configuring transactional execution.
 */
export interface TransactionOptions {
  /**
   * Optional custom pool instance for dependency injection and testing.
   * Defaults to the application's shared database pool.
   */
  pool?: Pool;
}

/**
 * Executes an application business operation within a dedicated PostgreSQL transaction
 * associated with an authenticated user identity.
 *
 * Sequence:
 * 1. Validates `usuarioId` before requesting a connection from the pool.
 * 2. Acquires a dedicated client via `pool.connect()`.
 * 3. Begins a transaction (`BEGIN`).
 * 4. Sets the user context transaction-locally: `SELECT set_config('app.usuario_id', $1, true)`.
 * 5. Executes the callback passing a restricted `TransactionClient` interface.
 * 6. Commits the transaction (`COMMIT`) on success.
 * 7. Rolls back the transaction (`ROLLBACK`) on error.
 * 8. Releases the client in a finally block, discarding it if rollback failed or connection was corrupted.
 *
 * All database operations performed via `client.query` within the callback execute on the
 * exact same physical connection and within the same transaction.
 *
 * @param usuarioId The UUID of the authenticated user to set as the transaction context.
 * @param callback Business logic callback receiving the transactional client.
 * @param options Optional transaction options (e.g. custom pool for testing).
 * @returns The return value of the callback.
 */
export async function withUserTransaction<T>(
  usuarioId: string,
  callback: (client: TransactionClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  // 1. Validate user identifier strictly before requesting any connection from the pool
  if (!usuarioId || typeof usuarioId !== 'string' || !UUID_REGEX.test(usuarioId.trim())) {
    throw new TransactionContextError(
      `Invalid usuarioId: must be a valid non-empty UUID string. Received: '${
        typeof usuarioId === 'string' ? (usuarioId.length > 20 ? usuarioId.slice(0, 20) + '...' : usuarioId) : typeof usuarioId
      }'`
    );
  }

  const normalizedUserId = usuarioId.trim();
  const poolInstance = options?.pool ?? defaultPool;

  // 2. Acquire a dedicated client from the pool
  const client: PoolClient = await poolInstance.connect();

  let isInTransaction = false;
  let shouldDestroyClient = false;

  try {
    // 3. Begin transaction
    await client.query('BEGIN');
    isInTransaction = true;

    // 4. Set transaction-local user context using parameterized query ($1)
    // The third parameter `true` (is_local) restricts the setting exclusively to this transaction.
    await client.query("SELECT set_config('app.usuario_id', $1, true)", [normalizedUserId]);

    // 5. Wrap client in restricted TransactionClient interface
    const txClient: TransactionClient = {
      query: <R extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
      ): Promise<QueryResult<R>> => {
        return client.query<R>(text, params);
      },
    };

    // 6. Execute business callback
    const result = await callback(txClient);

    // 7. Commit transaction
    await client.query('COMMIT');
    isInTransaction = false;

    return result;
  } catch (error) {
    // 8. Rollback on failure if transaction was opened
    if (isInTransaction) {
      try {
        await client.query('ROLLBACK');
        isInTransaction = false;
      } catch (rollbackError) {
        // Rollback failure indicates connection corruption, aborted socket or driver fault.
        // Mark client to be discarded from the pool rather than returned healthy.
        shouldDestroyClient = true;
        const sanitizedMessage =
          rollbackError instanceof Error ? rollbackError.message : 'Unknown error during rollback';
        console.error(
          `[Transaction Manager] Critical error executing ROLLBACK: ${sanitizedMessage}. Connection marked for disposal.`
        );
      }
    }

    // Propagate the original error without masking
    throw error;
  } finally {
    // 9. Release client in all cases
    try {
      if (shouldDestroyClient) {
        // Passing true to release() instructs pg-pool to discard and close the connection
        client.release(true);
      } else {
        client.release();
      }
    } catch (releaseError) {
      const sanitized =
        releaseError instanceof Error ? releaseError.message : 'Unknown error during client release';
      console.error(`[Transaction Manager] Error releasing database client: ${sanitized}`);
    }
  }
}
