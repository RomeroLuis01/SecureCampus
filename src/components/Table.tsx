import React from 'react'
import { cn } from '../utils'
import { Button } from './Button'

export interface Column<T> {
  key: string
  title: string
  align?: 'left' | 'center' | 'right'
  width?: string | number
  render?: (item: T, index: number) => React.ReactNode
  isNumeric?: boolean
}

export interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  rowKey?: (item: T, index: number) => string | number
  onRowClick?: (item: T) => void
  selectedRowKey?: string | number
  // Paginación
  pagination?: {
    currentPage: number
    totalPages: number
    pageSize: number
    totalItems: number
    onPageChange: (page: number) => void
  }
  className?: string
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No se encontraron registros académicos.',
  rowKey,
  onRowClick,
  selectedRowKey,
  pagination,
  className = '',
}: TableProps<T>) {
  return (
    <div className={cn('w-full flex flex-col bg-surface-lowest border border-border rounded-lg shadow-layer-1 overflow-hidden font-sans', className)}>
      {/* Contenedor con scroll horizontal responsivo */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-canvas border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'py-2.5 px-3.5 text-[11px] font-bold uppercase tracking-wider text-secondary-slate select-none whitespace-nowrap',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right'
                  )}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {isLoading ? (
              // Esqueleto de carga institucional
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={`skeleton-col-${cIdx}`} className="py-3 px-3.5">
                      <div className="h-4 bg-surface-container rounded-sm w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 px-4 text-center text-xs text-secondary-slate"
                >
                  <div className="max-w-xs mx-auto flex flex-col items-center">
                    <svg
                      className="w-10 h-10 text-secondary-muted/40 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const currentKey = rowKey ? rowKey(item, index) : index
                const isSelected = selectedRowKey !== undefined && selectedRowKey === currentKey

                return (
                  <tr
                    key={currentKey}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={cn(
                      'transition-colors text-xs text-secondary',
                      onRowClick && 'cursor-pointer',
                      isSelected
                        ? 'bg-blue-50/70 border-l-2 border-primary font-medium'
                        : 'hover:bg-surface-canvas'
                    )}
                  >
                    {columns.map((col) => {
                      const value = item[col.key]
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'py-2.5 px-3.5 align-middle',
                            col.isNumeric && 'tabular-nums font-mono',
                            col.align === 'center' && 'text-center',
                            col.align === 'right' && 'text-right'
                          )}
                        >
                          {col.render ? col.render(item, index) : value ?? '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Barra de Paginación */}
      {pagination && (
        <div className="px-4 py-3 bg-surface-canvas border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-secondary-slate">
          <div className="tabular-nums">
            Mostrando{' '}
            <span className="font-semibold text-secondary">
              {data.length > 0 ? (pagination.currentPage - 1) * pagination.pageSize + 1 : 0}
            </span>{' '}
            a{' '}
            <span className="font-semibold text-secondary">
              {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)}
            </span>{' '}
            de{' '}
            <span className="font-semibold text-secondary">{pagination.totalItems}</span> registros
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.currentPage <= 1 || isLoading}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
            >
              Anterior
            </Button>
            <span className="px-3 text-xs font-medium tabular-nums">
              {pagination.currentPage} / {Math.max(1, pagination.totalPages)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.currentPage >= pagination.totalPages || isLoading}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
