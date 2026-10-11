import type { AuthUser } from '../services/authClient';

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
