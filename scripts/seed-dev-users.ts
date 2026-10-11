import { pool, closePool } from '../backend/src/config/database.js';
import { hashPassword } from '../backend/src/auth/argon2.service.js';

async function seedDevUsers() {
  console.log('\n--- Sembrando Usuarios de Prueba para Desarrollo Local ---');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Asegurar carrera inicial para el Jefe de Carrera
    const carreraRes = await client.query<{ carrera_id: string }>(
      `INSERT INTO nucleo.carreras (codigo, nombre, descripcion, estado)
       VALUES ('ISC', 'Ingeniería en Sistemas Computacionales', 'Carrera de Sistemas', 'ACTIVA')
       ON CONFLICT (codigo) DO UPDATE
       SET nombre = EXCLUDED.nombre
       RETURNING carrera_id`
    );
    const carreraId = carreraRes.rows[0].carrera_id;

    // Roles del sistema
    const rolesRes = await client.query<{ rol_id: string; codigo: string }>(
      `SELECT rol_id, codigo FROM seguridad.roles WHERE codigo IN ('JEFE_CARRERA', 'PROFESOR', 'ALUMNO')`
    );
    const rolesMap = new Map(rolesRes.rows.map((r) => [r.codigo, r.rol_id]));

    // 2. JEFE DE CARRERA: a.martinez@securecampus.edu / JefeSecure2026!
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

    // 3. PROFESOR: a.mendez@securecampus.edu / DOC-8821 / ProfesorSecure2026!
    console.log('Sembrando Profesor (a.mendez@securecampus.edu / DOC-8821)...');
    const passProf = await hashPassword('ProfesorSecure2026!');
    const profPersona = await client.query<{ persona_id: string }>(
      `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
       VALUES ('Antonio', 'Méndez', 'a.mendez@securecampus.edu')
       ON CONFLICT (lower(correo)) DO UPDATE SET nombres = EXCLUDED.nombres
       RETURNING persona_id`
    );
    const profPersonaId = profPersona.rows[0].persona_id;
    // Registrar registro academico de profesor
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

    // 4. ESTUDIANTE: v.morales@securecampus.edu / 202301042 / EstudianteSecure2026!
    console.log('Sembrando Estudiante (v.morales@securecampus.edu / 202301042)...');
    const passEst = await hashPassword('EstudianteSecure2026!');
    const estPersona = await client.query<{ persona_id: string }>(
      `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
       VALUES ('Valentina', 'Morales', 'v.morales@securecampus.edu')
       ON CONFLICT (lower(correo)) DO UPDATE SET nombres = EXCLUDED.nombres
       RETURNING persona_id`
    );
    const estPersonaId = estPersona.rows[0].persona_id;
    // Registrar registro academico de alumno
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

    await client.query('COMMIT');
    console.log('\nÉXITO: Usuarios institucionales de desarrollo sembrados correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nERROR sembrando usuarios:', error);
  } finally {
    client.release();
    await closePool();
  }
}

seedDevUsers().catch(console.error);
