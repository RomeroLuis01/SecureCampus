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

    it('verifies that schema and security tables exist in isolated test database', async () => {
      const res = await testPool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'seguridad' AND table_name IN ('usuarios', 'credenciales', 'sesiones')
         ORDER BY table_name`
      );
      const tables = res.rows.map((r) => r.table_name);
      expect(tables).toContain('credenciales');
      expect(tables).toContain('sesiones');
      expect(tables).toContain('usuarios');
    });

    it('persists Argon2id password hash and validates credentials against PostgreSQL', async () => {
      const { hashPassword, verifyPassword } = await import('../../src/auth/argon2.service.js');
      const testEmail = `test_integration_${Date.now()}@securecampus.edu`;
      const testPlainPassword = 'IntegrationSecurePass2026!';

      // 1. Create person in nucleo.personas and user in seguridad.usuarios
      const persRes = await testPool.query<{ persona_id: string }>(
        `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
         VALUES ('Test', 'Integration', $1)
         RETURNING persona_id`,
        [testEmail]
      );
      const personaId = persRes.rows[0].persona_id;

      const userRes = await testPool.query<{ usuario_id: string }>(
        `INSERT INTO seguridad.usuarios (persona_id, estado)
         VALUES ($1, 'ACTIVO')
         RETURNING usuario_id`,
        [personaId]
      );
      const usuarioId = userRes.rows[0].usuario_id;
      expect(usuarioId).toBeDefined();

      // 2. Hash password with production Argon2id parameters
      const hash = await hashPassword(testPlainPassword);
      expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

      // 3. Persist credential into seguridad.credenciales
      await testPool.query(
        `INSERT INTO seguridad.credenciales (usuario_id, password_hash, estado)
         VALUES ($1, $2, 'ACTIVO')`,
        [usuarioId, hash]
      );

      // 4. Retrieve hash from PostgreSQL and verify
      const credRes = await testPool.query<{ password_hash: string; estado: string }>(
        `SELECT password_hash, estado FROM seguridad.credenciales WHERE usuario_id = $1`,
        [usuarioId]
      );
      expect(credRes.rows.length).toBe(1);
      expect(credRes.rows[0].estado).toBe('ACTIVO');

      const isValid = await verifyPassword(credRes.rows[0].password_hash, testPlainPassword);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword(credRes.rows[0].password_hash, 'WrongPassword123!');
      expect(isInvalid).toBe(false);

      // Deactivate credential instead of DELETE (securecampus_app has SELECT, INSERT, UPDATE only by policy)
      await testPool.query(
        `UPDATE seguridad.credenciales SET estado = 'BLOQUEADO' WHERE usuario_id = $1`,
        [usuarioId]
      );
    });

    it('manages session lifecycle (creation, lookup, revocation) in seguridad.sesiones', async () => {
      const { hashSessionToken } = await import('../../src/auth/session.service.js');
      const crypto = await import('node:crypto');
      const email = `sess_${Date.now()}_${Math.random().toString(36).substring(7)}@securecampus.edu`;

      // 1. Create a dummy person and user
      const persRes = await testPool.query<{ persona_id: string }>(
        `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
         VALUES ('Sess', 'User', $1)
         RETURNING persona_id`,
        [email]
      );
      const personaId = persRes.rows[0].persona_id;

      const userRes = await testPool.query<{ usuario_id: string }>(
        `INSERT INTO seguridad.usuarios (persona_id, estado)
         VALUES ($1, 'ACTIVO')
         RETURNING usuario_id`,
        [personaId]
      );
      const usuarioId = userRes.rows[0].usuario_id;

      // 2. Create raw session token and SHA-256 hash
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashSessionToken(rawToken);
      const expiraEn = new Date(Date.now() + 8 * 3600 * 1000);

      const sessRes = await testPool.query<{ sesion_id: string }>(
        `INSERT INTO seguridad.sesiones (usuario_id, token_hash, expira_en, direccion_ip, agente_usuario)
         VALUES ($1, $2, $3, '127.0.0.1'::inet, 'IntegrationTestRunner')
         RETURNING sesion_id`,
        [usuarioId, tokenHash, expiraEn]
      );
      const sesionId = sessRes.rows[0].sesion_id;
      expect(sesionId).toBeDefined();

      // 3. Query active session by token hash
      const activeRes = await testPool.query<{ sesion_id: string; revocado_en: Date | null }>(
        `SELECT sesion_id, revocado_en FROM seguridad.sesiones
         WHERE token_hash = $1 AND revocado_en IS NULL AND expira_en > now()`,
        [tokenHash]
      );
      expect(activeRes.rows.length).toBe(1);
      expect(activeRes.rows[0].sesion_id).toBe(sesionId);
      expect(activeRes.rows[0].revocado_en).toBeNull();

      // 4. Revoke session
      await testPool.query(
        `UPDATE seguridad.sesiones SET revocado_en = now() WHERE sesion_id = $1`,
        [sesionId]
      );

      // 5. Query again and verify it is no longer valid
      const revokedRes = await testPool.query(
        `SELECT sesion_id FROM seguridad.sesiones
         WHERE token_hash = $1 AND revocado_en IS NULL AND expira_en > now()`,
        [tokenHash]
      );
      expect(revokedRes.rows.length).toBe(0);
    });

    it('revokes all sessions when account is locked or deactivated', async () => {
      const { hashSessionToken } = await import('../../src/auth/session.service.js');
      const crypto = await import('node:crypto');
      const email = `multi_${Date.now()}_${Math.random().toString(36).substring(7)}@securecampus.edu`;

      const persRes = await testPool.query<{ persona_id: string }>(
        `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
         VALUES ('Multi', 'User', $1)
         RETURNING persona_id`,
        [email]
      );
      const personaId = persRes.rows[0].persona_id;

      const userRes = await testPool.query<{ usuario_id: string }>(
        `INSERT INTO seguridad.usuarios (persona_id, estado)
         VALUES ($1, 'ACTIVO')
         RETURNING usuario_id`,
        [personaId]
      );
      const usuarioId = userRes.rows[0].usuario_id;

      // Create 3 sessions for this user
      for (let i = 0; i < 3; i++) {
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = hashSessionToken(rawToken);
        const expiraEn = new Date(Date.now() + 8 * 3600 * 1000);
        await testPool.query(
          `INSERT INTO seguridad.sesiones (usuario_id, token_hash, expira_en, direccion_ip)
           VALUES ($1, $2, $3, '127.0.0.1'::inet)`,
          [usuarioId, tokenHash, expiraEn]
        );
      }

      const activeBefore = await testPool.query(
        `SELECT count(*)::text AS count FROM seguridad.sesiones WHERE usuario_id = $1 AND revocado_en IS NULL`,
        [usuarioId]
      );
      expect(activeBefore.rows[0].count).toBe('3');

      // Revoke all sessions for this user
      await testPool.query(
        `UPDATE seguridad.sesiones SET revocado_en = now() WHERE usuario_id = $1 AND revocado_en IS NULL`,
        [usuarioId]
      );

      const activeAfter = await testPool.query(
        `SELECT count(*)::text AS count FROM seguridad.sesiones WHERE usuario_id = $1 AND revocado_en IS NULL`,
        [usuarioId]
      );
      expect(activeAfter.rows[0].count).toBe('0');
    });

    it('enforces deterministic temporal boundaries (idle timeout and absolute TTL) in PostgreSQL', async () => {
      const { hashSessionToken } = await import('../../src/auth/session.service.js');
      const crypto = await import('node:crypto');
      const email = `temporal_${Date.now()}_${Math.random().toString(36).substring(7)}@securecampus.edu`;

      const persRes = await testPool.query<{ persona_id: string }>(
        `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
         VALUES ('Temporal', 'User', $1)
         RETURNING persona_id`,
        [email]
      );
      const personaId = persRes.rows[0].persona_id;

      const userRes = await testPool.query<{ usuario_id: string }>(
        `INSERT INTO seguridad.usuarios (persona_id, estado)
         VALUES ($1, 'ACTIVO')
         RETURNING usuario_id`,
        [personaId]
      );
      const usuarioId = userRes.rows[0].usuario_id;

      // Case A: Idle timeout boundary in SQL (inactive for 65 minutes)
      const idleRawToken = crypto.randomBytes(32).toString('base64url');
      const idleHash = hashSessionToken(idleRawToken);
      await testPool.query(
        `INSERT INTO seguridad.sesiones (
           usuario_id, token_hash, creado_en, ultimo_acceso_en, expira_en, direccion_ip
         ) VALUES (
           $1, $2,
           clock_timestamp() - interval '70 minutes',
           clock_timestamp() - interval '65 minutes',
           clock_timestamp() + interval '6 hours',
           '127.0.0.1'::inet
         )`,
        [usuarioId, idleHash]
      );

      // Verify that throttled renewal query fails (returns 0 rows) due to idle timeout (> 60 mins)
      const idleUpdateRes = await testPool.query(
        `UPDATE seguridad.sesiones
         SET ultimo_acceso_en = clock_timestamp()
         WHERE token_hash = $1
           AND revocado_en IS NULL
           AND expira_en > clock_timestamp()
           AND clock_timestamp() - ultimo_acceso_en <= make_interval(mins => 60)
         RETURNING sesion_id`,
        [idleHash]
      );
      expect(idleUpdateRes.rowCount).toBe(0);

      // Case B: Absolute TTL ceiling (active 10 seconds ago, but past 8-hour ceiling)
      const absRawToken = crypto.randomBytes(32).toString('base64url');
      const absHash = hashSessionToken(absRawToken);
      await testPool.query(
        `INSERT INTO seguridad.sesiones (
           usuario_id, token_hash, creado_en, ultimo_acceso_en, expira_en, direccion_ip
         ) VALUES (
           $1, $2,
           clock_timestamp() - interval '8 hours 5 minutes',
           clock_timestamp() - interval '10 seconds',
           clock_timestamp() - interval '5 minutes',
           '127.0.0.1'::inet
         )`,
        [usuarioId, absHash]
      );

      // Verify that active request CANNOT renew session past absolute expira_en
      const absUpdateRes = await testPool.query(
        `UPDATE seguridad.sesiones
         SET ultimo_acceso_en = clock_timestamp()
         WHERE token_hash = $1
           AND revocado_en IS NULL
           AND expira_en > clock_timestamp()
           AND clock_timestamp() - ultimo_acceso_en <= make_interval(mins => 60)
         RETURNING sesion_id`,
        [absHash]
      );
      expect(absUpdateRes.rowCount).toBe(0);

      // Case C: Valid session within both idle and absolute boundaries successfully renews
      const validRawToken = crypto.randomBytes(32).toString('base64url');
      const validHash = hashSessionToken(validRawToken);
      await testPool.query(
        `INSERT INTO seguridad.sesiones (
           usuario_id, token_hash, creado_en, ultimo_acceso_en, expira_en, direccion_ip
         ) VALUES (
           $1, $2,
           clock_timestamp() - interval '30 minutes',
           clock_timestamp() - interval '10 minutes',
           clock_timestamp() + interval '7 hours',
           '127.0.0.1'::inet
         )`,
        [usuarioId, validHash]
      );

      const validUpdateRes = await testPool.query(
        `UPDATE seguridad.sesiones
         SET ultimo_acceso_en = clock_timestamp()
         WHERE token_hash = $1
           AND revocado_en IS NULL
           AND expira_en > clock_timestamp()
           AND clock_timestamp() - ultimo_acceso_en <= make_interval(mins => 60)
         RETURNING sesion_id`,
        [validHash]
      );
      expect(validUpdateRes.rowCount).toBe(1);
    });
  });
});
