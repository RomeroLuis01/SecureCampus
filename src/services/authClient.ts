export interface UserRole {
  rolId: string;
  codigo: string;
  carreraId: string | null;
}

export interface AuthUser {
  usuarioId: string;
  personaId: string;
  nombreCompleto: string;
  correo: string;
  estado: string;
  telefono?: string | null;
  curp?: string | null;
  matricula?: string | null;
  numeroEmpleado?: string | null;
  carreraCodigo?: string | null;
  carreraNombre?: string | null;
  roles: UserRole[];
  permisos: string[];
}

export interface LoginResponse {
  user: AuthUser;
}

export class AuthApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

const API_BASE = '/api/v1';

export async function loginUser(identifier: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Includes HttpOnly session cookies
    body: JSON.stringify({ identifier, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || 'Error al iniciar sesión';
    throw new AuthApiError(errorMsg, response.status);
  }

  return data.user as AuthUser;
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    credentials: 'include',
  });

  // 401 Unauthorized: Valid confirmation from server that no session exists
  if (response.status === 401) {
    return null;
  }

  // Any non-200 response (403, 500, etc.) is an explicit operational error
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const errorMsg = data?.error?.message || `Error del servidor (${response.status})`;
    throw new AuthApiError(errorMsg, response.status);
  }

  const data = await response.json();
  return data.user as AuthUser;
}

export async function logoutUser(): Promise<{ success: boolean; isAlreadyExpired: boolean }> {
  try {
    const originHeader = typeof window !== 'undefined' && window.location ? window.location.origin : undefined;
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: originHeader ? { Origin: originHeader } : {},
    });

    if (response.status === 401) {
      // Session was already expired or revoked on server
      return { success: true, isAlreadyExpired: true };
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const errorMsg = data?.error?.message || 'Error durante cierre de sesión';
      throw new AuthApiError(errorMsg, response.status);
    }

    return { success: true, isAlreadyExpired: false };
  } catch (err) {
    if (err instanceof AuthApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Error de comunicación durante logout';
    throw new AuthApiError(message, 0);
  }
}
