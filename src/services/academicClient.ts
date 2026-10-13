import { AuthApiError } from './authClient';

export interface PartialGradeItem {
  numeroParcial: number;
  valor: number | null;
  estado: 'PENDIENTE' | 'CAPTURADA';
}

export interface SubjectGradeItem {
  inscripcionId: string;
  codigo: string;
  asignatura: string;
  creditos: number;
  profesor: string;
  claveGrupo: string;
  numeroParciales?: number;
  parciales?: PartialGradeItem[];
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

export interface StudentDocumentRequestItem {
  solicitudId: string;
  folio: string;
  tipoCodigo: string;
  tipoNombre: string;
  estado: 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';
  solicitadaEn: string;
  resueltaEn: string | null;
  observaciones: string | null;
  descargable: boolean;
}

export interface StudentAcademicStatus {
  alumnoId: string;
  matricula: string;
  estadoAlumno: 'ACTIVO' | 'INACTIVO' | 'EGRESADO' | 'BAJA';
  puedeSolicitar: boolean;
}

export interface RequestTypeItem {
  tipoSolicitudId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
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

/**
 * Checks the authenticated student's authoritative academic standing and request eligibility.
 */
export async function getStudentAcademicStatus(): Promise<StudentAcademicStatus> {
  const response = await fetch(`${API_BASE}/estudiante/estado-academico`, {
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
    const message = data?.error?.message || `Error al consultar estatus del estudiante (${response.status})`;
    throw new AuthApiError(message, response.status);
  }

  const data = await response.json();
  return data as StudentAcademicStatus;
}

/**
 * Retrieves all previous document requests for the authenticated student.
 */
export async function getStudentDocumentRequests(): Promise<StudentDocumentRequestItem[]> {
  const response = await fetch(`${API_BASE}/estudiante/solicitudes`, {
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
    const message = data?.error?.message || `Error al consultar solicitudes (${response.status})`;
    throw new AuthApiError(message, response.status);
  }

  const data = await response.json();
  return data as StudentDocumentRequestItem[];
}

/**
 * Creates a new document request. The backend strictly requires active student standing.
 */
export async function createStudentDocumentRequest(
  tipoCodigo: string,
  observaciones?: string
): Promise<StudentDocumentRequestItem> {
  const response = await fetch(`${API_BASE}/estudiante/solicitudes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ tipoCodigo, observaciones }),
  });

  if (response.status === 401) {
    throw new AuthApiError('Sesión requerida o expirada', 401);
  }

  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || 'Acceso denegado: Únicamente los alumnos con estatus académico activo pueden generar solicitudes';
    throw new AuthApiError(message, 403);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || `Error al crear solicitud (${response.status})`;
    throw new AuthApiError(message, response.status);
  }

  const data = await response.json();
  return data as StudentDocumentRequestItem;
}

/**
 * Retrieves active document request types.
 */
export async function getActiveRequestTypes(): Promise<RequestTypeItem[]> {
  const response = await fetch(`${API_BASE}/estudiante/solicitudes/tipos`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || 'Error al obtener tipos de solicitud';
    throw new AuthApiError(message, response.status);
  }

  const data = await response.json();
  return data as RequestTypeItem[];
}
