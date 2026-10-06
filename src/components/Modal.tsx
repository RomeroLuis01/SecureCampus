import React, { useEffect } from 'react'
import { cn } from '../utils'
import { Button } from './Button'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}) => {
  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Telón de fondo con blur institucional */}
      <div
        className="fixed inset-0 bg-secondary/45 backdrop-blur-[2px] transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor del Modal (Layer 3) */}
      <div
        className={cn(
          'relative w-full bg-surface-lowest border border-border-strong rounded-lg shadow-layer-3 overflow-hidden z-10 font-sans my-8',
          sizeClasses[size]
        )}
      >
        {/* Encabezado */}
        {(title || description) && (
          <div className="px-6 py-4 border-b border-border-subtle flex items-start justify-between gap-4 bg-surface-lowest">
            <div>
              {title && (
                <h3 className="text-base font-semibold text-secondary tracking-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-secondary-slate mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-0 h-8 w-8 text-secondary-muted hover:text-secondary -mr-2 flex items-center justify-center shrink-0"
              aria-label="Cerrar modal"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        )}

        {/* Cuerpo del Modal */}
        <div className="p-6 text-xs text-secondary max-h-[75vh] overflow-y-auto">
          {children}
        </div>

        {/* Pie de Modal */}
        {footer && (
          <div className="px-6 py-3.5 bg-surface-canvas border-t border-border-subtle flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
