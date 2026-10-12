import type { AuthUser } from '../services/authClient';
import { sanitizeReturnUrl } from './url';

export type BackendRoleCode = 'ADMINISTRADOR' | 'JEFE_CARRERA' | 'PROFESOR' | 'ALUMNO';
export type FrontendRoleAlias = 'admin' | 'jefe_carrera' | 'profesor' | 'estudiante';
export type AnyRole = BackendRoleCode | FrontendRoleAlias;

export const ROLE_ALIAS_TO_BACKEND: Record<FrontendRoleAlias, BackendRoleCode> = {
  admin: 'ADMINISTRADOR',
  jefe_carrera: 'JEFE_CARRERA',
  profesor: 'PROFESOR',
  estudiante: 'ALUMNO',
};

export const BACKEND_TO_ALIAS: Record<BackendRoleCode, FrontendRoleAlias> = {
  ADMINISTRADOR: 'admin',
  JEFE_CARRERA: 'jefe_carrera',
  PROFESOR: 'profesor',
  ALUMNO: 'estudiante',
};

export const BACKEND_ROLE_TO_DEFAULT_PATH: Record<BackendRoleCode, string> = {
  ADMINISTRADOR: '/admin',
  JEFE_CARRERA: '/jefe_carrera',
  PROFESOR: '/profesor',
  ALUMNO: '/estudiante',
};

export const VALID_BACKEND_ROLES: readonly BackendRoleCode[] = [
  'ADMINISTRADOR',
  'JEFE_CARRERA',
  'PROFESOR',
  'ALUMNO',
] as const;

export const VALID_ROLE_ALIASES: readonly FrontendRoleAlias[] = [
  'admin',
  'jefe_carrera',
  'profesor',
  'estudiante',
] as const;

export const ROUTE_PORTAL_RULES: ReadonlyArray<{
  prefix: string;
  allowedRoles: readonly AnyRole[];
}> = [
  { prefix: '/estudiante', allowedRoles: ['ALUMNO', 'estudiante'] },
  { prefix: '/profesor', allowedRoles: ['PROFESOR', 'profesor'] },
  { prefix: '/jefe_carrera', allowedRoles: ['JEFE_CARRERA', 'jefe_carrera'] },
  { prefix: '/admin', allowedRoles: ['ADMINISTRADOR', 'admin'] },
];

/**
 * Normalizes any role (backend code or frontend alias) to its canonical BackendRoleCode.
 * Returns null if the value is not a recognized role.
 */
export function normalizeRole(role: string): BackendRoleCode | null {
  if ((VALID_BACKEND_ROLES as readonly string[]).includes(role)) {
    return role as BackendRoleCode;
  }
  if (role in ROLE_ALIAS_TO_BACKEND) {
    return ROLE_ALIAS_TO_BACKEND[role as FrontendRoleAlias];
  }
  return null;
}

/**
 * Checks whether an authenticated user possesses at least one of the required roles.
 */
export function userHasRole(user: AuthUser | null, requiredRole: AnyRole): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false;
  }
  const canonicalRequired = normalizeRole(requiredRole);
  if (!canonicalRequired) {
    return false;
  }
  return user.roles.some((r) => r.codigo === canonicalRequired);
}

/**
 * Checks whether an authenticated user matches any role in an array of allowed roles.
 */
export function userHasAnyRole(user: AuthUser | null, allowedRoles?: AnyRole[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true; // No role restriction
  }
  if (!user) {
    return false;
  }
  return allowedRoles.some((role) => userHasRole(user, role));
}

/**
 * Returns the primary home dashboard URL for an authenticated user based on role priority:
 * ADMINISTRADOR > JEFE_CARRERA > PROFESOR > ALUMNO.
 */
export function getDefaultRouteForUser(user: AuthUser | null): string {
  if (!user || !user.roles || user.roles.length === 0) {
    return '/login';
  }
  const roleCodes = user.roles.map((r) => r.codigo);
  if (roleCodes.includes('ADMINISTRADOR')) return '/admin';
  if (roleCodes.includes('JEFE_CARRERA')) return '/jefe_carrera';
  if (roleCodes.includes('PROFESOR')) return '/profesor';
  if (roleCodes.includes('ALUMNO')) return '/estudiante';
  return '/login';
}

/**
 * Normalizes a URL/path string by stripping query parameters and hash fragments,
 * and ensuring standard single leading slash without trailing slash.
 */
export function extractPathname(path: string): string {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim().split('?')[0].split('#')[0];
  const withoutTrailing = trimmed.replace(/\/+$/, '');
  return withoutTrailing || '/';
}

/**
 * Returns the allowed roles for a given relative path, or null if the path is not a recognized protected portal route.
 */
export function getAllowedRolesForPath(path: string): readonly AnyRole[] | null {
  if (!path || typeof path !== 'string') return null;

  const pathname = extractPathname(path);

  for (const rule of ROUTE_PORTAL_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.allowedRoles;
    }
  }

  return null;
}

/**
 * Checks whether an authenticated user is authorized to access a given application path.
 * Returns true if the path is a recognized portal route and the user possesses the required role.
 * Returns false if the path is unknown, not a portal, or the user lacks permissions.
 */
export function isRouteAllowedForUser(path: string, user: AuthUser | null): boolean {
  if (!user || !path) {
    return false;
  }

  const allowedRoles = getAllowedRolesForPath(path);
  if (!allowedRoles) {
    return false;
  }

  return userHasAnyRole(user, allowedRoles as AnyRole[]);
}

/**
 * Determines the safe, authorized redirect destination for a user.
 * If candidateUrl is provided, safe, and the user has permission to access it, returns candidateUrl.
 * Otherwise, discards candidateUrl and returns the user's default route.
 */
export function getSafeRedirectForUser(
  candidateUrl: string | null | undefined,
  user: AuthUser | null
): string {
  if (!user) {
    return '/login';
  }

  const defaultRoute = getDefaultRouteForUser(user);

  if (!candidateUrl) {
    return defaultRoute;
  }

  const safeTarget = sanitizeReturnUrl(candidateUrl, '');
  if (!safeTarget || safeTarget === '/' || safeTarget === '/login') {
    return defaultRoute;
  }

  if (isRouteAllowedForUser(safeTarget, user)) {
    return safeTarget;
  }

  return defaultRoute;
}

