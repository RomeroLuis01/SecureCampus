import { query } from '../config/database.js';
import { verifyPassword, verifyDummy } from './argon2.service.js';
import { createSession, revokeSession } from './session.service.js';
import { AppClientError } from '../middleware/errorHandler.js';

export interface AuthUserProfile {
  usuarioId: string;
  personaId: string;
  nombreCompleto: string;
  correo: string;
  estado: string;
  telefono?: string | null;
  curp?: string | null;
  matricula?: string | null;
  numeroEmpleado?: string | null;
  carreraCodigo?: string | null;
  carreraNombre?: string | null;
  roles: Array<{ rolId: string; codigo: string; carreraId: string | null }>;
  permisos: string[];
  estadoCredencial?: string | null;
  bloqueadoHasta?: Date | null;
  estadoAlumno?: string | null;
}

export interface LoginResult {
  rawToken: string;
  expiraEn: Date;
  user: AuthUserProfile;
}

/**
 * Audit event logger inserting into auditoria.bitacora without sensitive payload data.
 */
export async function logAuditEvent(params: {
  actorUsuarioId: string | null;
  codigoAccion: string;
  resultado: 'EXITO' | 'DENEGADO' | 'ERROR';
  direccionIp?: string;
  agenteUsuario?: string;
  metadatos?: Record<string, unknown>;
}): Promise<void> {
  const normalizedIp = params.direccionIp?.replace(/^::ffff:/, '') || null;
  try {
    await query(
      `INSERT INTO auditoria.bitacora (
         actor_usuario_id,
         codigo_accion,
         tipo_recurso,
         resultado,
         direccion_ip,
         agente_usuario,
         metadatos
       ) VALUES ($1, $2, 'USUARIO', $3, $4::inet, $5, $6::jsonb)`,
      [
        params.actorUsuarioId,
        params.codigoAccion,
        params.resultado,
        normalizedIp,
        params.agenteUsuario ?? null,
        params.metadatos ? JSON.stringify(params.metadatos) : null,
      ]
    );
  } catch (err) {
    console.error(
      '[Audit Service] Failed to record audit event:',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

/**
 * Polymorphic user identifier resolution across correo, matricula, and numero_empleado.
 */
export async function resolveUserByIdentifier(rawIdentifier: string): Promise<{
  rows: Array<{
    usuario_id: string;
    persona_id: string;
    nombre_completo: string;
    correo: string;
    estado_usuario: string;
    password_hash: string | null;
    estado_credencial: string | null;
    intentos_fallidos: number | null;
    bloqueado_hasta: Date | null;
  }>;
  isAmbiguous: boolean;
}> {
  const cleanId = rawIdentifier.trim();
  const isEmail = cleanId.includes('@');
  const normalizedSearch = isEmail ? cleanId.toLowerCase() : cleanId;

  const result = await query<{
    usuario_id: string;
    persona_id: string;
    nombre_completo: string;
    correo: string;
    estado_usuario: string;
    password_hash: string | null;
    estado_credencial: string | null;
    intentos_fallidos: number | null;
    bloqueado_hasta: Date | null;
  }>(
    `WITH persona_candidata AS (
       -- 1. Coincidencia por correo institucional
       SELECT p.persona_id
       FROM nucleo.personas p
       WHERE lower(p.correo) = lower($1)

       UNION

       -- 2. Coincidencia por matrícula de alumno
       SELECT a.persona_id
       FROM academico.alumnos a
       WHERE a.matricula = $1

       UNION

       -- 3. Coincidencia por número de empleado de profesor
       SELECT pr.persona_id
       FROM academico.profesores pr
       WHERE pr.numero_empleado = $1
     )
     SELECT 
       u.usuario_id,
       p.persona_id,
       p.nombre_completo,
       p.correo,
       u.estado AS estado_usuario,
       c.password_hash,
       c.estado AS estado_credencial,
       c.intentos_fallidos,
       c.bloqueado_hasta
     FROM persona_candidata pc
     JOIN nucleo.personas p ON p.persona_id = pc.persona_id
     JOIN seguridad.usuarios u ON u.persona_id = pc.persona_id
     LEFT JOIN seguridad.credenciales c ON c.usuario_id = u.usuario_id`,
    [normalizedSearch]
  );

  return {
    rows: result.rows,
    isAmbiguous: result.rows.length > 1,
  };
}

/**
 * Fetches user profile, active roles and effective permissions.
 */
export async function getUserProfile(usuarioId: string): Promise<AuthUserProfile> {
  const userQuery = await query<{
    usuario_id: string;
    persona_id: string;
    nombre_completo: string;
    correo: string;
    estado: string;
    telefono: string | null;
    curp: string | null;
    matricula: string | null;
    estado_alumno: string | null;
    numero_empleado: string | null;
    carrera_codigo: string | null;
    carrera_nombre: string | null;
    estado_credencial: string | null;
    bloqueado_hasta: Date | null;
  }>(
    `SELECT 
       u.usuario_id, 
       p.persona_id, 
       p.nombre_completo, 
       p.correo, 
       u.estado,
       p.telefono,
       p.curp,
       a.matricula,
       a.estado AS estado_alumno,
       pr.numero_empleado,
       COALESCE(c_ur.codigo, c_ac.codigo, c_pr.codigo) AS carrera_codigo,
       COALESCE(c_ur.nombre, c_ac.nombre, c_pr.nombre) AS carrera_nombre,
       c.estado AS estado_credencial,
       c.bloqueado_hasta
     FROM seguridad.usuarios u
     JOIN nucleo.personas p ON p.persona_id = u.persona_id
     LEFT JOIN seguridad.credenciales c ON c.usuario_id = u.usuario_id
     LEFT JOIN academico.alumnos a ON a.persona_id = p.persona_id
     LEFT JOIN academico.profesores pr ON pr.persona_id = p.persona_id
     LEFT JOIN seguridad.usuarios_roles ur ON ur.usuario_id = u.usuario_id AND ur.carrera_id IS NOT NULL
     LEFT JOIN nucleo.carreras c_ur ON c_ur.carrera_id = ur.carrera_id
     LEFT JOIN academico.alumnos_carreras ac ON ac.alumno_id = a.alumno_id AND ac.fecha_fin IS NULL
     LEFT JOIN nucleo.carreras c_ac ON c_ac.carrera_id = ac.carrera_id
     LEFT JOIN academico.profesores_carreras pc ON pc.profesor_id = pr.profesor_id AND pc.fecha_fin IS NULL
     LEFT JOIN nucleo.carreras c_pr ON c_pr.carrera_id = pc.carrera_id
     WHERE u.usuario_id = $1`,
    [usuarioId]
  );

  if (!userQuery.rows || userQuery.rows.length === 0) {
    throw new AppClientError('Usuario no encontrado', 404);
  }

  const u = userQuery.rows[0];

  const permsQuery = await query<{
    rol_id: string;
    codigo_rol: string;
    carrera_id: string | null;
    permiso_id: string;
    codigo_permiso: string;
  }>(
    `SELECT rol_id, codigo_rol, carrera_id, permiso_id, codigo_permiso
     FROM seguridad.v_permisos_efectivos_usuario
     WHERE usuario_id = $1`,
    [usuarioId]
  );

  const rolesMap = new Map<string, { rolId: string; codigo: string; carreraId: string | null }>();
  const permisosSet = new Set<string>();

  for (const row of permsQuery.rows) {
    const key = `${row.rol_id}_${row.carrera_id ?? 'global'}`;
    if (!rolesMap.has(key)) {
      rolesMap.set(key, {
        rolId: row.rol_id,
        codigo: row.codigo_rol,
        carreraId: row.carrera_id,
      });
    }
    permisosSet.add(row.codigo_permiso);
  }

  return {
    usuarioId: u.usuario_id,
    personaId: u.persona_id,
    nombreCompleto: u.nombre_completo,
    correo: u.correo,
    estado: u.estado,
    telefono: u.telefono ?? null,
    curp: u.curp ?? null,
    matricula: u.matricula ?? null,
    numeroEmpleado: u.numero_empleado ?? null,
    carreraCodigo: u.carrera_codigo ?? null,
    carreraNombre: u.carrera_nombre ?? null,
    roles: Array.from(rolesMap.values()),
    permisos: Array.from(permisosSet),
    estadoCredencial: u.estado_credencial ?? null,
    bloqueadoHasta: u.bloqueado_hasta ? new Date(u.bloqueado_hasta) : null,
    estadoAlumno: u.estado_alumno ?? null,
  };
}

/**
 * Executes full authentication flow with constant-time dummy verification,
 * atomic concurrency-safe lockouts, and session generation.
 */
export async function authenticate(params: {
  identifier: string;
  password: string;
  ip?: string;
  userAgent?: string;
}): Promise<LoginResult> {
  const { identifier, password, ip, userAgent } = params;

  // 1. Resolve candidate user
  const { rows, isAmbiguous } = await resolveUserByIdentifier(identifier);
  const candidate = rows[0];

  // Fallback constant-time path if non-existent, ambiguous, or lacks local credentials
  if (rows.length === 0 || isAmbiguous || !candidate || !candidate.password_hash) {
    await verifyDummy(password);
    await logAuditEvent({
      actorUsuarioId: rows.length === 1 && rows[0] ? rows[0].usuario_id : null,
      codigoAccion: 'AUTH_LOGIN',
      resultado: 'DENEGADO',
      direccionIp: ip,
      agenteUsuario: userAgent,
      metadatos: isAmbiguous ? { motivo: 'IDENTIFICADOR_AMBIGUO' } : { motivo: 'USUARIO_NO_ENCONTRADO' },
    });
    throw new AppClientError('Credenciales inválidas', 401);
  }

  const user = {
    ...candidate,
    password_hash: candidate.password_hash,
  };

  // 2. Validate account status
  if (user.estado_usuario !== 'ACTIVO' || user.estado_credencial === 'BLOQUEADO') {
    await verifyDummy(password);
    await logAuditEvent({
      actorUsuarioId: user.usuario_id,
      codigoAccion: 'AUTH_LOGIN',
      resultado: 'DENEGADO',
      direccionIp: ip,
      agenteUsuario: userAgent,
      metadatos: { motivo: 'CUENTA_INACTIVA_O_BLOQUEADA' },
    });
    throw new AppClientError('Credenciales inválidas', 401);
  }

  const now = new Date();

  // 3. Check for active temporary lockout
  if (user.bloqueado_hasta && now < new Date(user.bloqueado_hasta)) {
    await verifyDummy(password);
    await logAuditEvent({
      actorUsuarioId: user.usuario_id,
      codigoAccion: 'AUTH_LOGIN',
      resultado: 'DENEGADO',
      direccionIp: ip,
      agenteUsuario: userAgent,
      metadatos: { motivo: 'BLOQUEO_TEMPORAL_ACTIVO' },
    });
    throw new AppClientError('Credenciales inválidas', 401);
  }

  // 4. Verify password with Argon2id
  const passwordMatches = await verifyPassword(user.password_hash, password);

  if (!passwordMatches) {
    // Atomic fail update
    const failUpdate = await query<{ intentos_fallidos: number; bloqueado_hasta: Date | null }>(
      `UPDATE seguridad.credenciales
       SET 
         intentos_fallidos = CASE
           WHEN bloqueado_hasta IS NOT NULL AND CURRENT_TIMESTAMP >= bloqueado_hasta THEN 1
           ELSE intentos_fallidos + 1
         END,
         bloqueado_hasta = CASE
           WHEN bloqueado_hasta IS NOT NULL AND CURRENT_TIMESTAMP >= bloqueado_hasta THEN NULL
           WHEN intentos_fallidos + 1 >= 5 THEN CURRENT_TIMESTAMP + interval '15 minutes'
           ELSE NULL
         END,
         actualizado_en = CURRENT_TIMESTAMP
       WHERE usuario_id = $1
         AND (bloqueado_hasta IS NULL OR CURRENT_TIMESTAMP >= bloqueado_hasta)
       RETURNING intentos_fallidos, bloqueado_hasta`,
      [user.usuario_id]
    );

    const updatedRow = failUpdate.rows[0];
    const isNowLocked = Boolean(updatedRow?.bloqueado_hasta);

    if (isNowLocked) {
      await logAuditEvent({
        actorUsuarioId: user.usuario_id,
        codigoAccion: 'AUTH_BLOQUEO_ACTIVADO',
        resultado: 'DENEGADO',
        direccionIp: ip,
        agenteUsuario: userAgent,
        metadatos: { motivo: 'INTENTOS_EXCEDIDOS', intentos: updatedRow.intentos_fallidos },
      });
    } else {
      await logAuditEvent({
        actorUsuarioId: user.usuario_id,
        codigoAccion: 'AUTH_LOGIN',
        resultado: 'DENEGADO',
        direccionIp: ip,
        agenteUsuario: userAgent,
        metadatos: { motivo: 'PASSWORD_INVALIDO' },
      });
    }

    throw new AppClientError('Credenciales inválidas', 401);
  }

  // 5. Verification succeeded: Atomic success reset
  const successReset = await query(
    `UPDATE seguridad.credenciales
     SET 
       intentos_fallidos = 0,
       bloqueado_hasta = NULL,
       actualizado_en = CURRENT_TIMESTAMP
     WHERE usuario_id = $1
       AND (bloqueado_hasta IS NULL OR CURRENT_TIMESTAMP >= bloqueado_hasta)
     RETURNING usuario_id`,
    [user.usuario_id]
  );

  // If rowCount is 0, another request locked this account concurrently before our success reset
  if ((successReset.rowCount ?? 0) === 0) {
    await logAuditEvent({
      actorUsuarioId: user.usuario_id,
      codigoAccion: 'AUTH_LOGIN',
      resultado: 'DENEGADO',
      direccionIp: ip,
      agenteUsuario: userAgent,
      metadatos: { motivo: 'BLOQUEO_CONCURRENTE_DURANTE_LOGIN' },
    });
    throw new AppClientError('Credenciales inválidas', 401);
  }

  // 6. Create persistent session with CSPRNG token and SHA-256 hash in DB
  const session = await createSession(user.usuario_id, ip, userAgent);

  // 7. Record successful audit event
  await logAuditEvent({
    actorUsuarioId: user.usuario_id,
    codigoAccion: 'AUTH_LOGIN',
    resultado: 'EXITO',
    direccionIp: ip,
    agenteUsuario: userAgent,
  });

  // 8. Retrieve complete profile
  const profile = await getUserProfile(user.usuario_id);

  return {
    rawToken: session.rawToken,
    expiraEn: session.expiraEn,
    user: profile,
  };
}

/**
 * Logout handler revoking session and recording audit log.
 */
export async function logout(rawToken: string, usuarioId?: string, ip?: string, userAgent?: string): Promise<void> {
  await revokeSession(rawToken);
  if (usuarioId) {
    await logAuditEvent({
      actorUsuarioId: usuarioId,
      codigoAccion: 'AUTH_LOGOUT',
      resultado: 'EXITO',
      direccionIp: ip,
      agenteUsuario: userAgent,
    });
  }
}
