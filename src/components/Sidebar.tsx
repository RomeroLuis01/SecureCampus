import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { cn } from '../utils'
import { Badge } from './Badge'

export interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  badge?: string | number
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info'
}

export interface SidebarProps {
  roleName?: string
  roleTitle?: string
  navItems: NavItem[]
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  footerAction?: React.ReactNode
}

export const Sidebar: React.FC<SidebarProps> = ({
  roleName = 'ESTUDIANTE',
  roleTitle = 'Portal Académico',
  navItems,
  isCollapsed = false,
  onToggleCollapse,
  footerAction,
}) => {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 bg-surface-lowest border-r border-border flex flex-col transition-all duration-300 select-none z-30 font-sans shadow-layer-1',
        isCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Cabecera del Sidebar con Marca Institucional */}
      <div className="h-16 border-b border-border-subtle flex items-center px-4 justify-between bg-surface-lowest">
        {!isCollapsed ? (
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-bold text-xs tracking-wider shrink-0 shadow-sm">
              SC
            </div>
            <div className="truncate">
              <h2 className="text-sm font-bold text-secondary tracking-tight leading-tight">
                SecureCampus
              </h2>
              <p className="text-[10px] text-secondary-slate uppercase font-medium tracking-wider">
                {roleTitle}
              </p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded bg-primary text-white flex items-center justify-center font-bold text-xs">
            SC
          </div>
        )}

        {onToggleCollapse && !isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded flex items-center justify-center text-secondary-muted hover:text-secondary hover:bg-surface-low transition-colors shrink-0"
            title="Colapsar menú"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </button>
        )}
      </div>

      {/* Indicador de Rol */}
      {!isCollapsed && (
        <div className="px-4 py-2.5 bg-surface-canvas border-b border-border-subtle flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-secondary-slate tracking-wider flex items-center gap-1.5 leading-none">
            <Shield className="w-3 h-3 text-primary shrink-0" />
            Rol Activo
          </span>
          <Badge variant="info" size="sm" className="shrink-0">
            {roleName}
          </Badge>
        </div>
      )}

      {/* Navegación Principal */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 text-xs rounded transition-all font-medium leading-none',
                isActive
                  ? 'bg-blue-50 text-primary border-l-2 border-primary font-semibold'
                  : 'text-secondary-slate hover:bg-surface-canvas hover:text-secondary'
              )}
            >
              <span
                className={cn(
                  'shrink-0 flex items-center justify-center w-4 h-4 transition-colors',
                  isActive ? 'text-primary' : 'text-secondary-muted group-hover:text-secondary'
                )}
              >
                {item.icon}
              </span>

              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 leading-none">{item.label}</span>
                  {item.badge !== undefined && (
                    <Badge variant={item.badgeVariant || 'info'} size="sm" className="shrink-0">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Pie del Sidebar / Botón de Expansión si está colapsado */}
      <div className="p-3 border-t border-border-subtle bg-surface-lowest">
        {isCollapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-full py-2 flex items-center justify-center text-secondary-muted hover:text-secondary hover:bg-surface-low rounded transition-colors"
            title="Expandir menú"
          >
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>
        )}

        {footerAction && !isCollapsed && (
          <div className="pt-1">{footerAction}</div>
        )}
      </div>
    </aside>
  )
}
