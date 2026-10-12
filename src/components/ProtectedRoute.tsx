import React from 'react';
import { Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ShieldAlert, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userHasAnyRole, getDefaultRouteForUser, type AnyRole } from '../utils/roles';
import { sanitizeReturnUrl } from '../utils/url';
import { Button, Card, CardBody } from './index';

export interface ProtectedRouteProps {
  allowedRoles?: AnyRole[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const {
    status,
    user,
    error,
    refreshSession,
    logout,
    isLoggedOut,
    hasPendingUnconfirmedExit,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Estado de carga inicial: Indicador accesible sin exponer datos privados
  if (status === 'loading') {
    return (
      <div
        className="min-h-screen bg-surface-canvas flex flex-col items-center justify-center p-4 font-sans"
        role="status"
        aria-live="polite"
      >
        <div className="w-12 h-12 rounded bg-primary text-white flex items-center justify-center font-bold text-lg shadow-md mb-4 animate-pulse">
          SC
        </div>
        <div className="flex items-center gap-3 text-secondary font-semibold text-sm">
          <RefreshCw className="w-4 h-4 text-primary animate-spin" />
          <span>Verificando sesión institucional...</span>
        </div>
        <p className="text-xs text-secondary-slate mt-1.5">
          Validando credenciales criptográficas con el servidor central.
        </p>
      </div>
    );
  }

  // 2. Estado de error de red o servidor 5xx: Pantalla de contingencia recuperable
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-4 font-sans">
        <Card variant="elevated" className="max-w-md w-full border-academic-danger-border shadow-layer-2">
          <div className="p-6 border-b border-border-subtle bg-surface-canvas text-center">
            <div className="w-12 h-12 bg-academic-danger-bg rounded text-academic-danger-text mx-auto flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-secondary">Error de Conexión Institucional</h1>
            <p className="text-xs text-secondary-slate mt-1">
              No fue posible verificar su sesión de usuario con el servidor central.
            </p>
          </div>
          <CardBody className="p-6 space-y-4">
            <div className="p-3 bg-academic-danger-bg border border-academic-danger-border rounded text-xs text-academic-danger-text">
              {error || 'Error de comunicación o servidor no disponible.'}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => refreshSession()}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Reintentar
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={() => logout()}
              >
                Ir a Inicio de Sesión
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // 3. No autenticado (401 o sin sesión): Redirigir a /login
  if (status === 'unauthenticated' || !user) {
    // Si la desautenticación ocurrió por un logout explícito (local o cross-tab),
    // bajo ninguna circunstancia se debe conservar la ruta privada anterior como returnUrl.
    if (isLoggedOut) {
      return (
        <Navigate
          to="/login"
          replace
          state={hasPendingUnconfirmedExit ? { unconfirmedLogout: true } : undefined}
        />
      );
    }

    const rawTarget = location.pathname + location.search + location.hash;
    const safeReturnUrl = sanitizeReturnUrl(rawTarget, '/');
    const loginTarget = safeReturnUrl !== '/'
      ? `/login?returnUrl=${encodeURIComponent(safeReturnUrl)}`
      : '/login';

    return <Navigate to={loginTarget} replace state={{ from: location }} />;
  }

  // 4. Verificación de rol: Acceso Denegado (403) si no posee el rol requerido
  if (allowedRoles && allowedRoles.length > 0 && !userHasAnyRole(user, allowedRoles)) {
    const defaultPortal = getDefaultRouteForUser(user);

    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-4 font-sans">
        <Card variant="elevated" className="max-w-md w-full border-border shadow-layer-2">
          <div className="p-6 border-b border-border-subtle bg-surface-canvas text-center">
            <div className="w-12 h-12 bg-academic-warning-bg rounded text-academic-warning-text mx-auto flex items-center justify-center mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-secondary">Acceso Restringido (403)</h1>
            <p className="text-xs text-secondary-slate mt-1">
              Su cuenta institucional no cuenta con los roles necesarios para ver este portal.
            </p>
          </div>
          <CardBody className="p-6 space-y-4">
            <div className="text-xs text-secondary-slate space-y-1">
              <p>
                <strong>Usuario:</strong> {user.nombreCompleto} ({user.correo})
              </p>
              <p>
                <strong>Roles asignados:</strong>{' '}
                {user.roles.map((r) => r.codigo).join(', ') || 'Sin roles activos'}
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => {
                  if (defaultPortal && defaultPortal !== '/login') {
                    navigate(defaultPortal);
                  } else {
                    logout().finally(() => navigate('/login'));
                  }
                }}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Ir a mi Portal Asignado
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // 5. Sesión y rol verificados satisfactoriamente: Renderizar vista protegida
  return children ? <>{children}</> : <Outlet />;
};
