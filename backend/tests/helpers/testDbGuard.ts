/**
 * Dedicated error class for test database isolation violations.
 */
export class TestDatabaseIsolationError extends Error {
  public readonly isTestIsolationError = true;

  constructor(message: string) {
    super(message);
    this.name = 'TestDatabaseIsolationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ValidatedTestDbConfig {
  connectionString: string;
  databaseName: string;
}

/**
 * Validates that a database connection URL is strictly and unambiguously an isolated test database.
 * Enforces security invariants:
 * 1. Must be a valid PostgreSQL connection string.
 * 2. Database name MUST NEVER be 'securecampus' (the development/production database).
 * 3. Database URL MUST NOT match process.env.DATABASE_URL.
 * 4. Database name must match the designated test pattern (e.g. 'securecampus_test' or ending in '_test').
 *
 * Throws TestDatabaseIsolationError if any safety check fails.
 */
export function validateTestDatabaseUrl(rawUrl: string | undefined): ValidatedTestDbConfig {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new TestDatabaseIsolationError(
      '[Test Isolation Error] TEST_DATABASE_URL is not set or empty. Integration tests require an explicit, isolated test database.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new TestDatabaseIsolationError(
      '[Test Isolation Error] TEST_DATABASE_URL is not a valid URL.'
    );
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new TestDatabaseIsolationError(
      `[Test Isolation Error] TEST_DATABASE_URL must use postgres: or postgresql: protocol. Received: '${parsed.protocol}'`
    );
  }

  const dbName = parsed.pathname.replace(/^\//, '').trim();

  // INVARIANT 1: Never allow connecting to development database
  if (dbName.toLowerCase() === 'securecampus') {
    throw new TestDatabaseIsolationError(
      `[Test Isolation Error] CRITICAL SAFETY VIOLATION: TEST_DATABASE_URL points to development database 'securecampus'. Integration tests are strictly prohibited from touching the development database.`
    );
  }

  // INVARIANT 2: Never allow matching DATABASE_URL
  const devDbUrl = process.env.DATABASE_URL;
  if (devDbUrl && rawUrl.trim() === devDbUrl.trim()) {
    throw new TestDatabaseIsolationError(
      '[Test Isolation Error] CRITICAL SAFETY VIOLATION: TEST_DATABASE_URL is identical to DATABASE_URL.'
    );
  }

  // INVARIANT 3: Database name must follow unambiguous test pattern
  const isDedicatedTestDb = dbName === 'securecampus_test' || dbName.endsWith('_test');
  if (!isDedicatedTestDb) {
    throw new TestDatabaseIsolationError(
      `[Test Isolation Error] Database '${dbName}' does not comply with the test database naming policy. Test database name must be 'securecampus_test' or end with '_test'.`
    );
  }

  return {
    connectionString: rawUrl.trim(),
    databaseName: dbName,
  };
}

/**
 * Checks whether an isolated test database is configured and safe to use.
 * Returns true if valid, false otherwise (without throwing).
 */
export function isTestEnvironmentConfigured(): boolean {
  try {
    validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    return true;
  } catch {
    return false;
  }
}
