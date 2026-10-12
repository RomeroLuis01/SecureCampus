import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { validateSession, revokeSession, revokeAllUserSessions } from './session.service.js';
import { getUserProfile, type AuthUserProfile } from './auth.service.js';
import { AppClientError } from '../middleware/errorHandler.js';

export function getClearCookieOptions() {
  const isProduction = config.NODE_ENV === 'production';
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
  };
}

export function getSessionCookieOptions() {
  const isProduction = config.NODE_ENV === 'production';
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: config.SESSION_TTL_HOURS * 3600 * 1000,
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserProfile;
      sessionToken?: string;
    }
  }
}

/**
 * Validates that a mutator request originating from a client with session cookies
 * comes from a verified, allowed origin to prevent Cross-Site Request Forgery (CSRF).
 *
 * Rules:
 * 1. If Origin header is present, it must strictly match config.corsOrigins.
 * 2. An invalid Origin is never excused or overridden by Referer.
 * 3. If Origin is absent, Referer may be used only if valid and its origin is in config.corsOrigins.
 * 4. If neither verifiable Origin nor Referer is present, the request is rejected.
 */
export function validateCsrfOrigin(req: Request): { isValid: boolean; reason?: string } {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // 1. If Origin header is present, it must match allowed CORS origins strictly.
  // An invalid Origin must NEVER be excused or re-validated by Referer.
  if (origin) {
    if (typeof origin !== 'string' || !config.corsOrigins.includes(origin)) {
      return { isValid: false, reason: 'INVALID_ORIGIN' };
    }
    return { isValid: true };
  }

  // 2. If Origin is absent, fallback to Referer only if present, well-formed, and strictly allowed.
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!config.corsOrigins.includes(refererOrigin)) {
        return { isValid: false, reason: 'INVALID_REFERER' };
      }
      return { isValid: true };
    } catch {
      return { isValid: false, reason: 'MALFORMED_REFERER' };
    }
  }

  // 3. Neither Origin nor Referer is present: rejected (no verifiable origin).
  return { isValid: false, reason: 'MISSING_ORIGIN' };
}

/**
 * Middleware that authenticates incoming requests using the secure session cookie.
 * Validates session expiration and idle timeout, injects req.user and req.sessionToken,
 * enforces CSRF Origin checking on mutator HTTP operations, and revokes sessions in PostgreSQL
 * upon account suspension or expiration.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Anti-CSRF defense: Validate Origin/Referer on mutator HTTP methods
    const mutatorMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (mutatorMethods.includes(req.method)) {
      const csrfCheck = validateCsrfOrigin(req);
      if (!csrfCheck.isValid) {
        // Do NOT clear or revoke the session cookie on CSRF rejection to prevent DoS against legitimate users
        throw new AppClientError('Acceso denegado por política de origen (CSRF)', 403);
      }
    }

    // 2. Read session cookie
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (!token || typeof token !== 'string') {
      throw new AppClientError('No autenticado: sesión requerida', 401);
    }

    // 3. Validate session in database
    const validation = await validateSession(token);
    if (!validation.isValid || !validation.usuarioId) {
      // Actively mark session as revoked in PostgreSQL if token is present
      if (token) {
        await revokeSession(token);
      }
      // Clear invalid/expired cookie on client with full cookie options
      res.clearCookie(config.SESSION_COOKIE_NAME, getClearCookieOptions());
      const message =
        validation.reason === 'EXPIRED_IDLE' || validation.reason === 'EXPIRED_ABSOLUTE'
          ? 'Sesión expirada. Por favor inicie sesión nuevamente.'
          : 'Sesión no válida o revocada';
      throw new AppClientError(message, 401);
    }

    // 4. Load authenticated profile and active permissions
    const profile = await getUserProfile(validation.usuarioId);

    // Verify account is active and credentials are not administratively blocked
    if (profile.estado !== 'ACTIVO' || profile.estadoCredencial === 'BLOQUEADO') {
      // Invalidate all active sessions for this suspended or blocked account in PostgreSQL
      await revokeAllUserSessions(validation.usuarioId);
      res.clearCookie(config.SESSION_COOKIE_NAME, getClearCookieOptions());
      throw new AppClientError('Cuenta suspendida o inactiva', 403);
    }

    // Check for active temporary lockout
    if (profile.bloqueadoHasta && new Date() < new Date(profile.bloqueadoHasta)) {
      res.clearCookie(config.SESSION_COOKIE_NAME, getClearCookieOptions());
      throw new AppClientError('Credencial bloqueada temporalmente', 403);
    }

    req.user = profile;
    req.sessionToken = token;

    next();
  } catch (error) {
    next(error);
  }
}

const ROLE_ALIASES: Record<string, string> = {
  admin: 'ADMINISTRADOR',
  jefe_carrera: 'JEFE_CARRERA',
  profesor: 'PROFESOR',
  estudiante: 'ALUMNO',
};

function normalizeRoleCode(role: string): string {
  if (!role || typeof role !== 'string') return '';
  const trimmed = role.trim();
  return ROLE_ALIASES[trimmed.toLowerCase()] || trimmed.toUpperCase();
}

/**
 * Role-based authorization middleware.
 * Verifies that the authenticated user possesses at least one of the specified role codes or aliases.
 */
export function requireRoles(...allowedRoles: string[]) {
  const normalizedAllowed = allowedRoles.map(normalizeRoleCode).filter(Boolean);

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppClientError('No autenticado', 401));
    }

    const userRoles = req.user.roles.map((r) => normalizeRoleCode(r.codigo)).filter(Boolean);
    const hasRole = normalizedAllowed.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return next(new AppClientError('Acceso denegado: rol insuficiente', 403));
    }

    next();
  };
}

/**
 * Permission-based authorization middleware.
 * Verifies that the authenticated user possesses all specified permission codes.
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppClientError('No autenticado', 401));
    }

    const userPerms = req.user.permisos;
    const hasAll = requiredPermissions.every((perm) => userPerms.includes(perm));

    if (!hasAll) {
      return next(new AppClientError('Acceso denegado: permiso insuficiente', 403));
    }

    next();
  };
}
