import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateCsrfOrigin, requireAuth } from '../../src/auth/auth.middleware.js';
import * as sessionService from '../../src/auth/session.service.js';
import * as authService from '../../src/auth/auth.service.js';
import { AppClientError } from '../../src/middleware/errorHandler.js';

describe('auth.middleware - CSRF & Origin Defense (Unit Tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateCsrfOrigin', () => {
    it('1. accepts mutator operation when Origin is in allowed origins', () => {
      const req = {
        headers: {
          origin: 'http://localhost:5173',
        },
      } as unknown as Request;

      const result = validateCsrfOrigin(req);
      expect(result.isValid).toBe(true);
    });

    it('2. rejects mutator operation with 403 when Origin is not allowed', () => {
      const req = {
        headers: {
          origin: 'https://malicious-site.com',
        },
      } as unknown as Request;

      const result = validateCsrfOrigin(req);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('INVALID_ORIGIN');
    });

    it('3. rejects mutator operation when both Origin and Referer are absent', () => {
      const req = {
        headers: {},
      } as unknown as Request;

      const result = validateCsrfOrigin(req);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('MISSING_ORIGIN');
    });

    it('4. accepts mutator operation without Origin when Referer origin is in allowed origins', () => {
      const req = {
        headers: {
          referer: 'http://localhost:5173/admin/usuarios',
        },
      } as unknown as Request;

      const result = validateCsrfOrigin(req);
      expect(result.isValid).toBe(true);
    });

    it('5. rejects mutator operation without Origin when Referer origin is not allowed', () => {
      const req = {
        headers: {
          referer: 'https://evil.com/phishing?target=securecampus',
        },
      } as unknown as Request;

      const result = validateCsrfOrigin(req);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('INVALID_REFERER');
    });

    it('6. rejects mutator operation when Referer header is malformed', () => {
      const req = {
        headers: {
          referer: 'not_a_valid_url_:::;',
        },
      } as unknown as Request;

      const result = validateCsrfOrigin(req);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('MALFORMED_REFERER');
    });

    it('7. strictly rejects invalid Origin even if a valid Referer header is present (no override)', () => {
      const req = {
        headers: {
          origin: 'https://attacker.com',
          referer: 'http://localhost:5173/profile',
        },
      } as unknown as Request;

      const result = validateCsrfOrigin(req);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('INVALID_ORIGIN');
    });
  });

  describe('requireAuth middleware integration with CSRF policy', () => {
    it('8. rejects mutator POST with 403 when origin is invalid and does NOT clear session cookie', async () => {
      const req = {
        method: 'POST',
        headers: {
          origin: 'https://attacker.com',
        },
        cookies: {
          sc_session: 'valid-session-token',
        },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = {
        clearCookie: clearCookieSpy,
      } as unknown as Response;

      const next = vi.fn() as NextFunction;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('política de origen (CSRF)');

      // Critical requirement: CSRF rejection must NOT clear or revoke the session cookie (prevents DoS)
      expect(clearCookieSpy).not.toHaveBeenCalled();
    });

    it('9. permits safe GET requests without requiring Origin header', async () => {
      const req = {
        method: 'GET',
        headers: {},
        cookies: {
          sc_session: 'test-session-token',
        },
      } as unknown as Request;

      const res = {
        clearCookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as NextFunction;

      vi.spyOn(sessionService, 'validateSession').mockResolvedValueOnce({
        isValid: true,
        sesionId: 's-123',
        usuarioId: 'u-123',
      });

      vi.spyOn(authService, 'getUserProfile').mockResolvedValueOnce({
        usuarioId: 'u-123',
        personaId: 'p-123',
        nombreCompleto: 'Usuario Test',
        correo: 'test@securecampus.edu',
        estado: 'ACTIVO',
        roles: [],
        permisos: [],
      });

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(); // called with no error
      expect(req.user).toBeDefined();
      expect(req.sessionToken).toBe('test-session-token');
    });
  });
});
