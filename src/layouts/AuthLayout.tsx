import React from 'react'
import { Outlet, Link } from 'react-router-dom'

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-canvas flex flex-col justify-between font-sans">
      {/* Barra Superior Minimalista */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-border bg-surface-lowest">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-bold text-xs shadow-sm">
            SC
          </div>
          <div>
            <span className="text-sm font-bold text-secondary tracking-tight block leading-none">
              SecureCampus
            </span>
            <span className="text-[10px] text-secondary-slate uppercase tracking-wider font-semibold">
              Sistema de Gestión Institucional
            </span>
          </div>
        </Link>
      </header>

      {/* Contenido Central */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Pie de Página Institucional */}
      <footer className="py-4 text-center text-xs text-secondary-slate border-t border-border bg-surface-lowest">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 SecureCampus. Todos los derechos reservados.</span>
          <div className="flex items-center gap-4 text-secondary-slate">
            <span className="hover:underline cursor-pointer">Aviso de Privacidad</span>
            <span className="hover:underline cursor-pointer">Seguridad & MFA</span>
            <span className="hover:underline cursor-pointer">Soporte Técnico</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
