import React from 'react'
import { cn } from '../utils'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'inactive'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'info',
  size = 'sm',
  dot = false,
  className = '',
  children,
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    success: {
      container: 'bg-academic-success-bg text-academic-success-text border-academic-success-border',
      dot: 'bg-academic-success',
    },
    warning: {
      container: 'bg-academic-warning-bg text-academic-warning-text border-academic-warning-border',
      dot: 'bg-academic-warning',
    },
    danger: {
      container: 'bg-academic-danger-bg text-academic-danger-text border-academic-danger-border',
      dot: 'bg-academic-danger',
    },
    info: {
      container: 'bg-surface-container text-primary border-surface-highest',
      dot: 'bg-primary',
    },
    inactive: {
      container: 'bg-academic-inactive-bg text-academic-inactive-text border-academic-inactive-border',
      dot: 'bg-secondary-slate',
    },
  }

  const sizeStyles: Record<BadgeSize, string> = {
    sm: 'h-5 px-2 text-[11px] font-semibold tracking-wider uppercase rounded-sm',
    md: 'h-6 px-2.5 text-xs font-semibold tracking-wide rounded-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1.5 border select-none font-sans whitespace-nowrap leading-none align-middle',
        variantStyles[variant].container,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', variantStyles[variant].dot)}
          aria-hidden="true"
        />
      )}
      <span className="inline-flex items-center leading-none">{children}</span>
    </span>
  )
}
