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
} from 'lucide-react'
import { Sidebar, Topbar } from '../components'
import type { NavItem } from '../components'
import { useAuth } from '../context/AuthContext'

export interface DashboardLayoutProps {
  role?: 'estudiante' | 'admin' | 'profesor' | 'jefe_carrera'
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ role = 'estudiante' }) => {
  const [collapsed, setCollapsed] = useState(false)
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

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface-canvas flex font-sans">
      {/* Barra de Navegación Lateral */}
      <Sidebar
        roleName={currentConfig.roleName}
        roleTitle={currentConfig.roleTitle}
        navItems={currentConfig.items}
        isCollapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
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
          onLogout={handleLogout}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
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

