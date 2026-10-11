import crypto from 'node:crypto';
import { query } from '../config/database.js';
import { config } from '../config/env.js';

export interface SessionValidationResult {
  isValid: boolean;
  sesionId?: string;
  usuarioId?: string;
  reason?: 'NOT_FOUND' | 'REVOKED' | 'EXPIRED_ABSOLUTE' | 'EXPIRED_IDLE';
}

export interface CreatedSession {
  rawToken: string;
  sesionId: string;
  expiraEn: Date;
}

/**
 * Computes deterministic SHA-256 hexadecimal hash from high-entropy session raw token.
 * Output is strictly 64 lowercase hexadecimal characters.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates a cryptographically secure 256-bit random session token (rawToken)
 * and persists strictly its SHA-256 hash into PostgreSQL.
 */
export async function createSession(
  usuarioId: string,
  direccionIp?: string,
  agenteUsuario?: string
): Promise<CreatedSession> {
  // 32 bytes CSPRNG = 256 bits of high entropy
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);

  const ttlMilliseconds = config.SESSION_TTL_HOURS * 3600 * 1000;
  const expiraEn = new Date(Date.now() + ttlMilliseconds);

  // Normalize IPv4-mapped IPv6 if needed (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
  const normalizedIp = direccionIp?.replace(/^::ffff:/, '') || null;

  const result = await query<{ sesion_id: string }>(
    `INSERT INTO seguridad.sesiones (
       usuario_id,
       token_hash,
       expira_en,
       direccion_ip,
       agente_usuario
     ) VALUES ($1, $2, $3, $4::inet, $5)
     RETURNING sesion_id`,
    [usuarioId, tokenHash, expiraEn, normalizedIp, agenteUsuario ?? null]
  );

  return {
    rawToken,
    sesionId: result.rows[0].sesion_id,
    expiraEn,
  };
}

/**
 * Validates a session token with absolute and idle timeout checks,
 * applying write throttling (updating activity at most once every 5 minutes).
 */
export async function validateSession(rawToken: string): Promise<SessionValidationResult> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim() === '') {
    return { isValid: false, reason: 'NOT_FOUND' };
  }

  const tokenHash = hashSessionToken(rawToken);

  const res = await query<{
    sesion_id: string;
    usuario_id: string;
    creado_en: Date;
    ultimo_acceso_en: Date;
    expira_en: Date;
    revocado_en: Date | null;
    db_now?: Date;
  }>(
    `SELECT sesion_id, usuario_id, creado_en, ultimo_acceso_en, expira_en, revocado_en, clock_timestamp() AS db_now
     FROM seguridad.sesiones
     WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!res.rows || res.rows.length === 0) {
    return { isValid: false, reason: 'NOT_FOUND' };
  }

  const session = res.rows[0];
  // Prefer database clock_timestamp() to eliminate clock drift between Node.js and PostgreSQL.
  // Fallback to Date.now() if db_now is not populated (e.g. in unit test mocks).
  const now = session.db_now ? new Date(session.db_now).getTime() : Date.now();

  // 1. Revocation check
  if (session.revocado_en !== null) {
    return { isValid: false, reason: 'REVOKED' };
  }

  // 2. Absolute expiration check
  if (now >= new Date(session.expira_en).getTime()) {
    return { isValid: false, reason: 'EXPIRED_ABSOLUTE' };
  }

  // 3. Idle timeout check
  const idleTimeoutMs = config.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  const lastAccessMs = new Date(session.ultimo_acceso_en).getTime();

  if (now - lastAccessMs > idleTimeoutMs) {
    return { isValid: false, reason: 'EXPIRED_IDLE' };
  }

  // 4. Write throttling & atomic activity renewal
  // Only execute update if at least 5 minutes have elapsed since last recorded access.
  const fiveMinutesMs = 5 * 60 * 1000;
  if (now - lastAccessMs >= fiveMinutesMs) {
    try {
      const updateResult = await query<{ sesion_id: string }>(
        `UPDATE seguridad.sesiones
         SET ultimo_acceso_en = CASE
           WHEN clock_timestamp() - ultimo_acceso_en >= interval '5 minutes' THEN clock_timestamp()
           ELSE ultimo_acceso_en
         END
         WHERE token_hash = $1
           AND revocado_en IS NULL
           AND expira_en > clock_timestamp()
           AND clock_timestamp() - ultimo_acceso_en <= make_interval(mins => $2::integer)
         RETURNING sesion_id`,
        [tokenHash, config.SESSION_IDLE_TIMEOUT_MINUTES]
      );

      // If rowCount is 0, the session could not be renewed.
      // This indicates that the session was revoked concurrently, or reached
      // absolute expiration or idle timeout in PostgreSQL before the update executed.
      if (!updateResult.rows || updateResult.rows.length === 0) {
        // Inspect current state to determine precise terminal reason
        const checkRes = await query<{
          revocado_en: Date | null;
          expira_en: Date;
          ultimo_acceso_en: Date;
          db_now?: Date;
        }>(
          `SELECT revocado_en, expira_en, ultimo_acceso_en, clock_timestamp() AS db_now
           FROM seguridad.sesiones
           WHERE token_hash = $1`,
          [tokenHash]
        );

        if (!checkRes.rows || checkRes.rows.length === 0) {
          return { isValid: false, reason: 'NOT_FOUND' };
        }

        const freshSession = checkRes.rows[0];
        const freshNow = freshSession.db_now ? new Date(freshSession.db_now).getTime() : Date.now();

        if (freshSession.revocado_en !== null) {
          return { isValid: false, reason: 'REVOKED' };
        }
        if (freshNow >= new Date(freshSession.expira_en).getTime()) {
          return { isValid: false, reason: 'EXPIRED_ABSOLUTE' };
        }
        if (freshNow - new Date(freshSession.ultimo_acceso_en).getTime() > idleTimeoutMs) {
          return { isValid: false, reason: 'EXPIRED_IDLE' };
        }

        return { isValid: false, reason: 'EXPIRED_IDLE' };
      }
    } catch (err) {
      console.error(
        '[Session Service] Error during throttled session update:',
        err instanceof Error ? err.message : 'Unknown error'
      );
      return { isValid: false, reason: 'NOT_FOUND' };
    }
  }

  return {
    isValid: true,
    sesionId: session.sesion_id,
    usuarioId: session.usuario_id,
  };
}

/**
 * Revokes a single session by raw token.
 */
export async function revokeSession(rawToken: string): Promise<boolean> {
  if (!rawToken) {
    return false;
  }
  const tokenHash = hashSessionToken(rawToken);
  const result = await query(
    `UPDATE seguridad.sesiones
     SET revocado_en = CURRENT_TIMESTAMP
     WHERE token_hash = $1 AND revocado_en IS NULL`,
    [tokenHash]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Revokes all active sessions for a user (e.g. upon password reset or security lockout).
 */
export async function revokeAllUserSessions(usuarioId: string): Promise<number> {
  const result = await query(
    `UPDATE seguridad.sesiones
     SET revocado_en = CURRENT_TIMESTAMP
     WHERE usuario_id = $1 AND revocado_en IS NULL`,
    [usuarioId]
  );
  return result.rowCount ?? 0;
}
