import React from 'react'
import { cn } from '../utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftIcon, rightIcon, className = '', id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const hasError = Boolean(error)

    return (
      <div className="w-full flex flex-col gap-1 font-sans">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-secondary-slate select-none flex items-center justify-between"
          >
            <span>{label}</span>
            {props.required && <span className="text-academic-danger font-bold text-xs">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-muted flex items-center justify-center pointer-events-none shrink-0 w-4 h-4">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full h-9 px-3 text-xs bg-surface-lowest text-secondary border rounded transition-colors placeholder:text-secondary-muted/60 outline-none',
              'focus:ring-1 focus:ring-tertiary focus:border-tertiary',
              leftIcon ? 'pl-9' : 'pl-3',
              rightIcon ? 'pr-9' : 'pr-3',
              hasError
                ? 'border-academic-danger focus:ring-academic-danger focus:border-academic-danger text-academic-danger'
                : 'border-border-strong hover:border-secondary-slate',
              disabled && 'bg-surface-canvas text-secondary-muted border-border cursor-not-allowed opacity-60',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-muted flex items-center justify-center shrink-0">
              {rightIcon}
            </div>
          )}
        </div>

        {(error || helperText) && (
          <p
            className={cn(
              'text-[11px] leading-tight',
              hasError ? 'text-academic-danger font-medium' : 'text-secondary-slate'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
