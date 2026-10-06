import React, { useState } from 'react'
import {
  Bell,
  Search,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Calendar,
  Check,
} from 'lucide-react'
import { cn } from '../utils'
import { Badge } from './Badge'

export interface NotificationItem {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  type?: 'info' | 'warning' | 'success'
}

export interface TopbarProps {
  userName?: string
  userEmail?: string
  userRole?: string
  userAvatar?: string
  term?: string
  notifications?: NotificationItem[]
  onSearch?: (query: string) => void
  onLogout?: () => void
  onMarkNotificationAsRead?: (id: string) => void
}

export const Topbar: React.FC<TopbarProps> = ({
  userName = 'Usuario Institucional',
  userEmail = 'usuario@securecampus.edu',
  userRole = 'Estudiante',
  userAvatar,
  term = 'Periodo 2026-B',
  notifications = [
    {
      id: '1',
      title: 'Calificaciones registradas',
      message: 'Se han publicado las actas ordinarias del segundo parcial.',
      time: 'Hace 10 min',
      read: false,
      type: 'info',
    },
    {
      id: '2',
      title: 'Solicitud aprobada',
      message: 'Tu constancia de estudios está disponible para descarga.',
      time: 'Hace 2 horas',
      read: true,
      type: 'success',
    },
  ],
  onSearch,
  onLogout,
  onMarkNotificationAsRead,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSearch) onSearch(searchQuery)
  }

  return (
    <header className="h-16 bg-surface-lowest border-b border-border px-6 flex items-center justify-between sticky top-0 z-20 font-sans shadow-sm">
      {/* Buscador Rápido Institucional */}
      <div className="flex-1 max-w-md">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-muted pointer-events-none shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar matrículas, asignaturas, actas o expedientes..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-surface-canvas text-secondary border border-border rounded placeholder:text-secondary-muted/70 focus:outline-none focus:ring-1 focus:ring-tertiary focus:border-tertiary transition-colors"
          />
        </form>
      </div>

      {/* Acciones Derechas */}
      <div className="flex items-center gap-4">
        {/* Periodo Académico Activo */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-surface-canvas border border-border rounded text-xs text-secondary-slate shrink-0 leading-none">
          <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-secondary">{term}</span>
        </div>

        {/* Notificaciones */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowUserMenu(false)
            }}
            className="p-2 rounded flex items-center justify-center text-secondary-slate hover:text-secondary hover:bg-surface-canvas transition-colors relative"
            title="Notificaciones"
            aria-label="Ver notificaciones"
          >
            <Bell className="w-4 h-4 shrink-0" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-academic-danger ring-2 ring-white shrink-0" />
            )}
          </button>

          {/* Menú de Notificaciones */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface-lowest border border-border-strong rounded-lg shadow-layer-2 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
                <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Notificaciones
                </span>
                {unreadCount > 0 && (
                  <span className="text-[11px] font-semibold text-primary">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-border-subtle">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-secondary-slate">
                    Sin notificaciones pendientes
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'p-3 hover:bg-surface-canvas transition-colors flex items-start justify-between gap-2',
                        !notif.read && 'bg-blue-50/40'
                      )}
                    >
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-secondary">
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-secondary-slate mt-0.5 leading-snug">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-secondary-muted mt-1 block">
                          {notif.time}
                        </span>
                      </div>
                      {!notif.read && onMarkNotificationAsRead && (
                        <button
                          onClick={() => onMarkNotificationAsRead(notif.id)}
                          className="text-secondary-muted hover:text-primary p-1 flex items-center justify-center shrink-0 rounded transition-colors"
                          title="Marcar como leída"
                        >
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Perfil de Usuario */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu)
              setShowNotifications(false)
            }}
            className="flex items-center gap-3 p-1 rounded hover:bg-surface-canvas transition-colors text-left"
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="w-8 h-8 rounded-full border border-border-strong object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                {userName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-secondary leading-tight truncate max-w-[120px]">
                {userName}
              </p>
              <Badge variant="info" size="sm" className="mt-0.5 text-[9px] py-0 px-1 shrink-0">
                {userRole}
              </Badge>
            </div>
          </button>

          {/* Menú de Usuario */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-surface-lowest border border-border-strong rounded-lg shadow-layer-2 py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3.5 py-2 border-b border-border-subtle">
                <p className="text-xs font-semibold text-secondary">{userName}</p>
                <p className="text-[11px] text-secondary-slate truncate">{userEmail}</p>
              </div>

              <div className="py-1">
                <div className="px-3.5 py-1.5 flex items-center gap-2 text-xs text-secondary-slate hover:bg-surface-canvas cursor-pointer">
                  <UserIcon className="w-3.5 h-3.5 text-secondary-muted shrink-0" />
                  <span>Mi Expediente</span>
                </div>
                <div className="px-3.5 py-1.5 flex items-center gap-2 text-xs text-secondary-slate hover:bg-surface-canvas cursor-pointer">
                  <ShieldCheck className="w-3.5 h-3.5 text-secondary-muted shrink-0" />
                  <span>Seguridad y MFA</span>
                </div>
              </div>

              {onLogout && (
                <div className="border-t border-border-subtle pt-1">
                  <button
                    onClick={onLogout}
                    className="w-full px-3.5 py-1.5 flex items-center gap-2 text-xs text-academic-danger hover:bg-red-50 text-left transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
