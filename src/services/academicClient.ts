import { AuthApiError } from './authClient';

export interface SubjectGradeItem {
  inscripcionId: string;
  codigo: string;
  asignatura: string;
  creditos: number;
  profesor: string;
  claveGrupo: string;
  estadoInscripcion: string;
  calificacionFinal: number | null;
  estadoCalificacion: 'PENDIENTE' | 'CAPTURADA';
  estado: 'APROBADA' | 'REPROBADA' | 'PENDIENTE';
}

export interface AcademicPeriodGrades {
  periodoId: string;
  codigo: string;
  nombre: string;
  esActivo: boolean;
  materias: SubjectGradeItem[];
  resumen: {
    promedio: number | null;
    creditosAprobados: number;
    totalMaterias: number;
  };
}

export interface StudentGradesResponse {
  matricula: string | null;
  alumnoNombre: string | null;
  periodos: AcademicPeriodGrades[];
  resumenGeneral: {
    promedioGeneral: number | null;
    creditosTotalesAprobados: number;
    totalMateriasCursadas: number;
  };
}

const API_BASE = '/api/v1';

/**
 * Fetches real grades and academic periods for the authenticated student.
 * Sends HttpOnly session cookie automatically.
 */
export async function getStudentGrades(): Promise<StudentGradesResponse> {
  const response = await fetch(`${API_BASE}/estudiante/calificaciones`, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) {
    throw new AuthApiError('Sesión requerida o expirada', 401);
  }

  if (response.status === 403) {
    throw new AuthApiError('Acceso denegado: rol de estudiante requerido', 403);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || `Error al obtener calificaciones (${response.status})`;
    throw new AuthApiError(message, response.status);
  }

  const data = await response.json();
  return data as StudentGradesResponse;
}
