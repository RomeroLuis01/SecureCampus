import React from 'react'
import { cn } from '../utils'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
  options?: SelectOption[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, options, className = '', id, disabled, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const hasError = Boolean(error)

    return (
      <div className="w-full flex flex-col gap-1 font-sans">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-secondary-slate select-none flex items-center justify-between"
          >
            <span>{label}</span>
            {props.required && <span className="text-academic-danger font-bold text-xs">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full h-9 px-3 pr-8 text-xs bg-surface-lowest text-secondary border rounded transition-colors outline-none appearance-none cursor-pointer',
              'focus:ring-1 focus:ring-tertiary focus:border-tertiary',
              hasError
                ? 'border-academic-danger focus:ring-academic-danger focus:border-academic-danger'
                : 'border-border-strong hover:border-secondary-slate',
              disabled && 'bg-surface-canvas text-secondary-muted border-border cursor-not-allowed opacity-60',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Icono de flecha desplegable custom */}
          <div className="absolute right-2.5 pointer-events-none text-secondary-muted flex items-center">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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

Select.displayName = 'Select'
