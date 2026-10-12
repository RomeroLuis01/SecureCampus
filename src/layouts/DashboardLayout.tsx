import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  User,
  GraduationCap,
  FileText,
  Users,
  ShieldAlert,
  Server,
  BookOpen,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Sidebar, Topbar, Button } from '../components'
import type { NavItem } from '../components'
import { useAuth } from '../context/AuthContext'

export interface DashboardLayoutProps {
  role?: 'estudiante' | 'admin' | 'profesor' | 'jefe_carrera'
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ role = 'estudiante' }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // Navegación según el rol activo
  const navigationByRole: Record<string, { roleName: string; roleTitle: string; items: NavItem[] }> = {
    estudiante: {
      roleName: 'ESTUDIANTE',
      roleTitle: 'Portal del Alumno',
      items: [
        {
          label: 'Inicio y Resumen',
          to: '/estudiante',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Mi Perfil y Expediente',
          to: '/estudiante/perfil',
          icon: <User className="w-4 h-4" />,
        },
        {
          label: 'Mis Calificaciones',
          to: '/estudiante/calificaciones',
          icon: <GraduationCap className="w-4 h-4" />,
          badge: '2026-B',
        },
        {
          label: 'Solicitudes y Trámites',
          to: '/estudiante/solicitudes',
          icon: <FileText className="w-4 h-4" />,
          badge: 4,
          badgeVariant: 'warning',
        },
      ],
    },
    admin: {
      roleName: 'ADMINISTRADOR',
      roleTitle: 'Control Escolar & TI',
      items: [
        {
          label: 'Panel Administrativo',
          to: '/admin',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Gestión de Usuarios',
          to: '/admin/usuarios',
          icon: <Users className="w-4 h-4" />,
          badge: 6,
        },
        {
          label: 'Bitácora de Auditoría',
          to: '/admin/auditoria',
          icon: <ShieldAlert className="w-4 h-4" />,
        },
        {
          label: 'Estado del Sistema',
          to: '/admin/sistema',
          icon: <Server className="w-4 h-4" />,
        },
      ],
    },
    profesor: {
      roleName: 'PROFESOR',
      roleTitle: 'Portal Docente',
      items: [
        {
          label: 'Inicio y Resumen',
          to: '/profesor',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Mi Perfil Docente',
          to: '/profesor/perfil',
          icon: <User className="w-4 h-4" />,
        },
        {
          label: 'Mis Grupos Asignados',
          to: '/profesor/grupos',
          icon: <BookOpen className="w-4 h-4" />,
          badge: 3,
        },
        {
          label: 'Captura de Calificaciones',
          to: '/profesor/calificaciones',
          icon: <GraduationCap className="w-4 h-4" />,
          badge: '2026-B',
        },
      ],
    },
    jefe_carrera: {
      roleName: 'JEFE DE CARRERA',
      roleTitle: 'Gestión Curricular',
      items: [
        {
          label: 'Inicio y Resumen',
          to: '/jefe_carrera',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Gestión Planta Docente',
          to: '/jefe_carrera/docentes',
          icon: <Users className="w-4 h-4" />,
          badge: 24,
        },
        {
          label: 'Oferta Curricular & Horarios',
          to: '/jefe_carrera/oferta',
          icon: <Calendar className="w-4 h-4" />,
          badge: 48,
        },
        {
          label: 'Perfil de Jefatura',
          to: '/jefe_carrera/perfil',
          icon: <User className="w-4 h-4" />,
        },
      ],
    },
  }

  const currentConfig = navigationByRole[role] || navigationByRole.estudiante

  // Filtrar portales alternativos estrictamente según los roles vigentes del usuario
  const userRoles = user?.roles?.map((r) => r.codigo) || []
  const authorizedPortals = [
    { code: 'ALUMNO', path: '/estudiante', label: 'Estudiante', active: role === 'estudiante' },
    { code: 'PROFESOR', path: '/profesor', label: 'Profesor', active: role === 'profesor' },
    { code: 'JEFE_CARRERA', path: '/jefe_carrera', label: 'Jefe de Carrera', active: role === 'jefe_carrera' },
    { code: 'ADMINISTRADOR', path: '/admin', label: 'Administrador', active: role === 'admin' },
  ].filter((p) => userRoles.includes(p.code))

  const handleLogout = async (forceLocal = false) => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      const result = await logout({ forceLocal })
      if (!result.confirmedOnServer) {
        navigate('/login', {
          replace: true,
          state: {
            unconfirmedLogout: true,
            warning:
              'Salida local completada. La revocación en el servidor no pudo ser confirmada debido a una falla de comunicación con el backend.',
          },
        })
      } else {
        navigate('/login', { replace: true })
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo contactar al servidor central para revocar la sesión criptográfica.'
      setLogoutError(
        `Fallo al revocar sesión remota: ${msg}. La sesión local se mantiene activa para permitir el reintento.`
      )
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-canvas flex font-sans">
      {/* Barra de Navegación Lateral con Botón de Logout Integrado */}
      <Sidebar
        roleName={currentConfig.roleName}
        roleTitle={currentConfig.roleTitle}
        navItems={currentConfig.items}
        isCollapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onLogout={() => handleLogout(false)}
        isLoggingOut={isLoggingOut}
        footerAction={
          <div className="p-2 bg-surface-canvas border border-border-subtle rounded text-[11px] text-secondary-slate">
            <span className="font-semibold block text-secondary">SecureCampus v1.0</span>
            <span>Auditoría Activa</span>
          </div>
        }
      />

      {/* Área de Visualización */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          userName={user?.nombreCompleto || 'Usuario Institucional'}
          userEmail={user?.correo || 'usuario@securecampus.edu'}
          userRole={currentConfig.roleName}
          term="Periodo 2026-B"
          onSearch={(query) => console.log('Búsqueda:', query)}
          onLogout={() => handleLogout(false)}
          isLoggingOut={isLoggingOut}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {/* Alerta de Contingencia si falla la revocación remota en el servidor */}
          {logoutError && (
            <div
              role="alert"
              className="mb-6 p-4 bg-academic-danger-bg border border-academic-danger-border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in"
            >
              <div className="flex items-center gap-2.5 text-xs text-academic-danger-text font-medium">
                <AlertCircle className="w-5 h-5 shrink-0 text-academic-danger" />
                <span>{logoutError}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleLogout(false)}
                  isLoading={isLoggingOut}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Reintentar revocación
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleLogout(true)}
                >
                  Salir solo localmente
                </Button>
              </div>
            </div>
          )}

          <Outlet />
        </main>

        <footer className="border-t border-border bg-surface-lowest py-4 px-6 text-center text-xs text-secondary-slate flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>SecureCampus Platform • Entorno Académico Seguro</span>
          {authorizedPortals.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-secondary-muted">Cambiar portal:</span>
              {authorizedPortals.map((portal, index) => (
                <React.Fragment key={portal.path}>
                  {index > 0 && <span className="text-border">•</span>}
                  <button
                    onClick={() => navigate(portal.path)}
                    className={`hover:underline font-medium ${
                      portal.active ? 'text-secondary font-bold underline' : 'text-primary'
                    }`}
                  >
                    {portal.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
