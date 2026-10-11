import { pool, closePool } from '../backend/src/config/database.js';
import { hashPassword } from '../backend/src/auth/argon2.service.js';
import type { PoolClient } from 'pg';

export class SeedSecurityError extends Error {
  public readonly isSeedSecurityError = true;
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SeedSecurityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const ALLOWED_DEV_HOSTS: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'db',
  'postgres',
] as const;

export const ALLOWED_DEV_DATABASES: readonly string[] = [
  'securecampus',
  'securecampus_dev',
  'securecampus_test',
] as const;

export interface ValidatedSeedEnvConfig {
  nodeEnv: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
}

export interface VerifiedDatabaseDestination {
  liveDatabaseName: string;
  liveCurrentUser: string;
  serverIp: string | null;
}

export interface SeedDevUsersResult {
  success: boolean;
  seededCount: number;
  identities: string[];
}

/**
 * Redacts database URLs, credentials, and connection strings from error logs.
 */
export function sanitizeConnectionUrl(raw: string): string {
  return raw.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]');
}

/**
 * Checks whether an IPv4/IPv6 string is a loopback or private network address (RFC 1918 / RFC 4193).
 */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/, '').trim();

  // Loopback
  if (normalized === '127.0.0.1' || normalized === '::1') {
    return true;
  }

  // IPv4 Private ranges:
  // 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }
  // 172.16.0.0/12 (Docker bridge default network is typically 172.17.x.x - 172.31.x.x)
  const match172 = normalized.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  // 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }

  // IPv6 ULA (fc00::/7) or link-local (fe80::/10)
  if (/^(fc|fd|fe80)/i.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Layer 1: Validates that execution environment signals, authorization flags,
 * and database connection parameters satisfy development seeding invariants.
 */
export function validateSeedEnvironment(
  envSource: Record<string, string | undefined> = process.env
): ValidatedSeedEnvConfig {
  const nodeEnv = envSource.NODE_ENV;

  // 1. NODE_ENV must be defined and strictly non-production
  if (!nodeEnv || typeof nodeEnv !== 'string' || nodeEnv.trim() === '') {
    throw new SeedSecurityError(
      'Ejecución bloqueada: NODE_ENV no está definido. El script de semillas exige un entorno explícito.',
      'MISSING_NODE_ENV'
    );
  }

  const normalizedNodeEnv = nodeEnv.trim().toLowerCase();

  if (normalizedNodeEnv === 'production') {
    throw new SeedSecurityError(
      'Ejecución prohibida: El script de semillas de desarrollo tiene prohibido ejecutarse cuando NODE_ENV=production.',
      'PRODUCTION_ENVIRONMENT'
    );
  }

  if (normalizedNodeEnv !== 'development' && normalizedNodeEnv !== 'test') {
    throw new SeedSecurityError(
      `Ejecución bloqueada: Entorno no autorizado '${normalizedNodeEnv}'. Las semillas solo se admiten en 'development' o 'test'.`,
      'UNAUTHORIZED_NODE_ENV'
    );
  }

  // 2. Explicit Affirmative Authorization Flag (ALLOW_DEV_SEEDS === 'true')
  const allowSeeds = envSource.ALLOW_DEV_SEEDS;
  if (!allowSeeds || allowSeeds.trim() !== 'true') {
    throw new SeedSecurityError(
      'Ejecución bloqueada: Falta la autorización explícita ALLOW_DEV_SEEDS=true. Las semillas requieren confirmación afirmativa para evitar ejecuciones accidentales.',
      'MISSING_EXPLICIT_AUTHORIZATION'
    );
  }

  // 3. DATABASE_URL structure, protocol and destination analysis
  const rawDbUrl = envSource.DATABASE_URL;
  if (!rawDbUrl || typeof rawDbUrl !== 'string' || rawDbUrl.trim() === '') {
    throw new SeedSecurityError(
      'Ejecución bloqueada: DATABASE_URL no está configurada.',
      'MISSING_DATABASE_URL'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawDbUrl.trim());
  } catch {
    throw new SeedSecurityError(
      'Ejecución bloqueada: DATABASE_URL no es una URL de conexión válida.',
      'INVALID_DATABASE_URL'
    );
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new SeedSecurityError(
      `Ejecución bloqueada: Protocolo de base de datos no compatible '${parsed.protocol}'. Se requiere postgresql.`,
      'UNAUTHORIZED_PROTOCOL'
    );
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!ALLOWED_DEV_HOSTS.includes(host) && !ALLOWED_DEV_HOSTS.includes(`[${host}]`)) {
    throw new SeedSecurityError(
      `Ejecución bloqueada: El host '${host}' no está en la lista blanca de hosts de desarrollo local autorizados.`,
      'NON_LOCAL_HOST'
    );
  }

  const dbName = parsed.pathname.replace(/^\//, '').trim();
  if (!ALLOWED_DEV_DATABASES.includes(dbName)) {
    throw new SeedSecurityError(
      `Ejecución bloqueada: La base de datos '${dbName}' no coincide con ningún catálogo autorizado para datos de desarrollo.`,
      'UNAUTHORIZED_DATABASE_NAME'
    );
  }

  const username = parsed.username || '';
  if (username !== 'securecampus_app') {
    throw new SeedSecurityError(
      `Ejecución bloqueada: Las semillas deben conectarse exclusivamente con el rol 'securecampus_app'. Se detectó '${username}'.`,
      'UNAUTHORIZED_DB_USER'
    );
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;

  return {
    nodeEnv: normalizedNodeEnv,
    host,
    port,
    databaseName: dbName,
    username,
  };
}

/**
 * Layer 2: Live Destination Probe on Connected PostgreSQL Client.
 * Queries PostgreSQL runtime system catalog to confirm destination properties before any write.
 */
export async function verifyDatabaseDestination(
  client: Pick<PoolClient, 'query'>,
  expected: ValidatedSeedEnvConfig
): Promise<VerifiedDatabaseDestination> {
  let probeRes;
  try {
    probeRes = await client.query<{
      db_name: string;
      db_user: string;
      server_ip: string | null;
    }>(
      `SELECT 
         current_database() AS db_name,
         current_user AS db_user,
         inet_server_addr()::text AS server_ip`
    );
  } catch (err) {
    const msg = err instanceof Error ? sanitizeConnectionUrl(err.message) : 'Fallo de consulta';
    throw new SeedSecurityError(
      `Ejecución bloqueada: Error al sondear el destino de la base de datos: ${msg}`,
      'PROBE_QUERY_ERROR'
    );
  }

  if (!probeRes.rows || probeRes.rows.length === 0) {
    throw new SeedSecurityError(
      'Ejecución bloqueada: La sonda de base de datos no devolvió ninguna fila de metadatos.',
      'EMPTY_PROBE_RESPONSE'
    );
  }

  const live = probeRes.rows[0];

  // 1. Verify Database Name matches
  if (live.db_name !== expected.databaseName) {
    throw new SeedSecurityError(
      `Ejecución bloqueada: Discrepancia de base de datos. Se esperaba '${expected.databaseName}', pero el servidor reportó '${live.db_name}'.`,
      'DATABASE_NAME_MISMATCH'
    );
  }

  // 2. Verify Database User matches
  if (live.db_user !== expected.username) {
    throw new SeedSecurityError(
      `Ejecución bloqueada: Discrepancia de usuario. Se esperaba '${expected.username}', pero el servidor reportó '${live.db_user}'.`,
      'DATABASE_USER_MISMATCH'
    );
  }

  // 3. Verify Server IP is local or private network (not a remote public host)
  if (live.server_ip) {
    if (!isPrivateOrLoopbackIp(live.server_ip)) {
      throw new SeedSecurityError(
        'Ejecución bloqueada: El servidor de base de datos está alojado en una dirección IP pública no autorizada para desarrollo.',
        'PUBLIC_IP_DESTINATION'
      );
    }
  }

  return {
    liveDatabaseName: live.db_name,
    liveCurrentUser: live.db_user,
    serverIp: live.server_ip,
  };
}

/**
 * Main seed execution routine wrapped in full validation and atomic transaction.
 */
export async function seedDevUsers(options?: {
  client?: Pick<PoolClient, 'query' | 'release'>;
  env?: Record<string, string | undefined>;
  skipClosePool?: boolean;
}): Promise<SeedDevUsersResult> {
  const envSource = options?.env ?? process.env;

  // 1. Validar entorno de configuración (Layer 1)
  const validatedConfig = validateSeedEnvironment(envSource);

  // 2. Adquirir cliente de base de datos
  const client = options?.client ?? (await pool.connect());
  let inTransaction = false;

  try {
    // 3. Verificar destino en vivo (Layer 2)
    await verifyDatabaseDestination(client, validatedConfig);

    console.log('\n--- Sembrando Usuarios de Prueba para Desarrollo Local ---');
    console.log(`Destino verificado: ${validatedConfig.databaseName} en ${validatedConfig.host}`);

    // 4. Iniciar transacción atómica de escritura
    await client.query('BEGIN');
    inTransaction = true;

    // Paso 1: Asegurar carrera inicial ISC
    const carreraRes = await client.query<{ carrera_id: string }>(
      `INSERT INTO nucleo.carreras (codigo, nombre, descripcion, estado)
       VALUES ('ISC', 'Ingeniería en Sistemas Computacionales', 'Carrera de Sistemas', 'ACTIVA')
       ON CONFLICT (codigo) DO UPDATE
       SET nombre = EXCLUDED.nombre
       RETURNING carrera_id`
    );
    const carreraId = carreraRes.rows[0].carrera_id;

    // Obtener roles del sistema
    const rolesRes = await client.query<{ rol_id: string; codigo: string }>(
      `SELECT rol_id, codigo FROM seguridad.roles WHERE codigo IN ('JEFE_CARRERA', 'PROFESOR', 'ALUMNO')`
    );
    const rolesMap = new Map(rolesRes.rows.map((r) => [r.codigo, r.rol_id]));

    // Paso 2: JEFE DE CARRERA: a.martinez@securecampus.edu
    console.log('Sembrando Jefe de Carrera (a.martinez@securecampus.edu)...');
    const passJefe = await hashPassword('JefeSecure2026!');
    const jefePersona = await client.query<{ persona_id: string }>(
      `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
       VALUES ('Alejandro', 'Martínez', 'a.martinez@securecampus.edu')
       ON CONFLICT (lower(correo)) DO UPDATE SET nombres = EXCLUDED.nombres
       RETURNING persona_id`
    );
    const jefeUsuario = await client.query<{ usuario_id: string }>(
      `INSERT INTO seguridad.usuarios (persona_id, sujeto_identidad, estado)
       VALUES ($1, NULL, 'ACTIVO')
       ON CONFLICT (persona_id) DO UPDATE SET estado = 'ACTIVO'
       RETURNING usuario_id`,
      [jefePersona.rows[0].persona_id]
    );
    await client.query(
      `INSERT INTO seguridad.credenciales (usuario_id, password_hash, estado)
       VALUES ($1, $2, 'ACTIVO')
       ON CONFLICT (usuario_id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [jefeUsuario.rows[0].usuario_id, passJefe]
    );
    const rolJefeId = rolesMap.get('JEFE_CARRERA');
    if (rolJefeId) {
      await client.query(
        `INSERT INTO seguridad.usuarios_roles (usuario_id, rol_id, carrera_id, asignado_por_usuario_id)
         VALUES ($1, $2, $3, NULL)
         ON CONFLICT DO NOTHING`,
        [jefeUsuario.rows[0].usuario_id, rolJefeId, carreraId]
      );
    }

    // Paso 3: PROFESOR: a.mendez@securecampus.edu / DOC-8821
    console.log('Sembrando Profesor (a.mendez@securecampus.edu / DOC-8821)...');
    const passProf = await hashPassword('ProfesorSecure2026!');
    const profPersona = await client.query<{ persona_id: string }>(
      `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
       VALUES ('Antonio', 'Méndez', 'a.mendez@securecampus.edu')
       ON CONFLICT (lower(correo)) DO UPDATE SET nombres = EXCLUDED.nombres
       RETURNING persona_id`
    );
    const profPersonaId = profPersona.rows[0].persona_id;
    await client.query(
      `INSERT INTO academico.profesores (persona_id, numero_empleado, estado)
       VALUES ($1, 'DOC-8821', 'ACTIVO')
       ON CONFLICT (persona_id) DO UPDATE SET numero_empleado = EXCLUDED.numero_empleado`,
      [profPersonaId]
    );
    const profUsuario = await client.query<{ usuario_id: string }>(
      `INSERT INTO seguridad.usuarios (persona_id, sujeto_identidad, estado)
       VALUES ($1, NULL, 'ACTIVO')
       ON CONFLICT (persona_id) DO UPDATE SET estado = 'ACTIVO'
       RETURNING usuario_id`,
      [profPersonaId]
    );
    await client.query(
      `INSERT INTO seguridad.credenciales (usuario_id, password_hash, estado)
       VALUES ($1, $2, 'ACTIVO')
       ON CONFLICT (usuario_id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [profUsuario.rows[0].usuario_id, passProf]
    );
    const rolProfId = rolesMap.get('PROFESOR');
    if (rolProfId) {
      await client.query(
        `INSERT INTO seguridad.usuarios_roles (usuario_id, rol_id, carrera_id, asignado_por_usuario_id)
         VALUES ($1, $2, NULL, NULL)
         ON CONFLICT DO NOTHING`,
        [profUsuario.rows[0].usuario_id, rolProfId]
      );
    }

    // Paso 4: ESTUDIANTE: v.morales@securecampus.edu / 202301042
    console.log('Sembrando Estudiante (v.morales@securecampus.edu / 202301042)...');
    const passEst = await hashPassword('EstudianteSecure2026!');
    const estPersona = await client.query<{ persona_id: string }>(
      `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
       VALUES ('Valentina', 'Morales', 'v.morales@securecampus.edu')
       ON CONFLICT (lower(correo)) DO UPDATE SET nombres = EXCLUDED.nombres
       RETURNING persona_id`
    );
    const estPersonaId = estPersona.rows[0].persona_id;
    await client.query(
      `INSERT INTO academico.alumnos (persona_id, matricula, estado)
       VALUES ($1, '202301042', 'ACTIVO')
       ON CONFLICT (persona_id) DO UPDATE SET matricula = EXCLUDED.matricula`,
      [estPersonaId]
    );
    const estUsuario = await client.query<{ usuario_id: string }>(
      `INSERT INTO seguridad.usuarios (persona_id, sujeto_identidad, estado)
       VALUES ($1, NULL, 'ACTIVO')
       ON CONFLICT (persona_id) DO UPDATE SET estado = 'ACTIVO'
       RETURNING usuario_id`,
      [estPersonaId]
    );
    await client.query(
      `INSERT INTO seguridad.credenciales (usuario_id, password_hash, estado)
       VALUES ($1, $2, 'ACTIVO')
       ON CONFLICT (usuario_id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [estUsuario.rows[0].usuario_id, passEst]
    );
    const rolAluId = rolesMap.get('ALUMNO');
    if (rolAluId) {
      await client.query(
        `INSERT INTO seguridad.usuarios_roles (usuario_id, rol_id, carrera_id, asignado_por_usuario_id)
         VALUES ($1, $2, NULL, NULL)
         ON CONFLICT DO NOTHING`,
        [estUsuario.rows[0].usuario_id, rolAluId]
      );
    }

    // Paso 5: Escenario Académico de Desarrollo (Materias, Periodos, Grupos, Calificaciones)
    console.log('Sembrando Catálogo Académico e Inscripciones de Prueba...');

    // 5.1 Adscripción de Alumno y Profesor a la carrera ISC
    const aluRes = await client.query<{ alumno_id: string }>(
      `SELECT alumno_id FROM academico.alumnos WHERE persona_id = $1`,
      [estPersonaId]
    );
    const alumnoId = aluRes.rows[0]?.alumno_id;
    if (alumnoId) {
      await client.query(
        `INSERT INTO academico.alumnos_carreras (alumno_id, carrera_id, fecha_inicio, fecha_fin)
         VALUES ($1, $2, '2023-08-01', NULL)
         ON CONFLICT DO NOTHING`,
        [alumnoId, carreraId]
      );
    }

    const profRes = await client.query<{ profesor_id: string }>(
      `SELECT profesor_id FROM academico.profesores WHERE persona_id = $1`,
      [profPersonaId]
    );
    const profesorId = profRes.rows[0]?.profesor_id;
    if (profesorId) {
      await client.query(
        `INSERT INTO academico.profesores_carreras (profesor_id, carrera_id, fecha_inicio, fecha_fin)
         VALUES ($1, $2, '2020-01-01', NULL)
         ON CONFLICT DO NOTHING`,
        [profesorId, carreraId]
      );
    }

    // 5.2 Periodos Académicos (sin traslape temporal)
    const perPrevioRes = await client.query<{ periodo_academico_id: string }>(
      `INSERT INTO academico.periodos_academicos (codigo, nombre, fecha_inicio, fecha_fin, estado)
       VALUES ('2026-A', 'Periodo 2026-A (Semestre previo)', '2026-01-15', '2026-06-30', 'CERRADO')
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING periodo_academico_id`
    );
    const periodoPrevioId = perPrevioRes.rows[0]?.periodo_academico_id;

    const perActivoRes = await client.query<{ periodo_academico_id: string }>(
      `INSERT INTO academico.periodos_academicos (codigo, nombre, fecha_inicio, fecha_fin, estado)
       VALUES ('2026-B', 'Periodo 2026-B (Semestre en curso)', '2026-08-01', '2026-12-15', 'ACTIVO')
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING periodo_academico_id`
    );
    const periodoActivoId = perActivoRes.rows[0]?.periodo_academico_id;

    // 5.3 Materias del Plan ISC
    const mat1Res = await client.query<{ materia_id: string }>(
      `INSERT INTO academico.materias (codigo, nombre, creditos, estado)
       VALUES ('CS-601', 'Seguridad en Aplicaciones Web y DevSecOps', 8, 'ACTIVA')
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING materia_id`
    );
    const mat1Id = mat1Res.rows[0]?.materia_id;

    const mat2Res = await client.query<{ materia_id: string }>(
      `INSERT INTO academico.materias (codigo, nombre, creditos, estado)
       VALUES ('CS-602', 'Criptografía Aplicada y PKI', 8, 'ACTIVA')
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING materia_id`
    );
    const mat2Id = mat2Res.rows[0]?.materia_id;

    const mat3Res = await client.query<{ materia_id: string }>(
      `INSERT INTO academico.materias (codigo, nombre, creditos, estado)
       VALUES ('CS-603', 'Análisis Forense y Respuesta a Incidentes', 8, 'ACTIVA')
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING materia_id`
    );
    const mat3Id = mat3Res.rows[0]?.materia_id;

    // 5.4 Asociar Materias a Carrera ISC
    const cmIds: Record<string, string> = {};
    for (const [mKey, mId] of [['CS-601', mat1Id], ['CS-602', mat2Id], ['CS-603', mat3Id]] as const) {
      if (mId) {
        const cmRes = await client.query<{ carrera_materia_id: string }>(
          `INSERT INTO academico.carreras_materias (carrera_id, materia_id, semestre, es_obligatoria)
           VALUES ($1, $2, 6, true)
           ON CONFLICT (carrera_id, materia_id) DO UPDATE SET semestre = EXCLUDED.semestre
           RETURNING carrera_materia_id`,
          [carreraId, mId]
        );
        if (cmRes.rows[0]?.carrera_materia_id) {
          cmIds[mKey] = cmRes.rows[0].carrera_materia_id;
        }
      }
    }

    // 5.5 Grupos, Asignación Docente, Inscripciones y Calificaciones
    if (periodoPrevioId && cmIds['CS-602'] && alumnoId && profesorId) {
      const gPrevio = await client.query<{ grupo_id: string }>(
        `INSERT INTO academico.grupos (carrera_materia_id, periodo_academico_id, clave_grupo, cupo_maximo, estado)
         VALUES ($1, $2, 'G-602A', 30, 'ABIERTO')
         ON CONFLICT (carrera_materia_id, periodo_academico_id, clave_grupo) DO UPDATE SET estado = 'ABIERTO'
         RETURNING grupo_id`,
        [cmIds['CS-602'], periodoPrevioId]
      );
      const gPrevioId = gPrevio.rows[0]?.grupo_id;
      if (gPrevioId) {
        await client.query(
          `INSERT INTO academico.asignaciones_profesor_grupo (grupo_id, profesor_id, rol)
           VALUES ($1, $2, 'TITULAR')
           ON CONFLICT DO NOTHING`,
          [gPrevioId, profesorId]
        );
        const insPrev = await client.query<{ inscripcion_id: string }>(
          `INSERT INTO academico.inscripciones (alumno_id, grupo_id, estado, completado_en)
           VALUES ($1, $2, 'COMPLETADA', '2026-06-30')
           ON CONFLICT DO NOTHING
           RETURNING inscripcion_id`,
          [alumnoId, gPrevioId]
        );
        const insPrevId = insPrev.rows[0]?.inscripcion_id;
        if (insPrevId) {
          await client.query(
            `INSERT INTO academico.calificaciones (inscripcion_id, valor_calificacion, estado, capturada_por_usuario_id, capturada_en)
             VALUES ($1, 92.00, 'CAPTURADA', $2, '2026-06-28')
             ON CONFLICT (inscripcion_id) DO UPDATE SET valor_calificacion = EXCLUDED.valor_calificacion`,
            [insPrevId, profUsuario.rows[0].usuario_id]
          );
        }
      }
    }

    if (periodoActivoId && alumnoId && profesorId) {
      // CS-601 con calificación 95.00
      if (cmIds['CS-601']) {
        const g1 = await client.query<{ grupo_id: string }>(
          `INSERT INTO academico.grupos (carrera_materia_id, periodo_academico_id, clave_grupo, cupo_maximo, estado)
           VALUES ($1, $2, 'G-601A', 30, 'ABIERTO')
           ON CONFLICT (carrera_materia_id, periodo_academico_id, clave_grupo) DO UPDATE SET estado = 'ABIERTO'
           RETURNING grupo_id`,
          [cmIds['CS-601'], periodoActivoId]
        );
        const g1Id = g1.rows[0]?.grupo_id;
        if (g1Id) {
          await client.query(
            `INSERT INTO academico.asignaciones_profesor_grupo (grupo_id, profesor_id, rol)
             VALUES ($1, $2, 'TITULAR')
             ON CONFLICT DO NOTHING`,
            [g1Id, profesorId]
          );
          const ins1 = await client.query<{ inscripcion_id: string }>(
            `INSERT INTO academico.inscripciones (alumno_id, grupo_id, estado)
             VALUES ($1, $2, 'INSCRITO')
             ON CONFLICT DO NOTHING
             RETURNING inscripcion_id`,
            [alumnoId, g1Id]
          );
          const ins1Id = ins1.rows[0]?.inscripcion_id;
          if (ins1Id) {
            await client.query(
              `INSERT INTO academico.calificaciones (inscripcion_id, valor_calificacion, estado, capturada_por_usuario_id, capturada_en)
               VALUES ($1, 95.00, 'CAPTURADA', $2, '2026-09-20')
               ON CONFLICT (inscripcion_id) DO UPDATE SET valor_calificacion = EXCLUDED.valor_calificacion`,
              [ins1Id, profUsuario.rows[0].usuario_id]
            );
          }
        }
      }

      // CS-603 con calificación pendiente
      if (cmIds['CS-603']) {
        const g3 = await client.query<{ grupo_id: string }>(
          `INSERT INTO academico.grupos (carrera_materia_id, periodo_academico_id, clave_grupo, cupo_maximo, estado)
           VALUES ($1, $2, 'G-603A', 30, 'ABIERTO')
           ON CONFLICT (carrera_materia_id, periodo_academico_id, clave_grupo) DO UPDATE SET estado = 'ABIERTO'
           RETURNING grupo_id`,
          [cmIds['CS-603'], periodoActivoId]
        );
        const g3Id = g3.rows[0]?.grupo_id;
        if (g3Id) {
          await client.query(
            `INSERT INTO academico.asignaciones_profesor_grupo (grupo_id, profesor_id, rol)
             VALUES ($1, $2, 'TITULAR')
             ON CONFLICT DO NOTHING`,
            [g3Id, profesorId]
          );
          const ins3 = await client.query<{ inscripcion_id: string }>(
            `INSERT INTO academico.inscripciones (alumno_id, grupo_id, estado)
             VALUES ($1, $2, 'INSCRITO')
             ON CONFLICT DO NOTHING
             RETURNING inscripcion_id`,
            [alumnoId, g3Id]
          );
          const ins3Id = ins3.rows[0]?.inscripcion_id;
          if (ins3Id) {
            await client.query(
              `INSERT INTO academico.calificaciones (inscripcion_id, valor_calificacion, estado, capturada_por_usuario_id, capturada_en)
               VALUES ($1, NULL, 'PENDIENTE', NULL, NULL)
               ON CONFLICT (inscripcion_id) DO UPDATE SET estado = 'PENDIENTE'`,
              [ins3Id]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    inTransaction = false;
    console.log('\nÉXITO: Usuarios institucionales de desarrollo sembrados correctamente.');

    return {
      success: true,
      seededCount: 3,
      identities: [
        'a.martinez@securecampus.edu',
        'a.mendez@securecampus.edu',
        'v.morales@securecampus.edu',
      ],
    };
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignorar error secundario de rollback si la conexión cayó
      }
    }

    const message =
      error instanceof Error ? sanitizeConnectionUrl(error.message) : 'Error desconocido';
    console.error(`\n[Semillas Error] ${message}`);
    throw error;
  } finally {
    if (typeof client.release === 'function') {
      client.release();
    }
    if (!options?.skipClosePool && !options?.client) {
      await closePool();
    }
  }
}

// Ejecución directa por CLI (ej. tsx scripts/seed-dev-users.ts)
const isDirectCliExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('seed-dev-users.ts') || process.argv[1].endsWith('seed-dev-users.js'));

if (isDirectCliExecution) {
  seedDevUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      const code = err instanceof SeedSecurityError ? err.code : 'UNKNOWN';
      const msg = err instanceof Error ? sanitizeConnectionUrl(err.message) : 'Error desconocido';
      console.error(`\n[ABORTADO SEC-05 (${code})]: ${msg}`);
      process.exit(1);
    });
}
