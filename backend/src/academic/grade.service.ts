import { query } from '../config/database.js';
import { AppClientError } from '../middleware/errorHandler.js';

export interface PartialGradeItem {
  numeroParcial: number;
  valor: number | null;
  estado: 'PENDIENTE' | 'CAPTURADA';
}

export interface StudentGroupGradeRow {
  inscripcionId: string;
  alumnoId: string;
  matricula: string;
  nombreCompleto: string;
  numeroParcialesConfigurados: number;
  parciales: PartialGradeItem[];
  calificacionFinal: number | null;
  estadoCalificacion: 'PENDIENTE' | 'CAPTURADA';
  estadoAprobacion: 'APROBADA' | 'REPROBADA' | 'PENDIENTE';
}

export interface CalculateFinalGradeResult {
  calificacionFinal: number | null;
  estado: 'PENDIENTE' | 'CAPTURADA';
  promedioAritmetico: number | null;
}

/**
 * Calculates the integer final grade strictly according to the confirmed institutional rule:
 * 1. All configured partials must be captured; otherwise the final grade remains PENDIENTE (null).
 * 2. All partials carry equal weight (simple arithmetic mean).
 * 3. Half-up standard rounding produces an integer final grade without decimal parts.
 */
/**
 * Exact decimal half-up rounding using exponent shifting to eliminate IEEE-754 binary floating-point artifacts.
 * Matches PostgreSQL's round(numeric, integer) behavior exactly.
 */
export function roundToDecimals(value: number, decimals: number = 0): number {
  if (isNaN(value) || !isFinite(value)) return value;
  return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}

export function calculateFinalGrade(
  parciales: Array<number | { numeroParcial?: number; valor: number | null; estado?: string }>,
  numeroParcialesGrupo: number
): CalculateFinalGradeResult {
  if (!numeroParcialesGrupo || numeroParcialesGrupo < 1) {
    return { calificacionFinal: null, estado: 'PENDIENTE', promedioAritmetico: null };
  }

  // Normalize inputs to handle both raw number arrays [80, 90, 85] and full partial objects
  const normalized = parciales.map((p, idx) => {
    if (typeof p === 'number') {
      return { numeroParcial: idx + 1, valor: p, estado: 'CAPTURADA' };
    }
    return {
      numeroParcial: p.numeroParcial ?? (idx + 1),
      valor: p.valor,
      estado: p.estado || (p.valor !== null && p.valor !== undefined ? 'CAPTURADA' : 'PENDIENTE'),
    };
  });

  // Filter valid captured partials within the group's configured range
  const validCaptured = normalized.filter(
    (p) =>
      p.numeroParcial >= 1 &&
      p.numeroParcial <= numeroParcialesGrupo &&
      p.estado === 'CAPTURADA' &&
      p.valor !== null &&
      p.valor !== undefined &&
      !isNaN(Number(p.valor))
  );

  // If there are pending partials, the final grade cannot be concluded
  if (validCaptured.length < numeroParcialesGrupo) {
    return { calificacionFinal: null, estado: 'PENDIENTE', promedioAritmetico: null };
  }

  const sum = validCaptured.reduce((acc, p) => acc + Number(p.valor), 0);
  const mean = sum / numeroParcialesGrupo;
  // Institutional standard half-up rounding to integer using exact decimal shift
  const finalInteger = roundToDecimals(mean, 0);

  return {
    calificacionFinal: finalInteger,
    estado: 'CAPTURADA',
    promedioAritmetico: roundToDecimals(mean, 2),
  };
}

/**
 * Captures or updates a single partial grade for an enrollment.
 * Validates that the partial belongs to the group and recalculates the integer final grade.
 */
export async function capturePartialGrade(params: {
  inscripcionId: string;
  numeroParcial: number;
  valorCalificacion?: number;
  valor?: number;
  profesorUsuarioId?: string;
  evaluadorId?: string;
}): Promise<{
  inscripcionId: string;
  numeroParcial: number;
  valorCalificacion: number;
  calificacionFinal: number | null;
  estadoCalificacion: 'PENDIENTE' | 'CAPTURADA';
  estadoFinal: 'PENDIENTE' | 'CAPTURADA';
}> {
  const { inscripcionId, numeroParcial } = params;
  const valorCalificacion = params.valorCalificacion !== undefined ? params.valorCalificacion : params.valor!;
  const profesorUsuarioId = params.profesorUsuarioId || params.evaluadorId || 'sistema';

  if (
    typeof numeroParcial !== 'number' ||
    !Number.isInteger(numeroParcial) ||
    numeroParcial < 1 ||
    numeroParcial > 6
  ) {
    throw new AppClientError('El número de parcial debe ser un entero entre 1 y 6', 400);
  }

  if (
    typeof valorCalificacion !== 'number' ||
    isNaN(valorCalificacion) ||
    valorCalificacion < 0 ||
    valorCalificacion > 100
  ) {
    throw new AppClientError('La calificación debe ser un valor numérico entre 0 y 100', 400);
  }

  // Verify enrollment and group configuration
  const enrollmentInfo = await query<{
    inscripcion_id: string;
    grupo_id: string;
    numero_parciales: number;
    inscripcion_estado: string;
  }>(
    `SELECT i.inscripcion_id, i.grupo_id, g.numero_parciales, i.estado AS inscripcion_estado
     FROM academico.inscripciones i
     JOIN academico.grupos g ON g.grupo_id = i.grupo_id
     WHERE i.inscripcion_id = $1`,
    [inscripcionId]
  );

  if (enrollmentInfo.rows.length === 0) {
    throw new AppClientError('Inscripción no encontrada', 404);
  }

  const row = enrollmentInfo.rows[0];

  if (numeroParcial > row.numero_parciales) {
    throw new AppClientError(
      `El parcial ${numeroParcial} no pertenece al grupo: el grupo solo tiene ${row.numero_parciales} parcial(es) configurados`,
      400
    );
  }

  if (!['INSCRITO', 'COMPLETADA'].includes(row.inscripcion_estado)) {
    throw new AppClientError(
      `No se puede capturar calificación: la inscripción se encuentra en estado ${row.inscripcion_estado}`,
      400
    );
  }

  // 1. Upsert partial grade
  await query(
    `INSERT INTO academico.calificaciones_parciales (
       inscripcion_id,
       numero_parcial,
       valor_calificacion,
       estado,
       capturada_por_usuario_id,
       capturada_en,
       actualizada_por_usuario_id
     )
     VALUES ($1, $2, $3, 'CAPTURADA', $4, CURRENT_TIMESTAMP, $4)
     ON CONFLICT (inscripcion_id, numero_parcial) DO UPDATE
     SET valor_calificacion = EXCLUDED.valor_calificacion,
         estado = 'CAPTURADA',
         actualizada_por_usuario_id = EXCLUDED.actualizada_por_usuario_id,
         capturada_por_usuario_id = COALESCE(academico.calificaciones_parciales.capturada_por_usuario_id, EXCLUDED.capturada_por_usuario_id),
         capturada_en = COALESCE(academico.calificaciones_parciales.capturada_en, EXCLUDED.capturada_en),
         actualizado_en = CURRENT_TIMESTAMP`,
    [inscripcionId, numeroParcial, valorCalificacion, profesorUsuarioId]
  );

  // 2. Query all partial grades for this enrollment
  const allPartialsQuery = await query<{
    numero_parcial: number;
    valor_calificacion: string | number | null;
    estado: string;
  }>(
    `SELECT numero_parcial, valor_calificacion, estado
     FROM academico.calificaciones_parciales
     WHERE inscripcion_id = $1`,
    [inscripcionId]
  );

  const partialsList = allPartialsQuery.rows.map((p) => ({
    numeroParcial: p.numero_parcial,
    valor: p.valor_calificacion !== null ? parseFloat(String(p.valor_calificacion)) : null,
    estado: p.estado,
  }));

  // 3. Calculate final grade according to confirmed institutional policy
  const calculation = calculateFinalGrade(partialsList, row.numero_parciales);

  // 4. Synchronize authoritative final grade in academico.calificaciones
  if (calculation.estado === 'CAPTURADA' && calculation.calificacionFinal !== null) {
    await query(
      `INSERT INTO academico.calificaciones (
         inscripcion_id,
         valor_calificacion,
         estado,
         capturada_por_usuario_id,
         capturada_en,
         actualizada_por_usuario_id
       )
       VALUES ($1, $2, 'CAPTURADA', $3, CURRENT_TIMESTAMP, $3)
       ON CONFLICT (inscripcion_id) DO UPDATE
       SET valor_calificacion = EXCLUDED.valor_calificacion,
           estado = 'CAPTURADA',
           actualizada_por_usuario_id = EXCLUDED.actualizada_por_usuario_id,
           capturada_por_usuario_id = COALESCE(academico.calificaciones.capturada_por_usuario_id, EXCLUDED.capturada_por_usuario_id),
           capturada_en = COALESCE(academico.calificaciones.capturada_en, EXCLUDED.capturada_en),
           actualizado_en = CURRENT_TIMESTAMP`,
      [inscripcionId, calculation.calificacionFinal, profesorUsuarioId]
    );
  } else {
    // If pending, preserve pending final state
    await query(
      `INSERT INTO academico.calificaciones (
         inscripcion_id,
         valor_calificacion,
         estado,
         capturada_por_usuario_id,
         capturada_en
       )
       VALUES ($1, NULL, 'PENDIENTE', NULL, NULL)
       ON CONFLICT (inscripcion_id) DO UPDATE
       SET valor_calificacion = NULL,
           estado = 'PENDIENTE',
           actualizado_en = CURRENT_TIMESTAMP`,
      [inscripcionId]
    );
  }

  return {
    inscripcionId,
    numeroParcial,
    valorCalificacion,
    calificacionFinal: calculation.calificacionFinal,
    estadoCalificacion: calculation.estado,
    estadoFinal: calculation.estado,
  };
}

/**
 * Retrieves all grades and partials for students in a specific group.
 */
export async function getGroupGrades(grupoId: string): Promise<{
  grupoId: string;
  claveGrupo: string;
  numeroParciales: number;
  estudiantes: StudentGroupGradeRow[];
}> {
  const groupQuery = await query<{
    grupo_id: string;
    clave_grupo: string;
    numero_parciales: number;
  }>(
    `SELECT grupo_id, clave_grupo, numero_parciales
     FROM academico.grupos
     WHERE grupo_id = $1`,
    [grupoId]
  );

  if (groupQuery.rows.length === 0) {
    throw new AppClientError('Grupo no encontrado', 404);
  }

  const groupInfo = groupQuery.rows[0];

  const studentsSql = `
    SELECT 
      i.inscripcion_id,
      a.alumno_id,
      a.matricula,
      pe.nombre_completo,
      c.valor_calificacion AS calificacion_final,
      c.estado AS calificacion_estado
    FROM academico.inscripciones i
    JOIN academico.alumnos a ON a.alumno_id = i.alumno_id
    JOIN nucleo.personas pe ON pe.persona_id = a.persona_id
    LEFT JOIN academico.calificaciones c ON c.inscripcion_id = i.inscripcion_id
    WHERE i.grupo_id = $1
    ORDER BY a.matricula ASC
  `;

  const studentsRes = await query<{
    inscripcion_id: string;
    alumno_id: string;
    matricula: string;
    nombre_completo: string;
    calificacion_final: string | number | null;
    calificacion_estado: string | null;
  }>(studentsSql, [grupoId]);

  if (studentsRes.rows.length === 0) {
    return {
      grupoId: groupInfo.grupo_id,
      claveGrupo: groupInfo.clave_grupo,
      numeroParciales: groupInfo.numero_parciales,
      estudiantes: [],
    };
  }

  const enrollmentIds = studentsRes.rows.map((s) => s.inscripcion_id);

  const partialsRes = await query<{
    inscripcion_id: string;
    numero_parcial: number;
    valor_calificacion: string | number | null;
    estado: 'PENDIENTE' | 'CAPTURADA';
  }>(
    `SELECT inscripcion_id, numero_parcial, valor_calificacion, estado
     FROM academico.calificaciones_parciales
     WHERE inscripcion_id = ANY($1)
     ORDER BY numero_parcial ASC`,
    [enrollmentIds]
  );

  const partialsMap = new Map<string, PartialGradeItem[]>();
  for (const row of partialsRes.rows) {
    if (!partialsMap.has(row.inscripcion_id)) {
      partialsMap.set(row.inscripcion_id, []);
    }
    partialsMap.get(row.inscripcion_id)!.push({
      numeroParcial: row.numero_parcial,
      valor: row.valor_calificacion !== null ? parseFloat(String(row.valor_calificacion)) : null,
      estado: row.estado,
    });
  }

  const estudiantes: StudentGroupGradeRow[] = studentsRes.rows.map((s) => {
    const existingPartials = partialsMap.get(s.inscripcion_id) || [];
    // Build full partial array up to numero_parciales
    const fullPartials: PartialGradeItem[] = [];
    for (let i = 1; i <= groupInfo.numero_parciales; i++) {
      const found = existingPartials.find((p) => p.numeroParcial === i);
      fullPartials.push(
        found || {
          numeroParcial: i,
          valor: null,
          estado: 'PENDIENTE',
        }
      );
    }

    let finalNum: number | null = null;
    if (s.calificacion_final !== null && s.calificacion_final !== undefined) {
      const parsed = parseFloat(String(s.calificacion_final));
      if (!isNaN(parsed)) {
        finalNum = Math.round(parsed);
      }
    }

    const estadoCal: 'PENDIENTE' | 'CAPTURADA' =
      s.calificacion_estado === 'CAPTURADA' && finalNum !== null ? 'CAPTURADA' : 'PENDIENTE';

    let estadoAprobacion: 'APROBADA' | 'REPROBADA' | 'PENDIENTE' = 'PENDIENTE';
    if (estadoCal === 'CAPTURADA' && finalNum !== null) {
      estadoAprobacion = finalNum >= 70 ? 'APROBADA' : 'REPROBADA';
    }

    return {
      inscripcionId: s.inscripcion_id,
      alumnoId: s.alumno_id,
      matricula: s.matricula,
      nombreCompleto: s.nombre_completo,
      numeroParcialesConfigurados: groupInfo.numero_parciales,
      parciales: fullPartials,
      calificacionFinal: finalNum,
      estadoCalificacion: estadoCal,
      estadoAprobacion,
    };
  });

  return {
    grupoId: groupInfo.grupo_id,
    claveGrupo: groupInfo.clave_grupo,
    numeroParciales: groupInfo.numero_parciales,
    estudiantes,
  };
}

export const getGroupPartialGrades = getGroupGrades;

