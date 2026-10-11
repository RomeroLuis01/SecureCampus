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
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error('Error durante logout:', err);
  }
}
