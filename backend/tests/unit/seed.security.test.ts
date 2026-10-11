import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateSeedEnvironment,
  verifyDatabaseDestination,
  seedDevUsers,
  SeedSecurityError,
  isPrivateOrLoopbackIp,
  sanitizeConnectionUrl,
} from '../../../scripts/seed-dev-users.js';

describe('Development Seed Security & Protection Suite (SEC-05)', () => {
  const validDevEnv = {
    NODE_ENV: 'development',
    ALLOW_DEV_SEEDS: 'true',
    DATABASE_URL: 'postgres://securecampus_app:dev_app@localhost:5432/securecampus',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Environment & Configuration Safety Tests (Layer 1)
  // -------------------------------------------------------------------------
  describe('Layer 1: validateSeedEnvironment', () => {
    it('1. blocks execution when NODE_ENV is undefined or empty', () => {
      expect(() => {
        validateSeedEnvironment({
          ...validDevEnv,
          NODE_ENV: undefined,
        });
      }).toThrowError(SeedSecurityError);

      try {
        validateSeedEnvironment({ ...validDevEnv, NODE_ENV: '' });
      } catch (err) {
        expect((err as SeedSecurityError).code).toBe('MISSING_NODE_ENV');
      }
    });

    it('2. strictly blocks execution when NODE_ENV is production', () => {
      try {
        validateSeedEnvironment({
          ...validDevEnv,
          NODE_ENV: 'production',
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect((err as SeedSecurityError).code).toBe('PRODUCTION_ENVIRONMENT');
        expect((err as Error).message).toContain('prohibido');
      }
    });

    it('3. blocks execution when NODE_ENV is an unauthorized or unexpected string (e.g. staging, qa, live)', () => {
      for (const envVal of ['staging', 'qa', 'live', 'prod', 'preview']) {
        expect(() => {
          validateSeedEnvironment({
            ...validDevEnv,
            NODE_ENV: envVal,
          });
        }).toThrowError(SeedSecurityError);
      }
    });

    it('4. blocks execution when explicit authorization flag ALLOW_DEV_SEEDS is absent', () => {
      try {
        validateSeedEnvironment({
          ...validDevEnv,
          ALLOW_DEV_SEEDS: undefined,
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect((err as SeedSecurityError).code).toBe('MISSING_EXPLICIT_AUTHORIZATION');
      }
    });

    it('5. blocks execution when ALLOW_DEV_SEEDS has an invalid or non-exact value (yes, 1, TRUE, false)', () => {
      for (const invalidFlag of ['yes', '1', 'TRUE', 'True', 'enabled', 'false', '0']) {
        try {
          validateSeedEnvironment({
            ...validDevEnv,
            ALLOW_DEV_SEEDS: invalidFlag,
          });
          expect.unreachable(`Should have thrown for flag: ${invalidFlag}`);
        } catch (err) {
          expect((err as SeedSecurityError).code).toBe('MISSING_EXPLICIT_AUTHORIZATION');
        }
      }
    });

    it('6. blocks execution when DATABASE_URL is missing or invalid', () => {
      expect(() => {
        validateSeedEnvironment({ ...validDevEnv, DATABASE_URL: undefined });
      }).toThrowError(/DATABASE_URL no está configurada/);

      expect(() => {
        validateSeedEnvironment({ ...validDevEnv, DATABASE_URL: 'not-a-url' });
      }).toThrowError(/no es una URL de conexión válida/);
    });

    it('7. blocks execution when DATABASE_URL points to a non-local/remote host (AWS RDS, Cloud SQL, Neon, etc.)', () => {
      const remoteHosts = [
        'postgres://securecampus_app:secret@db.rds.amazonaws.com:5432/securecampus',
        'postgres://securecampus_app:secret@securecampus.prod.internal:5432/securecampus',
        'postgres://securecampus_app:secret@ep-cool-db.us-east-2.aws.neon.tech:5432/securecampus',
        'postgres://securecampus_app:secret@198.51.100.25:5432/securecampus',
      ];

      for (const url of remoteHosts) {
        try {
          validateSeedEnvironment({ ...validDevEnv, DATABASE_URL: url });
          expect.unreachable(`Should have thrown for host in ${url}`);
        } catch (err) {
          expect((err as SeedSecurityError).code).toBe('NON_LOCAL_HOST');
        }
      }
    });

    it('8. blocks execution when database name is unauthorized for dev seeding', () => {
      const unauthorizedDbs = [
        'postgres://securecampus_app:pass@localhost:5432/securecampus_prod',
        'postgres://securecampus_app:pass@localhost:5432/production',
        'postgres://securecampus_app:pass@localhost:5432/alumnos_db',
      ];

      for (const url of unauthorizedDbs) {
        try {
          validateSeedEnvironment({ ...validDevEnv, DATABASE_URL: url });
          expect.unreachable('Should have thrown');
        } catch (err) {
          expect((err as SeedSecurityError).code).toBe('UNAUTHORIZED_DATABASE_NAME');
        }
      }
    });

    it('9. blocks execution if user is not securecampus_app', () => {
      try {
        validateSeedEnvironment({
          ...validDevEnv,
          DATABASE_URL: 'postgres://postgres:root@localhost:5432/securecampus',
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect((err as SeedSecurityError).code).toBe('UNAUTHORIZED_DB_USER');
      }
    });

    it('10. accepts legitimate local development configuration (localhost, 127.0.0.1, [::1], db)', () => {
      for (const host of ['localhost', '127.0.0.1', '[::1]', 'db', 'postgres']) {
        const config = validateSeedEnvironment({
          ...validDevEnv,
          DATABASE_URL: `postgres://securecampus_app:dev_app@${host}:5432/securecampus`,
        });

        expect(config.nodeEnv).toBe('development');
        expect(config.databaseName).toBe('securecampus');
        expect(config.username).toBe('securecampus_app');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Live Database Destination Probe Tests (Layer 2)
  // -------------------------------------------------------------------------
  describe('Layer 2: verifyDatabaseDestination', () => {
    const expected = {
      nodeEnv: 'development',
      host: 'localhost',
      port: 5432,
      databaseName: 'securecampus',
      username: 'securecampus_app',
    };

    it('11. verifies live destination when catalog probe matches expected database and user', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [
            {
              db_name: 'securecampus',
              db_user: 'securecampus_app',
              server_ip: '127.0.0.1',
            },
          ],
        }),
      };

      const verified = await verifyDatabaseDestination(mockClient as any, expected);
      expect(verified.liveDatabaseName).toBe('securecampus');
      expect(verified.liveCurrentUser).toBe('securecampus_app');
    });

    it('12. aborts if live database name does not match expected database (discrepancy detected)', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [
            {
              db_name: 'prod_database_secret',
              db_user: 'securecampus_app',
              server_ip: '127.0.0.1',
            },
          ],
        }),
      };

      await expect(verifyDatabaseDestination(mockClient as any, expected)).rejects.toThrowError(
        /Discrepancia de base de datos/
      );
    });

    it('13. aborts if live database user does not match expected user', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [
            {
              db_name: 'securecampus',
              db_user: 'postgres',
              server_ip: '127.0.0.1',
            },
          ],
        }),
      };

      await expect(verifyDatabaseDestination(mockClient as any, expected)).rejects.toThrowError(
        /Discrepancia de usuario/
      );
    });

    it('14. aborts if live server IP resolves to a public internet address', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [
            {
              db_name: 'securecampus',
              db_user: 'securecampus_app',
              server_ip: '93.184.216.34', // Public IP!
            },
          ],
        }),
      };

      await expect(verifyDatabaseDestination(mockClient as any, expected)).rejects.toThrowError(
        /dirección IP pública no autorizada/
      );
    });

    it('15. aborts safely if live probe query fails', async () => {
      const mockClient = {
        query: vi.fn().mockRejectedValueOnce(new Error('Connection terminated unexpectedly')),
      };

      await expect(verifyDatabaseDestination(mockClient as any, expected)).rejects.toThrowError(
        /Error al sondear el destino de la base de datos/
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. End-to-End Safety: Zero Writes on Unauthorized Invocations
  // -------------------------------------------------------------------------
  describe('Zero-Writes Invariant on Unauthorized Attempts', () => {
    it('16. prevents ANY SQL write or BEGIN transaction when validation fails (Layer 1 rejection)', async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };

      // Configuration that previously ran without checks in old code (missing ALLOW_DEV_SEEDS)
      const previouslyPermissiveEnv = {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://securecampus_app:dev_app@localhost:5432/securecampus',
      };

      await expect(
        seedDevUsers({
          client: mockClient as any,
          env: previouslyPermissiveEnv,
          skipClosePool: true,
        })
      ).rejects.toThrowError(/Falta la autorización explícita ALLOW_DEV_SEEDS=true/);

      // Verify ZERO queries were made to the database client (no probe, no BEGIN, no INSERT)
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('17. prevents ANY SQL write or BEGIN when live destination probe fails (Layer 2 rejection)', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [
            {
              db_name: 'production_mismatch',
              db_user: 'securecampus_app',
              server_ip: '127.0.0.1',
            },
          ],
        }),
        release: vi.fn(),
      };

      await expect(
        seedDevUsers({
          client: mockClient as any,
          env: validDevEnv,
          skipClosePool: true,
        })
      ).rejects.toThrowError(/Discrepancia de base de datos/);

      // Only the probe query was executed; BEGIN and INSERT were NEVER invoked!
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(mockClient.query.mock.calls[0][0]).toContain('SELECT');
      expect(mockClient.query.mock.calls[0][0]).not.toContain('BEGIN');
      expect(mockClient.query.mock.calls[0][0]).not.toContain('INSERT');
    });

    it('18. rolls back transaction and cleans up if a failure occurs during seed insertions', async () => {
      const queryHistory: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          queryHistory.push(sql);
          if (sql.includes('current_database()')) {
            return {
              rows: [{ db_name: 'securecampus', db_user: 'securecampus_app', server_ip: '127.0.0.1' }],
            };
          }
          if (sql === 'BEGIN') {
            return { rows: [] };
          }
          if (sql.includes('nucleo.carreras')) {
            throw new Error('Simulated database write error during ISC career insertion');
          }
          if (sql === 'ROLLBACK') {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      await expect(
        seedDevUsers({
          client: mockClient as any,
          env: validDevEnv,
          skipClosePool: true,
        })
      ).rejects.toThrowError(/Simulated database write error/);

      // Verifies that ROLLBACK was called
      expect(queryHistory).toContain('BEGIN');
      expect(queryHistory).toContain('ROLLBACK');
      expect(queryHistory).not.toContain('COMMIT');
    });

    it('19. successfully executes complete seeding when all Layer 1 and Layer 2 checks pass', async () => {
      const queryHistory: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          queryHistory.push(sql);
          if (sql.includes('current_database()')) {
            return {
              rows: [{ db_name: 'securecampus', db_user: 'securecampus_app', server_ip: '127.0.0.1' }],
            };
          }
          if (sql.includes('nucleo.carreras')) {
            return { rows: [{ carrera_id: 'carr-1' }] };
          }
          if (sql.includes('seguridad.roles')) {
            return {
              rows: [
                { rol_id: 'r-jefe', codigo: 'JEFE_CARRERA' },
                { rol_id: 'r-prof', codigo: 'PROFESOR' },
                { rol_id: 'r-alu', codigo: 'ALUMNO' },
              ],
            };
          }
          if (sql.includes('nucleo.personas')) {
            return { rows: [{ persona_id: 'p-1' }] };
          }
          if (sql.includes('seguridad.usuarios')) {
            return { rows: [{ usuario_id: 'u-1' }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const result = await seedDevUsers({
        client: mockClient as any,
        env: validDevEnv,
        skipClosePool: true,
      });

      expect(result.success).toBe(true);
      expect(result.seededCount).toBe(3);
      expect(result.identities).toContain('a.martinez@securecampus.edu');
      expect(result.identities).toContain('a.mendez@securecampus.edu');
      expect(result.identities).toContain('v.morales@securecampus.edu');
      expect(queryHistory).toContain('BEGIN');
      expect(queryHistory).toContain('COMMIT');
      expect(queryHistory).not.toContain('ROLLBACK');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Utility Functions Tests
  // -------------------------------------------------------------------------
  describe('Utility: IP Validation and URL Sanitization', () => {
    it('20. isPrivateOrLoopbackIp accurately classifies loopback and RFC 1918 IPs', () => {
      expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('::1')).toBe(true);
      expect(isPrivateOrLoopbackIp('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('10.0.0.5')).toBe(true);
      expect(isPrivateOrLoopbackIp('172.17.0.2')).toBe(true);
      expect(isPrivateOrLoopbackIp('172.31.255.254')).toBe(true);
      expect(isPrivateOrLoopbackIp('192.168.1.100')).toBe(true);

      // Public IPs
      expect(isPrivateOrLoopbackIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrLoopbackIp('1.1.1.1')).toBe(false);
      expect(isPrivateOrLoopbackIp('172.15.0.1')).toBe(false); // below 16
      expect(isPrivateOrLoopbackIp('172.32.0.1')).toBe(false); // above 31
      expect(isPrivateOrLoopbackIp('203.0.113.195')).toBe(false);
    });

    it('21. sanitizeConnectionUrl redacts sensitive connection strings', () => {
      const raw = 'postgres://securecampus_app:SuperSecretPass123!@localhost:5432/securecampus';
      const sanitized = sanitizeConnectionUrl(raw);
      expect(sanitized).not.toContain('SuperSecretPass123!');
      expect(sanitized).toBe('[REDACTED_DATABASE_URL]');
    });
  });
});
