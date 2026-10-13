import { query } from '../config/database.js';
import { AppClientError } from '../middleware/errorHandler.js';

export interface AcademicGroupItem {
  grupoId: string;
  id?: string;
  carreraMateriaId: string;
  materiaCodigo: string;
  materiaNombre: string;
  periodoAcademicoId: string;
  periodoCodigo: string;
  claveGrupo: string;
  clave?: string;
  cupoMaximo: number | null;
  numeroParciales: number;
  numero_parciales?: number;
  estado: 'PLANEADO' | 'ABIERTO' | 'CERRADO' | 'CANCELADO';
  creadoEn: string;
}

export interface CreateGroupInput {
  carreraMateriaId?: string;
  materiaId?: string;
  profesorId?: string;
  periodoAcademicoId: string;
  claveGrupo?: string;
  clave?: string;
  aula?: string;
  cupoMaximo?: number | null;
  numeroParciales: number;
}

export interface UpdateGroupInput {
  grupoId: string;
  cupoMaximo?: number | null;
  numeroParciales?: number;
}

/**
 * Creates a new academic group ensuring that numero_parciales is strictly within [1, 6].
 * Persists the configuration to PostgreSQL table academico.grupos.
 */
export async function createAcademicGroup(input: CreateGroupInput): Promise<AcademicGroupItem> {
  const { periodoAcademicoId, cupoMaximo, numeroParciales } = input;
  const claveGrupo = (input.claveGrupo || input.clave || '').trim();
  const carreraMateriaId = input.carreraMateriaId || input.materiaId || 'cm-default';

  if (!claveGrupo) {
    throw new AppClientError('La clave de grupo es obligatoria y no puede estar vacía', 400);
  }

  if (
    typeof numeroParciales !== 'number' ||
    !Number.isInteger(numeroParciales) ||
    numeroParciales < 1 ||
    numeroParciales > 6
  ) {
    throw new AppClientError(
      'El número de parciales es obligatorio y debe ser un entero positivo entre 1 y 6',
      400
    );
  }

  if (cupoMaximo !== undefined && cupoMaximo !== null) {
    if (!Number.isInteger(cupoMaximo) || cupoMaximo <= 0) {
      throw new AppClientError('El cupo máximo debe ser un entero positivo', 400);
    }
  }

  const sql = `
    INSERT INTO academico.grupos (
      carrera_materia_id,
      periodo_academico_id,
      clave_grupo,
      cupo_maximo,
      numero_parciales,
      estado
    )
    VALUES ($1, $2, $3, $4, $5, 'ABIERTO')
    RETURNING 
      grupo_id,
      carrera_materia_id,
      periodo_academico_id,
      clave_grupo,
      cupo_maximo,
      numero_parciales,
      estado,
      creado_en
  `;

  const result = await query<{
    grupo_id: string;
    carrera_materia_id: string;
    periodo_academico_id: string;
    clave_grupo: string;
    cupo_maximo: number | null;
    numero_parciales: number;
    estado: 'PLANEADO' | 'ABIERTO' | 'CERRADO' | 'CANCELADO';
    creado_en: string;
  }>(sql, [
    carreraMateriaId,
    periodoAcademicoId,
    claveGrupo.trim(),
    cupoMaximo ?? null,
    numeroParciales,
  ]);

  const row = result.rows[0];

  return {
    grupoId: row.grupo_id,
    id: row.grupo_id,
    carreraMateriaId: row.carrera_materia_id,
    materiaCodigo: '',
    materiaNombre: '',
    periodoAcademicoId: row.periodo_academico_id,
    periodoCodigo: '',
    claveGrupo: row.clave_grupo,
    clave: row.clave_grupo,
    cupoMaximo: row.cupo_maximo,
    numeroParciales: row.numero_parciales,
    numero_parciales: row.numero_parciales,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

/**
 * Updates an academic group's configuration.
 * Prevents reducing numero_parciales if existing grades are already recorded for higher partials.
 */
export async function updateAcademicGroup(
  grupoIdOrInput: string | UpdateGroupInput,
  maybeInput?: Partial<UpdateGroupInput>
): Promise<AcademicGroupItem> {
  const input: UpdateGroupInput =
    typeof grupoIdOrInput === 'string'
      ? { grupoId: grupoIdOrInput, ...maybeInput }
      : grupoIdOrInput;

  const { grupoId, cupoMaximo, numeroParciales } = input;

  const currentGroupQuery = await query<{
    grupo_id: string;
    carrera_materia_id: string;
    periodo_academico_id: string;
    clave_grupo: string;
    cupo_maximo: number | null;
    numero_parciales: number;
    estado: 'PLANEADO' | 'ABIERTO' | 'CERRADO' | 'CANCELADO';
    creado_en: string;
  }>(
    `SELECT grupo_id, carrera_materia_id, periodo_academico_id, clave_grupo, cupo_maximo, numero_parciales, estado, creado_en
     FROM academico.grupos
     WHERE grupo_id = $1`,
    [grupoId]
  );

  if (currentGroupQuery.rows.length === 0) {
    throw new AppClientError('Grupo no encontrado', 404);
  }

  const current = currentGroupQuery.rows[0];

  if (numeroParciales !== undefined) {
    if (
      typeof numeroParciales !== 'number' ||
      !Number.isInteger(numeroParciales) ||
      numeroParciales < 1 ||
      numeroParciales > 6
    ) {
      throw new AppClientError(
        'El número de parciales debe ser un número entero entre 1 y 6',
        400
      );
    }

    if (numeroParciales < current.numero_parciales) {
      // Check if existing grades are recorded for higher partials
      const gradesCheck = await query<{ max_parcial: number | null }>(
        `SELECT MAX(cp.numero_parcial) AS max_parcial
         FROM academico.inscripciones i
         JOIN academico.calificaciones_parciales cp ON cp.inscripcion_id = i.inscripcion_id
         WHERE i.grupo_id = $1 AND cp.estado = 'CAPTURADA'`,
        [grupoId]
      );

      const maxParcial = gradesCheck.rows[0]?.max_parcial ?? 0;
      if (maxParcial > numeroParciales) {
        throw new AppClientError(
          `No se puede reducir la configuración a ${numeroParciales} parciales: el grupo ya tiene calificaciones registradas en el parcial ${maxParcial}`,
          400
        );
      }
    }
  }

  const updatedParciales = numeroParciales ?? current.numero_parciales;
  const updatedCupo = cupoMaximo !== undefined ? cupoMaximo : current.cupo_maximo;

  const updateResult = await query<{
    grupo_id: string;
    carrera_materia_id: string;
    periodo_academico_id: string;
    clave_grupo: string;
    cupo_maximo: number | null;
    numero_parciales: number;
    estado: 'PLANEADO' | 'ABIERTO' | 'CERRADO' | 'CANCELADO';
    creado_en: string;
  }>(
    `UPDATE academico.grupos
     SET cupo_maximo = $1, numero_parciales = $2, actualizado_en = CURRENT_TIMESTAMP
     WHERE grupo_id = $3
     RETURNING grupo_id, carrera_materia_id, periodo_academico_id, clave_grupo, cupo_maximo, numero_parciales, estado, creado_en`,
    [updatedCupo, updatedParciales, grupoId]
  );

  const row = updateResult.rows[0];

  return {
    grupoId: row.grupo_id,
    id: row.grupo_id,
    carreraMateriaId: row.carrera_materia_id,
    materiaCodigo: '',
    materiaNombre: '',
    periodoAcademicoId: row.periodo_academico_id,
    periodoCodigo: '',
    claveGrupo: row.clave_grupo,
    clave: row.clave_grupo,
    cupoMaximo: row.cupo_maximo,
    numeroParciales: row.numero_parciales,
    numero_parciales: row.numero_parciales,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

/**
 * Retrieves a single academic group with its configured numero_parciales.
 */
export async function getAcademicGroupById(grupoId: string): Promise<AcademicGroupItem> {
  const sql = `
    SELECT 
      g.grupo_id,
      g.carrera_materia_id,
      m.codigo AS materia_codigo,
      m.nombre AS materia_nombre,
      g.periodo_academico_id,
      pa.codigo AS periodo_codigo,
      g.clave_grupo,
      g.cupo_maximo,
      g.numero_parciales,
      g.estado,
      g.creado_en
    FROM academico.grupos g
    JOIN academico.carreras_materias cm ON cm.carrera_materia_id = g.carrera_materia_id
    JOIN academico.materias m ON m.materia_id = cm.materia_id
    JOIN academico.periodos_academicos pa ON pa.periodo_academico_id = g.periodo_academico_id
    WHERE g.grupo_id = $1
  `;

  const result = await query<{
    grupo_id: string;
    carrera_materia_id: string;
    materia_codigo: string;
    materia_nombre: string;
    periodo_academico_id: string;
    periodo_codigo: string;
    clave_grupo: string;
    cupo_maximo: number | null;
    numero_parciales: number;
    estado: 'PLANEADO' | 'ABIERTO' | 'CERRADO' | 'CANCELADO';
    creado_en: string;
  }>(sql, [grupoId]);

  if (result.rows.length === 0) {
    throw new AppClientError('Grupo no encontrado', 404);
  }

  const row = result.rows[0];

  return {
    grupoId: row.grupo_id,
    carreraMateriaId: row.carrera_materia_id,
    materiaCodigo: row.materia_codigo,
    materiaNombre: row.materia_nombre,
    periodoAcademicoId: row.periodo_academico_id,
    periodoCodigo: row.periodo_codigo,
    claveGrupo: row.clave_grupo,
    cupoMaximo: row.cupo_maximo,
    numeroParciales: row.numero_parciales,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

export const createGroup = createAcademicGroup;
export const updateGroup = updateAcademicGroup;
export const getGroupById = getAcademicGroupById;

