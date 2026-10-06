// Helper de combinación de clases condicionales
export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(' ')
}

// Formateador de moneda / matrículas / cifras académicas
export function formatStudentId(id: string | number): string {
  return String(id).padStart(8, '0')
}

// Formato de promedio con dos decimales exactos y cifras tabulares
export function formatGPA(score: number): string {
  return score.toFixed(2)
}

// Formato de fechas institucionales
export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}
