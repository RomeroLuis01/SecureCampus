import { query, withUserTransaction } from '../config/database.js';
import { AppClientError } from '../middleware/errorHandler.js';

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

/**
 * Checks student's authoritative institutional status in academico.alumnos.
 * Distinguishes academic standing ('ACTIVO', 'INACTIVO', 'EGRESADO', 'BAJA')
 * from authentication account state in seguridad.usuarios.
 */
export async function getStudentAcademicStatus(personaId: string): Promise<StudentAcademicStatus> {
  const result = await query<{
    alumno_id: string;
    matricula: string;
    estado: 'ACTIVO' | 'INACTIVO' | 'EGRESADO' | 'BAJA';
  }>(
    `SELECT alumno_id, matricula, estado 
     FROM academico.alumnos 
     WHERE persona_id = $1`,
    [personaId]
  );

  if (result.rows.length === 0) {
    throw new AppClientError('No se encontró expediente institucional de alumno asociado al usuario', 404);
  }

  const row = result.rows[0];

  return {
    alumnoId: row.alumno_id,
    matricula: row.matricula,
    estadoAlumno: row.estado,
    puedeSolicitar: row.estado === 'ACTIVO',
  };
}

/**
 * Creates a new document request strictly validating active student status.
 *
 * Invariant enforcement:
 * 1. Resolved exclusively from authenticated server session (personaId, usuarioId).
 * 2. Never accepts matricula, studentId, or active flag from client inputs.
 * 3. Race condition prevention via atomic transaction check.
 * 4. Inactive students ('INACTIVO', 'EGRESADO', 'BAJA') are firmly rejected with 403.
 */
export async function createDocumentRequest(params: {
  usuarioId: string;
  personaId: string;
  tipoCodigo: string;
  observaciones?: string;
}): Promise<StudentDocumentRequestItem> {
  const { usuarioId, personaId, tipoCodigo, observaciones } = params;

  if (!tipoCodigo || typeof tipoCodigo !== 'string') {
    throw new AppClientError('El tipo de trámite es obligatorio', 400);
  }

  const normalizedTipo = tipoCodigo.trim().toUpperCase();

  return withUserTransaction(usuarioId, async (client) => {
    // 1. Authoritative check with row lock FOR SHARE to prevent concurrent deactivation races
    const studentCheck = await client.query<{
      alumno_id: string;
      matricula: string;
      estado: string;
    }>(
      `SELECT a.alumno_id, a.matricula, a.estado
       FROM academico.alumnos a
       WHERE a.persona_id = $1
       FOR SHARE`,
      [personaId]
    );

    if (studentCheck.rows.length === 0) {
      throw new AppClientError('No se encontró expediente de alumno asociado al usuario autenticado', 404);
    }

    const student = studentCheck.rows[0];

    if (student.estado !== 'ACTIVO') {
      throw new AppClientError(
        `Acceso denegado: Únicamente los alumnos con estatus académico ACTIVO pueden generar solicitudes de documentos (su estatus actual es: ${student.estado})`,
        403
      );
    }

    // 2. Validate request type exists and is active
    const typeQuery = await client.query<{
      tipo_solicitud_id: string;
      codigo: string;
      nombre: string;
    }>(
      `SELECT tipo_solicitud_id, codigo, nombre
       FROM solicitudes.tipos_solicitud
       WHERE codigo = $1 AND esta_activo = true`,
      [normalizedTipo]
    );

    if (typeQuery.rows.length === 0) {
      throw new AppClientError(`El tipo de trámite '${normalizedTipo}' no es válido o no está activo`, 400);
    }

    const tipo = typeQuery.rows[0];

    // 3. Insert document request (triggers automatic insert into historial_estado_solicitud)
    const insertResult = await client.query<{
      solicitud_id: string;
      solicitada_en: string;
      estado: 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';
    }>(
      `INSERT INTO solicitudes.solicitudes (
         solicitante_usuario_id,
         tipo_solicitud_id,
         estado,
         notas_resolucion
       )
       VALUES ($1, $2, 'PENDIENTE', $3)
       RETURNING solicitud_id, solicitada_en, estado`,
      [usuarioId, tipo.tipo_solicitud_id, observaciones?.trim() || null]
    );

    const newRow = insertResult.rows[0];
    const solId = newRow.solicitud_id || (newRow as any).id || 'sol-00000000';
    const folio = `SOL-${solId.slice(0, 8).toUpperCase()}`;

    return {
      solicitudId: solId,
      folio,
      tipoCodigo: tipo.codigo,
      tipoNombre: tipo.nombre,
      estado: newRow.estado,
      solicitadaEn: newRow.solicitada_en,
      resueltaEn: null,
      observaciones: observaciones?.trim() || null,
      descargable: false,
    };
  });
}

/**
 * Retrieves all past and present document requests for the authenticated student.
 * Permitted for inactive students so they may consult historical records.
 */
export async function getStudentRequests(usuarioId: string): Promise<StudentDocumentRequestItem[]> {
  const sql = `
    SELECT 
      s.solicitud_id,
      ts.codigo AS tipo_codigo,
      ts.nombre AS tipo_nombre,
      s.estado,
      s.solicitada_en,
      s.resuelta_en,
      s.notas_resolucion
    FROM solicitudes.solicitudes s
    JOIN solicitudes.tipos_solicitud ts ON ts.tipo_solicitud_id = s.tipo_solicitud_id
    WHERE s.solicitante_usuario_id = $1
    ORDER BY s.solicitada_en DESC
  `;

  const result = await query<{
    solicitud_id: string;
    tipo_codigo: string;
    tipo_nombre: string;
    estado: 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';
    solicitada_en: string;
    resuelta_en: string | null;
    notas_resolucion: string | null;
  }>(sql, [usuarioId]);

  return result.rows.map((r) => ({
    solicitudId: r.solicitud_id,
    folio: `SOL-${r.solicitud_id.slice(0, 8).toUpperCase()}`,
    tipoCodigo: r.tipo_codigo,
    tipoNombre: r.tipo_nombre,
    estado: r.estado,
    solicitadaEn: r.solicitada_en,
    resueltaEn: r.resuelta_en,
    observaciones: r.notas_resolucion,
    descargable: r.estado === 'APROBADA',
  }));
}

/**
 * Lists available active request types.
 */
export async function getActiveRequestTypes(): Promise<RequestTypeItem[]> {
  const result = await query<{
    tipo_solicitud_id: string;
    codigo: string;
    nombre: string;
    descripcion: string | null;
  }>(
    `SELECT tipo_solicitud_id, codigo, nombre, descripcion
     FROM solicitudes.tipos_solicitud
     WHERE esta_activo = true
     ORDER BY nombre ASC`
  );

  return result.rows.map((r) => ({
    tipoSolicitudId: r.tipo_solicitud_id,
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion,
  }));
}

export const listStudentDocumentRequests = getStudentRequests;
export const getDocumentTypesCatalog = getActiveRequestTypes;

