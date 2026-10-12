import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type AuthUser,
  getSessionUser,
  loginUser,
  logoutUser,
  AuthApiError,
} from '../services/authClient';
import {
  broadcastAuthEvent,
  onAuthBroadcast,
  setUnconfirmedExitMarker,
  hasUnconfirmedExitMarker,
  clearUnconfirmedExitMarker,
} from '../utils/authSync';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface LogoutResult {
  success: boolean;
  confirmedOnServer: boolean;
  isAlreadyExpired?: boolean;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: (options?: { forceLocal?: boolean }) => Promise<LogoutResult>;
  refreshSession: () => Promise<void>;
  confirmPendingRevocation: () => Promise<boolean>;
  hasPendingUnconfirmedExit: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingUnconfirmedExit, setHasPendingUnconfirmedExit] = useState(false);

  const queryClient = useQueryClient();

  // Contador de peticiones para prevenir condiciones de carrera con respuestas asíncronas tardías
  const requestIdRef = useRef(0);

  const checkSession = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);

    // 1. Verificación de salida local no confirmada previa
    // Evita estrictamente que una recarga restaure silenciosamente la sesión que el usuario intentó cerrar.
    if (hasUnconfirmedExitMarker()) {
      setHasPendingUnconfirmedExit(true);
      try {
        // Intentar concretar la revocación remota pendiente ahora que se vuelve a cargar la aplicación
        await logoutUser();
        clearUnconfirmedExitMarker();
        setHasPendingUnconfirmedExit(false);

        if (currentRequestId === requestIdRef.current) {
          setUser(null);
          setStatus('unauthenticated');
          setError(null);
        }
        return;
      } catch {
        // El backend continúa inaccesible. No restaurar la sesión bajo ningún concepto.
        if (currentRequestId === requestIdRef.current) {
          setUser(null);
          setStatus('unauthenticated');
          setError(
            'Aviso de contingencia: Se realizó una salida local previa porque el servidor no respondió. ' +
            'La sesión no pudo ser confirmada como revocada en PostgreSQL debido a que el backend continúa inaccesible. ' +
            'Por seguridad, no se restauró la sesión anterior.'
          );
        }
        return;
      }
    } else {
      setHasPendingUnconfirmedExit(false);
    }

    try {
      const activeUser = await getSessionUser();

      // Descartar si otra acción (e.g. logout) ocurrió mientras checkSession estaba pendiente
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (activeUser) {
        setUser(activeUser);
        setStatus('authenticated');
        setError(null);
      } else {
        // 401 confirmado: Sin sesión activa en el servidor
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
        // Prohibido: Cuenta suspendida o inactiva
        setStatus('unauthenticated');
        setError(err.message || 'Cuenta suspendida o inactiva.');
      } else {
        // Falla de red, conexión rechazada o error interno de servidor
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Error de conexión con el servidor.';
        setError(message);
      }
    }
  }, []);

  // 1. Verificación inicial de sesión al montar
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // 2. Sincronización de eventos de autenticación entre pestañas (cross-tab)
  useEffect(() => {
    const unsubscribe = onAuthBroadcast((event) => {
      if (event.type === 'LOGOUT') {
        // Otra pestaña cerró sesión: purgar estado local inmediatamente
        ++requestIdRef.current;
        queryClient.clear();
        setUser(null);
        setStatus('unauthenticated');
        setError(null);
      } else if (event.type === 'LOGIN') {
        // Otra pestaña inició sesión: re-validar sesión con la cookie compartida
        checkSession();
      }
    });

    return unsubscribe;
  }, [checkSession, queryClient]);

  const login = useCallback(
    async (identifier: string, password: string): Promise<AuthUser> => {
      const currentRequestId = ++requestIdRef.current;

      try {
        const authenticatedUser = await loginUser(identifier, password);

        if (currentRequestId === requestIdRef.current) {
          setUser(authenticatedUser);
          setStatus('authenticated');
          setError(null);
        }

        // Limpiar la marca de salida previa al autenticarse legítimamente con nuevas credenciales
        clearUnconfirmedExitMarker();
        setHasPendingUnconfirmedExit(false);

        // Notificar a otras pestañas que hay una nueva sesión activa
        broadcastAuthEvent({ type: 'LOGIN', timestamp: Date.now() });

        return authenticatedUser;
      } catch (err) {
        if (currentRequestId === requestIdRef.current) {
          setUser(null);
          setStatus('unauthenticated');
        }
        throw err;
      }
    },
    []
  );

  const logout = useCallback(
    async (options?: { forceLocal?: boolean }): Promise<LogoutResult> => {
      // Invalidar peticiones de verificación en vuelo
      ++requestIdRef.current;

      let confirmedOnServer = false;
      let isAlreadyExpired = false;

      try {
        const res = await logoutUser();
        confirmedOnServer = true;
        isAlreadyExpired = Boolean(res.isAlreadyExpired);
        clearUnconfirmedExitMarker();
        setHasPendingUnconfirmedExit(false);
      } catch (err) {
        if (!options?.forceLocal) {
          // Si no se especificó forzar salida local, propagar el error para que la UI
          // informe al usuario de la falla de red y permita reintentar.
          throw err;
        }
        console.warn('[AuthProvider] Salida local forzada ante fallo de comunicación con el servidor:', err);
        setUnconfirmedExitMarker();
        setHasPendingUnconfirmedExit(true);
      } finally {
        // Limpieza de estado local garantizada si la revocación fue confirmada o si fue forzada
        if (confirmedOnServer || options?.forceLocal) {
          // 1. Resetear estado de autenticación en React
          setUser(null);
          setStatus('unauthenticated');
          setError(null);

          // 2. Limpiar completamente la caché de React Query para prevenir filtración de datos entre usuarios
          queryClient.clear();

          // 3. Notificar a las demás pestañas para que cierren sesión coordinadamente
          broadcastAuthEvent({ type: 'LOGOUT', timestamp: Date.now() });
        }
      }

      return {
        success: true,
        confirmedOnServer,
        isAlreadyExpired,
      };
    },
    [queryClient]
  );

  const confirmPendingRevocation = useCallback(async (): Promise<boolean> => {
    try {
      await logoutUser();
      clearUnconfirmedExitMarker();
      setHasPendingUnconfirmedExit(false);
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
      queryClient.clear();
      broadcastAuthEvent({ type: 'LOGOUT', timestamp: Date.now() });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de comunicación con el servidor';
      setError(`No se pudo confirmar la revocación en el servidor: ${msg}`);
      return false;
    }
  }, [queryClient]);

  const value: AuthContextValue = {
    status,
    user,
    error,
    login,
    logout,
    refreshSession: checkSession,
    confirmPendingRevocation,
    hasPendingUnconfirmedExit,
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
