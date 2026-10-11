import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { validateSession } from './session.service.js';
import { getUserProfile, type AuthUserProfile } from './auth.service.js';
import { AppClientError } from '../middleware/errorHandler.js';

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
 * and enforces CSRF Origin checking on mutator HTTP operations.
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
      // Clear invalid/expired cookie on client
      res.clearCookie(config.SESSION_COOKIE_NAME);
      const message =
        validation.reason === 'EXPIRED_IDLE' || validation.reason === 'EXPIRED_ABSOLUTE'
          ? 'Sesión expirada. Por favor inicie sesión nuevamente.'
          : 'Sesión no válida o revocada';
      throw new AppClientError(message, 401);
    }

    // 4. Load authenticated profile and active permissions
    const profile = await getUserProfile(validation.usuarioId);

    // Verify account is still active
    if (profile.estado !== 'ACTIVO') {
      res.clearCookie(config.SESSION_COOKIE_NAME);
      throw new AppClientError('Cuenta suspendida o inactiva', 403);
    }

    // 5. Invalidate if user credential is administratively blocked
    req.user = profile;
    req.sessionToken = token;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-based authorization middleware.
 * Verifies that the authenticated user possesses at least one of the specified role codes.
 */
export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppClientError('No autenticado', 401));
    }

    const userRoles = req.user.roles.map((r) => r.codigo);
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

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
