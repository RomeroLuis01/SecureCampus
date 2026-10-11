import readline from 'node:readline/promises';
import { pool, closePool } from '../backend/src/config/database.js';
import { hashPassword } from '../backend/src/auth/argon2.service.js';

async function promptHidden(queryText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    process.stdout.write(queryText);
    const stdin = process.stdin;
    const oldRawMode = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let input = '';
    const onData = (charBuffer: Buffer) => {
      const char = charBuffer.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.removeListener('data', onData);
        if (stdin.isTTY) {
          stdin.setRawMode(oldRawMode ?? false);
        }
        process.stdout.write('\n');
        rl.close();
        resolve(input);
      } else if (char === '\u0003') {
        // Ctrl+C
        process.exit(1);
      } else if (char === '\b' || char === '\x7f') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
      } else {
        input += char;
      }
    };

    stdin.on('data', onData);
  });
}

async function promptVisible(queryText: string, defaultValue = ''): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(defaultValue ? `${queryText} [${defaultValue}]: ` : `${queryText}: `);
  rl.close();
  return answer.trim() || defaultValue;
}

async function main() {
  console.log('\n============================================================');
  console.log('SecureCampus — Aprovisionamiento Inicial de Administrador');
  console.log('============================================================\n');

  const client = await pool.connect();

  try {
    // 1. Verificar si ya existe un administrador activo en el sistema
    const existingAdminRes = await client.query<{ total: string }>(
      `SELECT count(*) AS total
       FROM seguridad.usuarios_roles ur
       JOIN seguridad.roles r ON r.rol_id = ur.rol_id
       WHERE r.codigo = 'ADMINISTRADOR' AND ur.revocado_en IS NULL`
    );

    const adminCount = parseInt(existingAdminRes.rows[0]?.total || '0', 10);
    if (adminCount > 0) {
      console.log('AVISO: Ya existe al menos un Administrador activo en el sistema.');
      console.log('El procedimiento de cold-start se cancela para proteger la separación de funciones.');
      console.log('Para agregar más administradores, inicie sesión con la cuenta existente.');
      return;
    }

    // 2. Captura de datos
    let correo = process.env.BOOTSTRAP_ADMIN_EMAIL || '';
    if (!correo) {
      correo = await promptVisible('Correo institucional del Administrador', 'admin@securecampus.edu');
    }

    let nombres = process.env.BOOTSTRAP_ADMIN_NOMBRES || '';
    if (!nombres) {
      nombres = await promptVisible('Nombres', 'Administrador');
    }

    let apellidoPaterno = process.env.BOOTSTRAP_ADMIN_APELLIDO || '';
    if (!apellidoPaterno) {
      apellidoPaterno = await promptVisible('Apellido Paterno', 'Principal');
    }

    let password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
    if (!password) {
      password = await promptHidden('Contraseña para la cuenta administradora: ');
    }

    if (!password || password.length < 10) {
      throw new Error('La contraseña debe contener al menos 10 caracteres.');
    }

    console.log('\nGenerando credencial segura con Argon2id...');
    const passwordHash = await hashPassword(password);

    console.log('Iniciando transacción atómica de aprovisionamiento...');
    await client.query('BEGIN');

    // 3. Crear o reutilizar persona
    const personaRes = await client.query<{ persona_id: string }>(
      `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
       VALUES ($1, $2, $3)
       ON CONFLICT (lower(correo)) DO UPDATE
       SET nombres = EXCLUDED.nombres,
           apellido_paterno = EXCLUDED.apellido_paterno
       RETURNING persona_id`,
      [nombres, apellidoPaterno, correo.toLowerCase()]
    );
    const personaId = personaRes.rows[0].persona_id;

    // 4. Crear usuario sin OIDC (sujeto_identidad = NULL)
    const usuarioRes = await client.query<{ usuario_id: string }>(
      `INSERT INTO seguridad.usuarios (persona_id, sujeto_identidad, estado)
       VALUES ($1, NULL, 'ACTIVO')
       ON CONFLICT (persona_id) DO UPDATE
       SET estado = 'ACTIVO'
       RETURNING usuario_id`,
      [personaId]
    );
    const usuarioId = usuarioRes.rows[0].usuario_id;

    // 5. Crear credencial local
    await client.query(
      `INSERT INTO seguridad.credenciales (usuario_id, password_hash, estado)
       VALUES ($1, $2, 'ACTIVO')
       ON CONFLICT (usuario_id) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           intentos_fallidos = 0,
           bloqueado_hasta = NULL,
           estado = 'ACTIVO'`,
      [usuarioId, passwordHash]
    );

    // 6. Obtener ID del rol ADMINISTRADOR
    const rolRes = await client.query<{ rol_id: string }>(
      `SELECT rol_id FROM seguridad.roles WHERE codigo = 'ADMINISTRADOR'`
    );
    if (!rolRes.rows || rolRes.rows.length === 0) {
      throw new Error("El rol del sistema 'ADMINISTRADOR' no fue encontrado en seguridad.roles.");
    }
    const rolId = rolRes.rows[0].rol_id;

    // 7. Asignar rol con asignado_por_usuario_id = NULL (alta inicial permitida por separación de funciones)
    await client.query(
      `INSERT INTO seguridad.usuarios_roles (
         usuario_id,
         rol_id,
         carrera_id,
         asignado_por_usuario_id
       ) VALUES ($1, $2, NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [usuarioId, rolId]
    );

    // 8. Registrar en bitácora de auditoría
    await client.query(
      `INSERT INTO auditoria.bitacora (
         actor_usuario_id,
         codigo_accion,
         tipo_recurso,
         resultado,
         metadatos
       ) VALUES ($1, 'ADMIN_BOOTSTRAP', 'USUARIO', 'EXITO', '{"procedimiento": "COLD_START_CLI"}'::jsonb)`,
      [usuarioId]
    );

    await client.query('COMMIT');
    console.log(`\nÉXITO: Administrador creado correctamente.`);
    console.log(`  Identificador: ${correo}`);
    console.log(`  Usuario ID:    ${usuarioId}`);
    console.log('============================================================\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nERROR durante el aprovisionamiento:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  console.error('Fallo no controlado:', err);
  process.exit(1);
});
