import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  validateCsrfOrigin,
  requireAuth,
  requireRoles,
  requirePermissions,
} from '../../src/auth/auth.middleware.js';
import * as sessionService from '../../src/auth/session.service.js';
import * as authService from '../../src/auth/auth.service.js';
import { AppClientError } from '../../src/middleware/errorHandler.js';

type MockNext = NextFunction & ReturnType<typeof vi.fn>;

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

      const next = vi.fn() as unknown as MockNext;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('política de origen (CSRF)');

      // Critical requirement: CSRF rejection must NOT clear or revoke the session cookie (prevents DoS)
      expect(clearCookieSpy).not.toHaveBeenCalled();
    });

    it('8b. rejects mutator PUT with 403 when Origin and Referer are absent (CSRF protection)', async () => {
      const req = {
        method: 'PUT',
        headers: {},
        cookies: { sc_session: 'valid-session-token' },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = { clearCookie: clearCookieSpy } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('política de origen (CSRF)');
      expect(clearCookieSpy).not.toHaveBeenCalled();
    });

    it('8c. rejects mutator PATCH with 403 when Origin is unauthorized (CSRF protection)', async () => {
      const req = {
        method: 'PATCH',
        headers: { origin: 'https://attacker-origin.net' },
        cookies: { sc_session: 'valid-session-token' },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = { clearCookie: clearCookieSpy } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('política de origen (CSRF)');
      expect(clearCookieSpy).not.toHaveBeenCalled();
    });

    it('8d. rejects mutator DELETE with 403 when Origin and Referer are absent (CSRF protection)', async () => {
      const req = {
        method: 'DELETE',
        headers: {},
        cookies: { sc_session: 'valid-session-token' },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = { clearCookie: clearCookieSpy } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('política de origen (CSRF)');
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

      const next = vi.fn() as unknown as MockNext;

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

    it('10. rejects with 401 when session cookie is completely absent', async () => {
      const req = {
        method: 'GET',
        headers: {},
        cookies: {},
      } as unknown as Request;

      const res = { clearCookie: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(401);
      expect((passedError as AppClientError).message).toContain('sesión requerida');
    });

    it('11. rejects with 401 and clears cookie when session is invalid or expired', async () => {
      const req = {
        method: 'GET',
        headers: {},
        cookies: { sc_session: 'expired-or-revoked-token' },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = { clearCookie: clearCookieSpy } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      vi.spyOn(sessionService, 'validateSession').mockResolvedValueOnce({
        isValid: false,
        reason: 'EXPIRED_IDLE',
      });

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(401);
      expect(clearCookieSpy).toHaveBeenCalledTimes(1);
    });

    it('12. rejects with 403, revokes all user sessions in DB, and clears cookie with options when user account is suspended', async () => {
      const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const req = {
        method: 'GET',
        headers: {},
        cookies: { sc_session: 'valid-token-for-suspended-user' },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = { clearCookie: clearCookieSpy } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      vi.spyOn(sessionService, 'validateSession').mockResolvedValueOnce({
        isValid: true,
        sesionId: 's-suspended',
        usuarioId: validUserId,
      });

      const revokeAllSpy = vi.spyOn(sessionService, 'revokeAllUserSessions').mockResolvedValueOnce(1);

      vi.spyOn(authService, 'getUserProfile').mockResolvedValueOnce({
        usuarioId: validUserId,
        personaId: 'p-suspended',
        nombreCompleto: 'Usuario Suspendido',
        correo: 'suspendido@securecampus.edu',
        estado: 'SUSPENDIDO',
        roles: [{ rolId: 'r-1', codigo: 'ALUMNO', carreraId: null }],
        permisos: [],
      });

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('Cuenta suspendida o inactiva');
      expect(revokeAllSpy).toHaveBeenCalledWith(validUserId);
      expect(clearCookieSpy).toHaveBeenCalledWith(
        'sc_session',
        expect.objectContaining({
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
        })
      );
    });

    it('12b. rejects with 403 and revokes all sessions when user credentials are administratively BLOQUEADO', async () => {
      const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
      const req = {
        method: 'GET',
        headers: {},
        cookies: { sc_session: 'token-blocked-creds' },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = { clearCookie: clearCookieSpy } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      vi.spyOn(sessionService, 'validateSession').mockResolvedValueOnce({
        isValid: true,
        sesionId: 's-blocked',
        usuarioId: validUserId,
      });

      const revokeAllSpy = vi.spyOn(sessionService, 'revokeAllUserSessions').mockResolvedValueOnce(1);

      vi.spyOn(authService, 'getUserProfile').mockResolvedValueOnce({
        usuarioId: validUserId,
        personaId: 'p-blocked',
        nombreCompleto: 'Usuario Credencial Bloqueada',
        correo: 'blocked@securecampus.edu',
        estado: 'ACTIVO',
        estadoCredencial: 'BLOQUEADO',
        roles: [{ rolId: 'r-1', codigo: 'ALUMNO', carreraId: null }],
        permisos: [],
      });

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect(revokeAllSpy).toHaveBeenCalledWith(validUserId);
      expect(clearCookieSpy).toHaveBeenCalledTimes(1);
    });

    it('12c. rejects with 403 when user credential is temporarily locked (bloqueado_hasta in future)', async () => {
      const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
      const req = {
        method: 'GET',
        headers: {},
        cookies: { sc_session: 'token-locked-creds' },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = { clearCookie: clearCookieSpy } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      vi.spyOn(sessionService, 'validateSession').mockResolvedValueOnce({
        isValid: true,
        sesionId: 's-locked',
        usuarioId: validUserId,
      });

      vi.spyOn(authService, 'getUserProfile').mockResolvedValueOnce({
        usuarioId: validUserId,
        personaId: 'p-locked',
        nombreCompleto: 'Usuario Temporalmente Bloqueado',
        correo: 'temporallock@securecampus.edu',
        estado: 'ACTIVO',
        estadoCredencial: 'ACTIVO',
        bloqueadoHasta: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes in the future
        roles: [{ rolId: 'r-1', codigo: 'ALUMNO', carreraId: null }],
        permisos: [],
      });

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('Credencial bloqueada temporalmente');
      expect(clearCookieSpy).toHaveBeenCalledTimes(1);
    });

    it('12d. actively calls revokeSession in DB when session is expired or invalid', async () => {
      const req = {
        method: 'GET',
        headers: {},
        cookies: { sc_session: 'expired-token-xyz' },
      } as unknown as Request;

      const clearCookieSpy = vi.fn();
      const res = { clearCookie: clearCookieSpy } as unknown as Response;
      const next = vi.fn() as unknown as MockNext;

      vi.spyOn(sessionService, 'validateSession').mockResolvedValueOnce({
        isValid: false,
        reason: 'EXPIRED_ABSOLUTE',
      });

      const revokeSpy = vi.spyOn(sessionService, 'revokeSession').mockResolvedValueOnce(true);

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith('expired-token-xyz');
      expect(clearCookieSpy).toHaveBeenCalledWith(
        'sc_session',
        expect.objectContaining({ path: '/', httpOnly: true })
      );
    });
  });

  // -------------------------------------------------------------------------
  // requireRoles Middleware Tests
  // -------------------------------------------------------------------------
  describe('requireRoles middleware (Backend Role Authorization)', () => {
    const studentUser = {
      usuarioId: 'u-student',
      personaId: 'p-student',
      nombreCompleto: 'Estudiante Test',
      correo: 'estudiante@securecampus.edu',
      estado: 'ACTIVO',
      roles: [{ rolId: 'r-1', codigo: 'ALUMNO', carreraId: 'c-1' }],
      permisos: ['VER_CALIFICACIONES'],
    };

    const adminUser = {
      usuarioId: 'u-admin',
      personaId: 'p-admin',
      nombreCompleto: 'Admin Test',
      correo: 'admin@securecampus.edu',
      estado: 'ACTIVO',
      roles: [{ rolId: 'r-2', codigo: 'ADMINISTRADOR', carreraId: null }],
      permisos: ['GESTION_USUARIOS'],
    };

    it('13. rejects with 401 when req.user is undefined', () => {
      const middleware = requireRoles('ADMINISTRADOR');
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as MockNext;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(401);
    });

    it('14. allows access when user matches exact backend role code', () => {
      const middleware = requireRoles('ADMINISTRADOR');
      const req = { user: adminUser } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as MockNext;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(); // success (no error passed)
    });

    it('15. allows access when role is specified via frontend alias (admin, estudiante)', () => {
      const middlewareAdmin = requireRoles('admin');
      const reqAdmin = { user: adminUser } as unknown as Request;
      const nextAdmin = vi.fn() as unknown as MockNext;

      middlewareAdmin(reqAdmin, {} as Response, nextAdmin);
      expect(nextAdmin).toHaveBeenCalledWith();

      const middlewareStudent = requireRoles('estudiante');
      const reqStudent = { user: studentUser } as unknown as Request;
      const nextStudent = vi.fn() as unknown as MockNext;

      middlewareStudent(reqStudent, {} as Response, nextStudent);
      expect(nextStudent).toHaveBeenCalledWith();
    });

    it('16. allows access when user matches one of multiple permitted roles', () => {
      const middleware = requireRoles('JEFE_CARRERA', 'ADMINISTRADOR');
      const req = { user: adminUser } as unknown as Request;
      const next = vi.fn() as unknown as MockNext;

      middleware(req, {} as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('17. rejects with 403 when authenticated user lacks the required role', () => {
      const middleware = requireRoles('ADMINISTRADOR');
      const req = { user: studentUser } as unknown as Request;
      const next = vi.fn() as unknown as MockNext;

      middleware(req, {} as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('rol insuficiente');
    });

    it('18. rejects with 403 when user has empty roles list', () => {
      const middleware = requireRoles('ALUMNO');
      const req = {
        user: { ...studentUser, roles: [] },
      } as unknown as Request;
      const next = vi.fn() as unknown as MockNext;

      middleware(req, {} as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
    });

    it('19. rejects with 403 when unknown or spoofed role string is passed', () => {
      const middleware = requireRoles('SUPERADMIN', 'HACKER_ROOT');
      const req = { user: adminUser } as unknown as Request;
      const next = vi.fn() as unknown as MockNext;

      middleware(req, {} as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // requirePermissions Middleware Tests
  // -------------------------------------------------------------------------
  describe('requirePermissions middleware (Backend Granular Permissions)', () => {
    const userWithPerms = {
      usuarioId: 'u-perms',
      personaId: 'p-perms',
      nombreCompleto: 'Perms User',
      correo: 'perms@securecampus.edu',
      estado: 'ACTIVO',
      roles: [],
      permisos: ['VER_CALIFICACIONES', 'EDITAR_PERFIL'],
    };

    it('20. rejects with 401 when req.user is undefined', () => {
      const middleware = requirePermissions('VER_CALIFICACIONES');
      const next = vi.fn() as unknown as MockNext;

      middleware({} as Request, {} as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(AppClientError);
      expect((next.mock.calls[0][0] as AppClientError).statusCode).toBe(401);
    });

    it('21. allows access when user has all required permissions', () => {
      const middleware = requirePermissions('VER_CALIFICACIONES', 'EDITAR_PERFIL');
      const req = { user: userWithPerms } as unknown as Request;
      const next = vi.fn() as unknown as MockNext;

      middleware(req, {} as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('22. rejects with 403 when user lacks one of the required permissions', () => {
      const middleware = requirePermissions('VER_CALIFICACIONES', 'CREAR_USUARIOS');
      const req = { user: userWithPerms } as unknown as Request;
      const next = vi.fn() as unknown as MockNext;

      middleware(req, {} as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppClientError);
      expect((passedError as AppClientError).statusCode).toBe(403);
      expect((passedError as AppClientError).message).toContain('permiso insuficiente');
    });
  });
});
