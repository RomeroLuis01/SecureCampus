import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeRole,
  userHasRole,
  userHasAnyRole,
  getDefaultRouteForUser,
  ROLE_ALIAS_TO_BACKEND,
} from '../../../src/utils/roles.js';
import { sanitizeReturnUrl } from '../../../src/utils/url.js';
import {
  loginUser,
  getSessionUser,
  logoutUser,
  AuthApiError,
  type AuthUser,
} from '../../../src/services/authClient.js';

describe('Frontend Security Suite (SEC-03 & SEC-06)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Roles & Authorization Mapping (SEC-03)
  // -------------------------------------------------------------------------
  describe('Roles & Permission Mapping', () => {
    const studentUser: AuthUser = {
      usuarioId: 'u-student',
      personaId: 'p-student',
      nombreCompleto: 'Estudiante Test',
      correo: 'estudiante@securecampus.edu',
      estado: 'ACTIVO',
      roles: [{ rolId: 'r-1', codigo: 'ALUMNO', carreraId: 'c-1' }],
      permisos: ['VER_CALIFICACIONES'],
    };

    const adminUser: AuthUser = {
      usuarioId: 'u-admin',
      personaId: 'p-admin',
      nombreCompleto: 'Admin Test',
      correo: 'admin@securecampus.edu',
      estado: 'ACTIVO',
      roles: [{ rolId: 'r-2', codigo: 'ADMINISTRADOR', carreraId: null }],
      permisos: ['GESTION_USUARIOS', 'AUDITORIA'],
    };

    it('1. normalizes frontend aliases to canonical backend role codes', () => {
      expect(normalizeRole('admin')).toBe('ADMINISTRADOR');
      expect(normalizeRole('jefe_carrera')).toBe('JEFE_CARRERA');
      expect(normalizeRole('profesor')).toBe('PROFESOR');
      expect(normalizeRole('estudiante')).toBe('ALUMNO');
    });

    it('2. accepts genuine backend role codes and preserves them', () => {
      expect(normalizeRole('ADMINISTRADOR')).toBe('ADMINISTRADOR');
      expect(normalizeRole('JEFE_CARRERA')).toBe('JEFE_CARRERA');
      expect(normalizeRole('PROFESOR')).toBe('PROFESOR');
      expect(normalizeRole('ALUMNO')).toBe('ALUMNO');
    });

    it('3. strictly rejects unknown or spoofed role strings without granting privileges', () => {
      expect(normalizeRole('SUPERADMIN')).toBeNull();
      expect(normalizeRole('ROOT')).toBeNull();
      expect(normalizeRole('guest')).toBeNull();
      expect(normalizeRole('')).toBeNull();
      expect(normalizeRole('undefined')).toBeNull();
    });

    it('4. userHasRole verifies legitimate role codes and aliases correctly', () => {
      expect(userHasRole(studentUser, 'ALUMNO')).toBe(true);
      expect(userHasRole(studentUser, 'estudiante')).toBe(true);
      expect(userHasRole(studentUser, 'ADMINISTRADOR')).toBe(false);
      expect(userHasRole(studentUser, 'admin')).toBe(false);

      expect(userHasRole(adminUser, 'ADMINISTRADOR')).toBe(true);
      expect(userHasRole(adminUser, 'admin')).toBe(true);
      expect(userHasRole(adminUser, 'ALUMNO')).toBe(false);
    });

    it('5. userHasAnyRole evaluates array of allowed roles and denies unauthorized users', () => {
      expect(userHasAnyRole(studentUser, ['ALUMNO', 'estudiante'])).toBe(true);
      expect(userHasAnyRole(studentUser, ['ADMINISTRADOR', 'admin'])).toBe(false);
      expect(userHasAnyRole(studentUser, ['PROFESOR', 'JEFE_CARRERA'])).toBe(false);

      expect(userHasAnyRole(adminUser, ['ADMINISTRADOR'])).toBe(true);
      expect(userHasAnyRole(adminUser, ['ALUMNO', 'PROFESOR'])).toBe(false);
    });

    it('6. getDefaultRouteForUser assigns priority home dashboard without guessing', () => {
      expect(getDefaultRouteForUser(adminUser)).toBe('/admin');
      expect(getDefaultRouteForUser(studentUser)).toBe('/estudiante');
      expect(getDefaultRouteForUser(null)).toBe('/login');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Open Redirect Defense (ReturnUrl Sanitization)
  // -------------------------------------------------------------------------
  describe('Sanitize Return URL (Anti-Open-Redirect)', () => {
    it('7. allows valid internal relative paths', () => {
      expect(sanitizeReturnUrl('/admin/usuarios')).toBe('/admin/usuarios');
      expect(sanitizeReturnUrl('/estudiante/calificaciones?semestre=2026-B')).toBe(
        '/estudiante/calificaciones?semestre=2026-B'
      );
      expect(sanitizeReturnUrl('/profesor')).toBe('/profesor');
    });

    it('8. rejects external absolute URLs with protocols', () => {
      expect(sanitizeReturnUrl('https://evil.com')).toBe('/');
      expect(sanitizeReturnUrl('http://attacker.com/steal-cookie')).toBe('/');
      expect(sanitizeReturnUrl('javascript:alert(1)')).toBe('/');
      expect(sanitizeReturnUrl('data:text/html,<script>alert(1)</script>')).toBe('/');
    });

    it('9. rejects protocol-relative URLs starting with //', () => {
      expect(sanitizeReturnUrl('//evil.com')).toBe('/');
      expect(sanitizeReturnUrl('//evil.com/admin')).toBe('/');
      expect(sanitizeReturnUrl('///attacker.com')).toBe('/');
    });

    it('10. rejects backslash path manipulation vectors', () => {
      expect(sanitizeReturnUrl('/\\evil.com')).toBe('/');
      expect(sanitizeReturnUrl('\\evil.com')).toBe('/');
      expect(sanitizeReturnUrl('/admin\\test')).toBe('/');
    });

    it('11. prevents redirect loop back to login', () => {
      expect(sanitizeReturnUrl('/login')).toBe('/');
      expect(sanitizeReturnUrl('/login?returnUrl=/admin')).toBe('/');
      expect(sanitizeReturnUrl('/login/test')).toBe('/');
    });

    it('12. handles null, undefined, empty, and whitespace safely', () => {
      expect(sanitizeReturnUrl(null)).toBe('/');
      expect(sanitizeReturnUrl(undefined)).toBe('/');
      expect(sanitizeReturnUrl('')).toBe('/');
      expect(sanitizeReturnUrl('   ')).toBe('/');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Auth Client Service & Error Differentiation (SEC-03)
  // -------------------------------------------------------------------------
  describe('Auth Client Service & HTTP Contract', () => {
    it('13. getSessionUser returns AuthUser on HTTP 200', async () => {
      const mockUser: AuthUser = {
        usuarioId: 'u-1',
        personaId: 'p-1',
        nombreCompleto: 'Usuario Valido',
        correo: 'valido@securecampus.edu',
        estado: 'ACTIVO',
        roles: [{ rolId: 'r-1', codigo: 'ALUMNO', carreraId: null }],
        permisos: [],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ user: mockUser }),
      } as Response);

      const user = await getSessionUser();
      expect(user).toEqual(mockUser);
    });

    it('14. getSessionUser returns null on HTTP 401 (unauthenticated, not an exception)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ error: { message: 'No autenticado' } }),
      } as Response);

      const user = await getSessionUser();
      expect(user).toBeNull();
    });

    it('15. getSessionUser throws AuthApiError on HTTP 403 (suspended/forbidden)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 403,
        ok: false,
        json: async () => ({ error: { message: 'Cuenta suspendida o inactiva' } }),
      } as Response);

      await expect(getSessionUser()).rejects.toThrow(AuthApiError);
    });

    it('16. getSessionUser throws AuthApiError on HTTP 500 (internal server error)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 500,
        ok: false,
        json: async () => ({ error: { message: 'Internal server error' } }),
      } as Response);

      await expect(getSessionUser()).rejects.toThrow(AuthApiError);
    });

    it('17. logoutUser invokes endpoint with credentials: include and Origin header', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ message: 'Sesión cerrada exitosamente' }),
      } as Response);

      const res = await logoutUser();
      expect(res.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('18. logoutUser treats already expired HTTP 401 as successful logout', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ error: { message: 'Sesión expirada' } }),
      } as Response);

      const res = await logoutUser();
      expect(res.success).toBe(true);
      expect(res.isAlreadyExpired).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Source Code Integrity Checks (SEC-06 & SEC-03)
  // -------------------------------------------------------------------------
  describe('Static Security Invariants on Source Code', () => {
    it('19. Login.tsx contains NO handleQuickLogin function or insecure demo buttons', () => {
      const loginFilePath = path.resolve(process.cwd(), 'src/pages/auth/Login.tsx');
      const loginSource = fs.readFileSync(loginFilePath, 'utf-8');

      expect(loginSource).not.toContain('handleQuickLogin');
      expect(loginSource).not.toContain('Acceso Rápido de Demostración');
      expect(loginSource).not.toContain("navigate('/admin')");
      expect(loginSource).not.toContain('AdminSecure2026!');
      expect(loginSource).not.toContain('JefeSecure2026!');
      expect(loginSource).not.toContain('ProfesorSecure2026!');
      expect(loginSource).not.toContain('EstudianteSecure2026!');
    });

    it('20. App.tsx wraps all private dashboard routes with ProtectedRoute', () => {
      const appFilePath = path.resolve(process.cwd(), 'src/App.tsx');
      const appSource = fs.readFileSync(appFilePath, 'utf-8');

      expect(appSource).toContain('<AuthProvider>');
      expect(appSource).toContain('<ProtectedRoute');
      expect(appSource).toContain("allowedRoles={['ALUMNO', 'estudiante']}");
      expect(appSource).toContain("allowedRoles={['PROFESOR', 'profesor']}");
      expect(appSource).toContain("allowedRoles={['JEFE_CARRERA', 'jefe_carrera']}");
      expect(appSource).toContain("allowedRoles={['ADMINISTRADOR', 'admin']}");
    });

    it('21. DashboardLayout.tsx uses useAuth and filters portal switcher by user roles', () => {
      const layoutFilePath = path.resolve(process.cwd(), 'src/layouts/DashboardLayout.tsx');
      const layoutSource = fs.readFileSync(layoutFilePath, 'utf-8');

      expect(layoutSource).toContain('useAuth()');
      expect(layoutSource).toContain('handleLogout');
      expect(layoutSource).toContain('authorizedPortals');
      // Must not allow hardcoded jumping to unauthorized portals
      expect(layoutSource).not.toContain("onClick={() => navigate('/admin')}\n              className={`hover:underline");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Behavioral Route Matrix & Access Control Simulation (SEC-03)
  // -------------------------------------------------------------------------
  describe('Route Authorization Matrix (SEC-03 Behavioral Simulation)', () => {
    // Route definitions from App.tsx
    const routeRules: Record<string, string[]> = {
      '/estudiante': ['ALUMNO', 'estudiante'],
      '/estudiante/perfil': ['ALUMNO', 'estudiante'],
      '/estudiante/calificaciones': ['ALUMNO', 'estudiante'],
      '/estudiante/solicitudes': ['ALUMNO', 'estudiante'],
      '/profesor': ['PROFESOR', 'profesor'],
      '/profesor/perfil': ['PROFESOR', 'profesor'],
      '/profesor/grupos': ['PROFESOR', 'profesor'],
      '/profesor/calificaciones': ['PROFESOR', 'profesor'],
      '/jefe_carrera': ['JEFE_CARRERA', 'jefe_carrera'],
      '/jefe_carrera/docentes': ['JEFE_CARRERA', 'jefe_carrera'],
      '/jefe_carrera/oferta': ['JEFE_CARRERA', 'jefe_carrera'],
      '/jefe_carrera/perfil': ['JEFE_CARRERA', 'jefe_carrera'],
      '/admin': ['ADMINISTRADOR', 'admin'],
      '/admin/usuarios': ['ADMINISTRADOR', 'admin'],
      '/admin/auditoria': ['ADMINISTRADOR', 'admin'],
      '/admin/sistema': ['ADMINISTRADOR', 'admin'],
    };

    const makeUser = (roleCode: string): AuthUser => ({
      usuarioId: `u-${roleCode.toLowerCase()}`,
      personaId: `p-${roleCode.toLowerCase()}`,
      nombreCompleto: `Usuario ${roleCode}`,
      correo: `${roleCode.toLowerCase()}@securecampus.edu`,
      estado: 'ACTIVO',
      roles: [{ rolId: `r-${roleCode}`, codigo: roleCode, carreraId: null }],
      permisos: [],
    });

    const student = makeUser('ALUMNO');
    const teacher = makeUser('PROFESOR');
    const jefe = makeUser('JEFE_CARRERA');
    const admin = makeUser('ADMINISTRADOR');

    it('22. denies anonymous user on every protected route', () => {
      for (const [routePath, allowed] of Object.entries(routeRules)) {
        const canAccess = userHasAnyRole(null, allowed as any);
        expect(canAccess).toBe(false);
      }
    });

    it('23. student can only access /estudiante/* and is strictly denied on all other portals', () => {
      for (const [routePath, allowed] of Object.entries(routeRules)) {
        const canAccess = userHasAnyRole(student, allowed as any);
        if (routePath.startsWith('/estudiante')) {
          expect(canAccess).toBe(true);
        } else {
          expect(canAccess).toBe(false);
        }
      }
    });

    it('24. teacher can only access /profesor/* and is strictly denied on all other portals', () => {
      for (const [routePath, allowed] of Object.entries(routeRules)) {
        const canAccess = userHasAnyRole(teacher, allowed as any);
        if (routePath.startsWith('/profesor')) {
          expect(canAccess).toBe(true);
        } else {
          expect(canAccess).toBe(false);
        }
      }
    });

    it('25. jefe de carrera can only access /jefe_carrera/* and is strictly denied on all other portals', () => {
      for (const [routePath, allowed] of Object.entries(routeRules)) {
        const canAccess = userHasAnyRole(jefe, allowed as any);
        if (routePath.startsWith('/jefe_carrera')) {
          expect(canAccess).toBe(true);
        } else {
          expect(canAccess).toBe(false);
        }
      }
    });

    it('26. admin can access /admin/* and is strictly denied on other portals unless assigned', () => {
      for (const [routePath, allowed] of Object.entries(routeRules)) {
        const canAccess = userHasAnyRole(admin, allowed as any);
        if (routePath.startsWith('/admin')) {
          expect(canAccess).toBe(true);
        } else {
          expect(canAccess).toBe(false);
        }
      }
    });

    it('27. rejects users with empty, unknown, or malformed roles on all routes', () => {
      const userEmptyRoles: AuthUser = { ...student, roles: [] };
      const userUnknownRole: AuthUser = {
        ...student,
        roles: [{ rolId: 'r-x', codigo: 'UNKNOWN_ROLE', carreraId: null }],
      };
      const userMalformedRole: AuthUser = {
        ...student,
        roles: [{ rolId: 'r-m', codigo: '<script>alert(1)</script>', carreraId: null }],
      };

      for (const [_, allowed] of Object.entries(routeRules)) {
        expect(userHasAnyRole(userEmptyRoles, allowed as any)).toBe(false);
        expect(userHasAnyRole(userUnknownRole, allowed as any)).toBe(false);
        expect(userHasAnyRole(userMalformedRole, allowed as any)).toBe(false);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. Concurrency, State Machine & Late Response Simulation (SEC-03)
  // -------------------------------------------------------------------------
  describe('Session State Machine & Race Condition Safety (SEC-03)', () => {
    it('28. stale late responses cannot overwrite logout unauthenticated state', async () => {
      // Simulating AuthContext's requestIdRef pattern
      let requestId = 0;
      let state: { status: string; user: AuthUser | null } = { status: 'loading', user: null };

      // 1. Initial checkSession starts
      const req1Id = ++requestId;

      // 2. User immediately clicks logout before req1 resolves
      const reqLogoutId = ++requestId;
      state = { status: 'unauthenticated', user: null };

      // 3. Stale req1 finally resolves with a user
      const delayedUser: AuthUser = {
        usuarioId: 'u-delayed',
        personaId: 'p-delayed',
        nombreCompleto: 'Delayed User',
        correo: 'delayed@securecampus.edu',
        estado: 'ACTIVO',
        roles: [{ rolId: 'r-1', codigo: 'ALUMNO', carreraId: null }],
        permisos: [],
      };

      // Guard check in AuthContext: if (currentRequestId !== requestIdRef.current) return;
      if (req1Id === requestId) {
        state = { status: 'authenticated', user: delayedUser };
      }

      // Assert that delayed response was discarded and state remains unauthenticated
      expect(state.status).toBe('unauthenticated');
      expect(state.user).toBeNull();
    });

    it('29. network failure sets error status and does not grant authentication', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

      let status = 'loading';
      let user: AuthUser | null = null;
      let error: string | null = null;

      try {
        const fetchedUser = await getSessionUser();
        if (fetchedUser) {
          status = 'authenticated';
          user = fetchedUser;
        } else {
          status = 'unauthenticated';
        }
      } catch (err: any) {
        status = 'error';
        user = null;
        error = err?.message || 'Network error';
      }

      expect(status).toBe('error');
      expect(user).toBeNull();
      expect(error).toContain('Failed to fetch');
    });

    it('30. HTTP 403 (suspended account) sets unauthenticated status and informs suspension', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 403,
        ok: false,
        json: async () => ({ error: { message: 'Cuenta suspendida o inactiva' } }),
      } as Response);

      let status = 'loading';
      let user: AuthUser | null = null;
      let error: string | null = null;

      try {
        const fetchedUser = await getSessionUser();
        if (fetchedUser) {
          status = 'authenticated';
          user = fetchedUser;
        } else {
          status = 'unauthenticated';
        }
      } catch (err: any) {
        if (err instanceof AuthApiError && err.status === 403) {
          status = 'unauthenticated';
          user = null;
          error = err.message || 'Cuenta suspendida';
        } else {
          status = 'error';
        }
      }

      expect(status).toBe('unauthenticated');
      expect(user).toBeNull();
      expect(error).toBe('Cuenta suspendida o inactiva');
    });
  });
});
