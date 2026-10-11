import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import { authenticate, logout } from '../auth/auth.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { authRateLimiter } from '../auth/rateLimiter.js';
import { AppClientError } from '../middleware/errorHandler.js';

export const authRouter = Router();

const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'El identificador no puede estar vacío')
    .max(320, 'El identificador excede la longitud máxima'),
  password: z
    .string()
    .min(1, 'La contraseña no puede estar vacía')
    .max(256, 'La contraseña excede la longitud máxima'),
});

/**
 * Helper to construct standard cookie options.
 */
function getSessionCookieOptions() {
  const isProduction = config.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: config.SESSION_TTL_HOURS * 3600 * 1000,
  };
}

/**
 * POST /api/v1/auth/login
 * Public endpoint protected by IP rate limiting.
 */
authRouter.post(
  '/auth/login',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppClientError('Credenciales inválidas o datos de entrada malformados', 400);
      }

      const { identifier, password } = parsed.data;

      const result = await authenticate({
        identifier,
        password,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Issue secure session cookie
      res.cookie(config.SESSION_COOKIE_NAME, result.rawToken, getSessionCookieOptions());

      // Return public user profile and permissions (never tokens, never hashes)
      res.status(200).json({
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Authenticated endpoint revoking active session in database and clearing cookie.
 */
authRouter.post(
  '/auth/logout',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.sessionToken;
      const usuarioId = req.user?.usuarioId;

      if (token) {
        await logout(token, usuarioId, req.ip, req.headers['user-agent']);
      }

      res.clearCookie(config.SESSION_COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      res.status(200).json({
        message: 'Sesión cerrada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/auth/me
 * Authenticated endpoint returning active session identity, roles and permissions.
 */
authRouter.get(
  '/auth/me',
  requireAuth,
  (req: Request, res: Response) => {
    res.status(200).json({
      user: req.user,
    });
  }
);
