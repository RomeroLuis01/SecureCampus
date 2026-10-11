import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  type AuthUser,
  getSessionUser,
  loginUser,
  logoutUser,
  AuthApiError,
} from '../services/authClient';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Request counter to ensure stale asynchronous responses cannot overwrite current state
  const requestIdRef = useRef(0);

  const checkSession = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);

    try {
      const activeUser = await getSessionUser();

      // Guard against race conditions (e.g., logout happened while checkSession was pending)
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (activeUser) {
        setUser(activeUser);
        setStatus('authenticated');
        setError(null);
      } else {
        // Confirmed 401: No active session
        setUser(null);
        setStatus('unauthenticated');
        setError(null);
      }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setUser(null);
      if (err instanceof AuthApiError && err.status === 403) {
        // Forbidden: Account suspended or inactive
        setStatus('unauthenticated');
        setError(err.message || 'Cuenta suspendida o inactiva.');
      } else {
        // Network failure, connection refused, or internal server error
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Error de conexión con el servidor.';
        setError(message);
      }
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (identifier: string, password: string): Promise<AuthUser> => {
    // Invalidate any ongoing background checks
    const currentRequestId = ++requestIdRef.current;

    try {
      const authenticatedUser = await loginUser(identifier, password);

      if (currentRequestId === requestIdRef.current) {
        setUser(authenticatedUser);
        setStatus('authenticated');
        setError(null);
      }

      return authenticatedUser;
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // Invalidate any ongoing background checks
    ++requestIdRef.current;

    try {
      await logoutUser();
    } catch (err) {
      console.warn('[AuthProvider] Non-blocking error during remote session logout:', err);
    } finally {
      // Always reset local state to unauthenticated
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
    }
  }, []);

  const value: AuthContextValue = {
    status,
    user,
    error,
    login,
    logout,
    refreshSession: checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
