import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryResult } from 'pg';
import {
  hashSessionToken,
  validateSession,
} from '../../src/auth/session.service.js';
import * as databaseModule from '../../src/config/database.js';

describe('session.service (Unit Tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. hashSessionToken computes strictly a 64-character lowercase hex string', () => {
    const rawToken = 'test-token-random-value-1234567890';
    const hash = hashSessionToken(rawToken);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic equality
    expect(hashSessionToken(rawToken)).toBe(hash);
  });

  it('2. validateSession rejects empty or invalid token inputs immediately', async () => {
    const res1 = await validateSession('');
    const res2 = await validateSession('   ');

    expect(res1.isValid).toBe(false);
    expect(res1.reason).toBe('NOT_FOUND');
    expect(res2.isValid).toBe(false);
  });

  it('3. validateSession identifies revoked sessions', async () => {
    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: '11111111-1111-1111-1111-111111111111',
          usuario_id: '22222222-2222-2222-2222-222222222222',
          creado_en: new Date(),
          ultimo_acceso_en: new Date(),
          expira_en: new Date(Date.now() + 3600000),
          revocado_en: new Date(), // Revoked!
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('some-token');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('REVOKED');
  });

  it('4. validateSession identifies absolute expired sessions', async () => {
    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: '11111111-1111-1111-1111-111111111111',
          usuario_id: '22222222-2222-2222-2222-222222222222',
          creado_en: new Date(Date.now() - 100000),
          ultimo_acceso_en: new Date(),
          expira_en: new Date(Date.now() - 1000), // In the past!
          revocado_en: null,
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('some-token');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('EXPIRED_ABSOLUTE');
  });

  it('5. validateSession identifies idle expired sessions', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);

    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: '11111111-1111-1111-1111-111111111111',
          usuario_id: '22222222-2222-2222-2222-222222222222',
          creado_en: twoHoursAgo,
          ultimo_acceso_en: twoHoursAgo, // Exceeds default 60 min idle
          expira_en: new Date(Date.now() + 3600000),
          revocado_en: null,
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('some-token');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('EXPIRED_IDLE');
  });

  it('6. validateSession accepts active sessions and returns identities', async () => {
    const recentAccess = new Date(Date.now() - 60000); // 1 minute ago

    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: 'session-valid-uuid',
          usuario_id: 'user-valid-uuid',
          creado_en: recentAccess,
          ultimo_acceso_en: recentAccess,
          expira_en: new Date(Date.now() + 3600000),
          revocado_en: null,
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('valid-token');

    expect(result.isValid).toBe(true);
    expect(result.sesionId).toBe('session-valid-uuid');
    expect(result.usuarioId).toBe('user-valid-uuid');
  });

  it('7. validateSession throttles write: does not query UPDATE when last access is within 5 minutes', async () => {
    const recentAccess = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const querySpy = vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: 'session-throttled-uuid',
          usuario_id: 'user-throttled-uuid',
          creado_en: recentAccess,
          ultimo_acceso_en: recentAccess,
          expira_en: new Date(Date.now() + 3600000),
          revocado_en: null,
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('throttled-token');

    expect(result.isValid).toBe(true);
    // Only the initial SELECT was called; no UPDATE statement was executed
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy.mock.calls[0][0]).toContain('SELECT sesion_id');
  });

  it('8. validateSession triggers atomic UPDATE when last access is >= 5 minutes ago and session is valid', async () => {
    const accessTenMinAgo = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const querySpy = vi
      .spyOn(databaseModule, 'query')
      // 1. Initial SELECT
      .mockResolvedValueOnce({
        rows: [
          {
            sesion_id: 'session-touch-uuid',
            usuario_id: 'user-touch-uuid',
            creado_en: accessTenMinAgo,
            ultimo_acceso_en: accessTenMinAgo,
            expira_en: new Date(Date.now() + 3600000),
            revocado_en: null,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      // 2. Atomic UPDATE with RETURNING sesion_id
      .mockResolvedValueOnce({
        rows: [{ sesion_id: 'session-touch-uuid' }],
        rowCount: 1,
      } as unknown as QueryResult);

    const result = await validateSession('touch-token');

    expect(result.isValid).toBe(true);
    expect(result.sesionId).toBe('session-touch-uuid');
    expect(querySpy).toHaveBeenCalledTimes(2);
    expect(querySpy.mock.calls[1][0]).toContain('UPDATE seguridad.sesiones');
    expect(querySpy.mock.calls[1][0]).toContain('make_interval(mins => $2::integer)');
  });

  it('9. validateSession rejects when atomic UPDATE affects 0 rows because session was revoked concurrently', async () => {
    const accessTenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    vi.spyOn(databaseModule, 'query')
      // 1. Initial SELECT saw row before concurrent revocation
      .mockResolvedValueOnce({
        rows: [
          {
            sesion_id: 'session-revoked-race',
            usuario_id: 'user-revoked-race',
            creado_en: accessTenMinAgo,
            ultimo_acceso_en: accessTenMinAgo,
            expira_en: new Date(Date.now() + 3600000),
            revocado_en: null,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      // 2. UPDATE returns 0 rows because another request set revocado_en
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as unknown as QueryResult)
      // 3. Fallback verification query confirms revocado_en IS NOT NULL
      .mockResolvedValueOnce({
        rows: [
          {
            revocado_en: new Date(),
            expira_en: new Date(Date.now() + 3600000),
            ultimo_acceso_en: accessTenMinAgo,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult);

    const result = await validateSession('race-token');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('REVOKED');
  });

  it('10. validateSession rejects when delayed UPDATE affects 0 rows because session expired by idle timeout', async () => {
    const accessTenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    vi.spyOn(databaseModule, 'query')
      // 1. Initial SELECT
      .mockResolvedValueOnce({
        rows: [
          {
            sesion_id: 'session-delayed-idle',
            usuario_id: 'user-delayed-idle',
            creado_en: accessTenMinAgo,
            ultimo_acceso_en: accessTenMinAgo,
            expira_en: new Date(Date.now() + 3600000),
            revocado_en: null,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      // 2. UPDATE returns 0 rows because clock_timestamp - ultimo_acceso_en > idle timeout in DB
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as unknown as QueryResult)
      // 3. Fallback verification query confirms idle expiration
      .mockResolvedValueOnce({
        rows: [
          {
            revocado_en: null,
            expira_en: new Date(Date.now() + 3600000),
            ultimo_acceso_en: new Date(Date.now() - 65 * 60 * 1000), // Exceeded 60 min
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult);

    const result = await validateSession('delayed-idle-token');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('EXPIRED_IDLE');
  });

  it('11. validateSession rejects when delayed UPDATE affects 0 rows because session reached absolute expiration', async () => {
    const accessTenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    vi.spyOn(databaseModule, 'query')
      // 1. Initial SELECT
      .mockResolvedValueOnce({
        rows: [
          {
            sesion_id: 'session-delayed-abs',
            usuario_id: 'user-delayed-abs',
            creado_en: accessTenMinAgo,
            ultimo_acceso_en: accessTenMinAgo,
            expira_en: new Date(Date.now() + 1000),
            revocado_en: null,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      // 2. UPDATE returns 0 rows because expira_en <= clock_timestamp in DB
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as unknown as QueryResult)
      // 3. Fallback verification query confirms absolute expiration
      .mockResolvedValueOnce({
        rows: [
          {
            revocado_en: null,
            expira_en: new Date(Date.now() - 1000), // Already passed
            ultimo_acceso_en: accessTenMinAgo,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult);

    const result = await validateSession('delayed-abs-token');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('EXPIRED_ABSOLUTE');
  });

  it('12. deterministic boundary: session at exactly 60 minutes of inactivity remains valid', async () => {
    const fixedNow = 1_700_000_000_000;
    const exactly60MinAgo = new Date(fixedNow - 60 * 60 * 1000); // exactly 3,600,000 ms

    vi.spyOn(databaseModule, 'query')
      .mockResolvedValueOnce({
        rows: [
          {
            sesion_id: 'session-boundary-valid',
            usuario_id: 'user-boundary-valid',
            creado_en: exactly60MinAgo,
            ultimo_acceso_en: exactly60MinAgo,
            expira_en: new Date(fixedNow + 4 * 3600 * 1000),
            revocado_en: null,
            db_now: new Date(fixedNow),
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      .mockResolvedValueOnce({
        rows: [{ sesion_id: 'session-boundary-valid' }],
        rowCount: 1,
      } as unknown as QueryResult);

    const result = await validateSession('boundary-valid-token');
    expect(result.isValid).toBe(true);
    expect(result.sesionId).toBe('session-boundary-valid');
  });

  it('13. deterministic boundary: session at 60 minutes + 1 ms of inactivity is expired (EXPIRED_IDLE)', async () => {
    const fixedNow = 1_700_000_000_000;
    const over60MinAgo = new Date(fixedNow - (60 * 60 * 1000 + 1)); // 3,600,001 ms

    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: 'session-boundary-idle',
          usuario_id: 'user-boundary-idle',
          creado_en: over60MinAgo,
          ultimo_acceso_en: over60MinAgo,
          expira_en: new Date(fixedNow + 4 * 3600 * 1000),
          revocado_en: null,
          db_now: new Date(fixedNow),
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('boundary-idle-token');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('EXPIRED_IDLE');
  });

  it('14. deterministic boundary: session at exactly expira_en is expired (EXPIRED_ABSOLUTE)', async () => {
    const fixedNow = 1_700_000_000_000;
    const recentAccess = new Date(fixedNow - 60 * 1000); // Active 1 min ago
    const exactExpiration = new Date(fixedNow); // now === expira_en

    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: 'session-boundary-abs',
          usuario_id: 'user-boundary-abs',
          creado_en: new Date(fixedNow - 8 * 3600 * 1000),
          ultimo_acceso_en: recentAccess,
          expira_en: exactExpiration,
          revocado_en: null,
          db_now: new Date(fixedNow),
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('boundary-abs-token');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('EXPIRED_ABSOLUTE');
  });

  it('15. deterministic boundary: session at expira_en - 1 ms remains valid', async () => {
    const fixedNow = 1_700_000_000_000;
    const recentAccess = new Date(fixedNow - 60 * 1000); // Active 1 min ago
    const oneMsBeforeExpiration = new Date(fixedNow + 1);

    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: 'session-boundary-not-abs',
          usuario_id: 'user-boundary-not-abs',
          creado_en: new Date(fixedNow - 8 * 3600 * 1000 + 1),
          ultimo_acceso_en: recentAccess,
          expira_en: oneMsBeforeExpiration,
          revocado_en: null,
          db_now: new Date(fixedNow),
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('boundary-not-abs-token');
    expect(result.isValid).toBe(true);
    expect(result.sesionId).toBe('session-boundary-not-abs');
  });

  it('16. interaction: highly active user at 8h absolute ceiling is strictly rejected with EXPIRED_ABSOLUTE', async () => {
    const fixedNow = 1_700_000_000_000;
    const veryRecentAccess = new Date(fixedNow - 10 * 1000); // 10 seconds ago (definitely not idle)
    const eightHoursPast = new Date(fixedNow - 1); // absolute expiration passed by 1 ms

    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          sesion_id: 'session-active-but-abs-expired',
          usuario_id: 'user-active-but-abs-expired',
          creado_en: new Date(fixedNow - 8 * 3600 * 1000 - 1),
          ultimo_acceso_en: veryRecentAccess,
          expira_en: eightHoursPast,
          revocado_en: null,
          db_now: new Date(fixedNow),
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    const result = await validateSession('active-but-abs-token');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('EXPIRED_ABSOLUTE');
  });
});
