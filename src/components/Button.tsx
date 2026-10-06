import React from 'react'
import { cn } from '../utils'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Variantes de diseño institucional
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-primary text-white hover:bg-primary-hover active:bg-primary-active border border-transparent shadow-layer-1 focus:ring-2 focus:ring-tertiary focus:ring-offset-1',
      secondary:
        'bg-surface-lowest text-secondary border border-border-strong hover:bg-surface-canvas active:bg-surface-dim hover:border-secondary-slate focus:ring-2 focus:ring-tertiary focus:ring-offset-1',
      danger:
        'bg-academic-danger text-white hover:bg-red-700 active:bg-red-800 border border-transparent shadow-layer-1 focus:ring-2 focus:ring-red-500 focus:ring-offset-1',
      ghost:
        'bg-transparent text-secondary-slate hover:bg-surface-low hover:text-secondary active:bg-surface-container border border-transparent',
    }

    // Escala de tamaños (32px tabla, 36px estándar, 40px destacado)
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-2.5 text-xs font-medium gap-1.5 rounded',
      md: 'h-9 px-3.5 text-sm font-medium gap-2 rounded',
      lg: 'h-10 px-4 text-sm font-semibold gap-2.5 rounded',
    }

    const isDisabled = disabled || isLoading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap transition-colors select-none font-sans outline-none focus:outline-none leading-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 shrink-0 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon && <span className="inline-flex items-center justify-center shrink-0">{leftIcon}</span>
        )}
        {children && <span className="inline-flex items-center leading-none">{children}</span>}
        {!isLoading && rightIcon && (
          <span className="inline-flex items-center justify-center shrink-0">{rightIcon}</span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
