import React from 'react'
import { cn } from '../utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'elevated'
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className = '', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-surface-lowest border border-border shadow-layer-1',
      flat: 'bg-surface-lowest border border-border',
      elevated: 'bg-surface-lowest border border-border-strong shadow-layer-2',
    }

    return (
      <div
        ref={ref}
        className={cn('rounded-lg overflow-hidden transition-all', variantStyles[variant], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ action, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'p-5 border-b border-border-subtle flex items-center justify-between gap-4 bg-surface-lowest',
          className
        )}
        {...props}
      >
        <div className="flex-1 min-w-0">{children}</div>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </div>
    )
  }
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-base font-semibold text-secondary tracking-tight leading-tight', className)}
        {...props}
      >
        {children}
      </h3>
    )
  }
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <p ref={ref} className={cn('text-xs text-secondary-slate mt-0.5 leading-normal', className)} {...props}>
        {children}
      </p>
    )
  }
)
CardDescription.displayName = 'CardDescription'

export const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('p-5 text-secondary', className)} {...props}>
        {children}
      </div>
    )
  }
)
CardBody.displayName = 'CardBody'
export const CardContent = CardBody

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'px-5 py-3.5 bg-surface-canvas border-t border-border-subtle flex items-center justify-between gap-3 text-xs text-secondary-slate',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardFooter.displayName = 'CardFooter'
