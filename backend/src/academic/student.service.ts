import { query } from '../config/database.js';

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

/**
 * Retrieves all grades for the authenticated student identified strictly by their personaId.
 * Never accepts external student IDs or matricula from client inputs.
 */
export async function getStudentGradesByPersonaId(personaId: string): Promise<StudentGradesResponse> {
  const sql = `
    SELECT 
      a.matricula,
      pe.nombre_completo AS alumno_nombre,
      pa.periodo_academico_id,
      pa.codigo AS periodo_codigo,
      pa.nombre AS periodo_nombre,
      pa.fecha_inicio AS periodo_fecha_inicio,
      pa.fecha_fin AS periodo_fecha_fin,
      pa.estado AS periodo_estado,
      m.materia_id,
      m.codigo AS materia_codigo,
      m.nombre AS materia_nombre,
      m.creditos AS materia_creditos,
      g.grupo_id,
      g.clave_grupo,
      i.inscripcion_id,
      i.estado AS inscripcion_estado,
      cal.calificacion_id,
      cal.valor_calificacion,
      cal.estado AS calificacion_estado,
      cal.capturada_en,
      COALESCE(prof_persona.nombre_completo, 'Por asignar') AS profesor_nombre
    FROM academico.alumnos a
    JOIN nucleo.personas pe ON pe.persona_id = a.persona_id
    JOIN academico.inscripciones i ON i.alumno_id = a.alumno_id
    JOIN academico.grupos g ON g.grupo_id = i.grupo_id
    JOIN academico.carreras_materias cm ON cm.carrera_materia_id = g.carrera_materia_id
    JOIN academico.materias m ON m.materia_id = cm.materia_id
    JOIN academico.periodos_academicos pa ON pa.periodo_academico_id = g.periodo_academico_id
    LEFT JOIN academico.calificaciones cal ON cal.inscripcion_id = i.inscripcion_id
    LEFT JOIN academico.asignaciones_profesor_grupo apg 
      ON apg.grupo_id = g.grupo_id 
      AND apg.revocado_en IS NULL
    LEFT JOIN academico.profesores prof ON prof.profesor_id = apg.profesor_id
    LEFT JOIN nucleo.personas prof_persona ON prof_persona.persona_id = prof.persona_id
    WHERE a.persona_id = $1
    ORDER BY pa.fecha_inicio DESC, m.codigo ASC
  `;

  const result = await query<{
    matricula: string;
    alumno_nombre: string;
    periodo_academico_id: string;
    periodo_codigo: string;
    periodo_nombre: string;
    periodo_fecha_inicio: string;
    periodo_fecha_fin: string;
    periodo_estado: string;
    materia_id: string;
    materia_codigo: string;
    materia_nombre: string;
    materia_creditos: number;
    grupo_id: string;
    clave_grupo: string;
    inscripcion_id: string;
    inscripcion_estado: string;
    calificacion_id: string | null;
    valor_calificacion: string | number | null;
    calificacion_estado: string | null;
    capturada_en: string | null;
    profesor_nombre: string;
  }>(sql, [personaId]);

  if (result.rows.length === 0) {
    // If student has no enrollments yet, fetch student identity metadata if available
    const studentInfo = await query<{ matricula: string; nombre_completo: string }>(
      `SELECT a.matricula, pe.nombre_completo 
       FROM academico.alumnos a 
       JOIN nucleo.personas pe ON pe.persona_id = a.persona_id 
       WHERE a.persona_id = $1`,
      [personaId]
    );

    const matricula = studentInfo.rows[0]?.matricula ?? null;
    const alumnoNombre = studentInfo.rows[0]?.nombre_completo ?? null;

    return {
      matricula,
      alumnoNombre,
      periodos: [],
      resumenGeneral: {
        promedioGeneral: null,
        creditosTotalesAprobados: 0,
        totalMateriasCursadas: 0,
      },
    };
  }

  const matricula = result.rows[0].matricula;
  const alumnoNombre = result.rows[0].alumno_nombre;

  // Group by academic period
  const periodsMap = new Map<string, AcademicPeriodGrades>();

  let totalCalificacionesSum = 0;
  let totalCalificacionesCount = 0;
  let totalCreditosAprobados = 0;
  let totalMateriasCursadas = 0;

  for (const row of result.rows) {
    const periodId = row.periodo_academico_id;

    if (!periodsMap.has(periodId)) {
      periodsMap.set(periodId, {
        periodoId: periodId,
        codigo: row.periodo_codigo,
        nombre: row.periodo_nombre,
        esActivo: row.periodo_estado === 'ACTIVO',
        materias: [],
        resumen: {
          promedio: null,
          creditosAprobados: 0,
          totalMaterias: 0,
        },
      });
    }

    const period = periodsMap.get(periodId)!;
    const creditos = Number(row.materia_creditos) || 0;

    let calificacionFinal: number | null = null;
    if (row.valor_calificacion !== null && row.valor_calificacion !== undefined) {
      const parsed = parseFloat(String(row.valor_calificacion));
      if (!isNaN(parsed)) {
        calificacionFinal = parsed;
      }
    }

    const estadoCalificacion: 'PENDIENTE' | 'CAPTURADA' =
      row.calificacion_estado === 'CAPTURADA' && calificacionFinal !== null
        ? 'CAPTURADA'
        : 'PENDIENTE';

    // Business evaluation rule: passing grade is >= 70 on 0-100 scale, or >= 7.0 on 0-10 scale
    let estado: 'APROBADA' | 'REPROBADA' | 'PENDIENTE' = 'PENDIENTE';
    if (estadoCalificacion === 'CAPTURADA' && calificacionFinal !== null) {
      const isPassing = calificacionFinal >= 70 || (calificacionFinal >= 7.0 && calificacionFinal <= 10.0);
      estado = isPassing ? 'APROBADA' : 'REPROBADA';
    }

    const subjectItem: SubjectGradeItem = {
      inscripcionId: row.inscripcion_id,
      codigo: row.materia_codigo,
      asignatura: row.materia_nombre,
      creditos,
      profesor: row.profesor_nombre,
      claveGrupo: row.clave_grupo,
      estadoInscripcion: row.inscripcion_estado,
      calificacionFinal,
      estadoCalificacion,
      estado,
    };

    period.materias.push(subjectItem);
    totalMateriasCursadas++;

    if (estadoCalificacion === 'CAPTURADA' && calificacionFinal !== null) {
      totalCalificacionesSum += calificacionFinal;
      totalCalificacionesCount++;
    }

    if (estado === 'APROBADA') {
      period.resumen.creditosAprobados += creditos;
      totalCreditosAprobados += creditos;
    }
  }

  // Calculate averages per period
  for (const period of periodsMap.values()) {
    period.resumen.totalMaterias = period.materias.length;

    const capturedGrades = period.materias.filter(
      (m) => m.estadoCalificacion === 'CAPTURADA' && m.calificacionFinal !== null
    );

    if (capturedGrades.length > 0) {
      const sum = capturedGrades.reduce((acc, m) => acc + (m.calificacionFinal ?? 0), 0);
      period.resumen.promedio = Math.round((sum / capturedGrades.length) * 100) / 100;
    } else {
      period.resumen.promedio = null;
    }
  }

  const promedioGeneral =
    totalCalificacionesCount > 0
      ? Math.round((totalCalificacionesSum / totalCalificacionesCount) * 100) / 100
      : null;

  return {
    matricula,
    alumnoNombre,
    periodos: Array.from(periodsMap.values()),
    resumenGeneral: {
      promedioGeneral,
      creditosTotalesAprobados: totalCreditosAprobados,
      totalMateriasCursadas,
    },
  };
}
