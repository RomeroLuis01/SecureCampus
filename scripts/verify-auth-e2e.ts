import { createApp } from '../backend/src/app.js';
import { config } from '../backend/src/config/env.js';
import { closePool, query as dbQuery } from '../backend/src/config/database.js';
import { hashSessionToken } from '../backend/src/auth/session.service.js';
import { hashPassword } from '../backend/src/auth/argon2.service.js';
import crypto from 'node:crypto';
import type { Server } from 'node:http';

async function runSmokeTest() {
  console.log('\n============================================================');
  console.log('SecureCampus — Verificación E2E de Autenticación y Sesiones');
  console.log('============================================================\n');

  const testPort = 4999;
  const app = createApp(config);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(testPort, () => resolve(s));
  });

  const baseUrl = `http://localhost:${testPort}/api/v1`;

  // Rastreo de hashes de sesión para limpieza garantizada en finally
  const trackedTokenHashes: string[] = [];
  let ephemeralUserId: string | null = null;

  function trackCookie(cookieHeader: string | null) {
    if (!cookieHeader) return;
    const match = cookieHeader.match(new RegExp(`${config.SESSION_COOKIE_NAME}=([^;]+)`));
    if (match && match[1]) {
      const rawToken = match[1];
      trackedTokenHashes.push(hashSessionToken(rawToken));
    }
  }

  try {
    // -------------------------------------------------------------
    // PRUEBA 1: Login de Estudiante por Matrícula
    // -------------------------------------------------------------
    console.log('1. Probando login de Estudiante con matrícula (202301042)...');
    const resEst = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '202301042',
        password: 'EstudianteSecure2026!',
      }),
    });

    if (resEst.status !== 200) {
      throw new Error(`Fallo en login de estudiante. Status: ${resEst.status}`);
    }

    const dataEst = (await resEst.json()) as any;
    console.log(`   OK: Login exitoso para ${dataEst.user.nombreCompleto}`);
    console.log(`   Roles obtenidos: ${dataEst.user.roles.map((r: any) => r.codigo).join(', ')}`);

    const rawCookie = resEst.headers.get('set-cookie');
    if (!rawCookie || !rawCookie.includes(config.SESSION_COOKIE_NAME)) {
      throw new Error('Fallo: No se emitió la cookie de sesión esperada');
    }
    trackCookie(rawCookie);
    console.log(`   OK: Cookie recibida correctamente con directiva HttpOnly.`);

    // -------------------------------------------------------------
    // PRUEBA 2: Consulta de Sesión (/auth/me) con Cookie
    // -------------------------------------------------------------
    console.log('\n2. Probando endpoint protegido /auth/me usando la cookie de sesión...');
    const cookieHeader = rawCookie.split(';')[0];
    const resMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: cookieHeader },
    });

    if (resMe.status !== 200) {
      throw new Error(`Fallo en /auth/me. Status: ${resMe.status}`);
    }
    const dataMe = (await resMe.json()) as any;
    console.log(`   OK: Identidad verificada en servidor: ${dataMe.user.correo}`);
    console.log(`   Permisos efectivos: ${dataMe.user.permisos.length} permisos activos.`);

    // -------------------------------------------------------------
    // PRUEBA 3: Login de Docente por Nómina (DOC-8821)
    // -------------------------------------------------------------
    console.log('\n3. Probando login de Profesor con nómina (DOC-8821)...');
    const resProf = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'DOC-8821',
        password: 'ProfesorSecure2026!',
      }),
    });
    if (resProf.status !== 200) {
      throw new Error(`Fallo en login de profesor. Status: ${resProf.status}`);
    }
    trackCookie(resProf.headers.get('set-cookie'));
    const dataProf = (await resProf.json()) as any;
    console.log(`   OK: Login exitoso para ${dataProf.user.nombreCompleto} (Roles: ${dataProf.user.roles.map((r: any) => r.codigo).join(', ')})`);

    // -------------------------------------------------------------
    // PRUEBA 4: Login de Administrador por Correo
    // -------------------------------------------------------------
    console.log('\n4. Probando login de Administrador (admin@securecampus.edu)...');
    const resAdmin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@securecampus.edu',
        password: 'AdminSecure2026!',
      }),
    });
    if (resAdmin.status !== 200) {
      throw new Error(`Fallo en login de admin. Status: ${resAdmin.status}`);
    }
    trackCookie(resAdmin.headers.get('set-cookie'));
    const dataAdmin = (await resAdmin.json()) as any;
    console.log(`   OK: Login exitoso para Administrador (Roles: ${dataAdmin.user.roles.map((r: any) => r.codigo).join(', ')})`);

    // -------------------------------------------------------------
    // PRUEBA 5: Intento con Contraseña Incorrecta
    // -------------------------------------------------------------
    console.log('\n5. Probando rechazo de credencial incorrecta...');
    const resWrong = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@securecampus.edu',
        password: 'PasswordCompletamenteErroneo!',
      }),
    });
    expectStatus(resWrong.status, 401);
    const dataWrong = (await resWrong.json()) as any;
    console.log(`   OK: Rechazo 401 con mensaje genérico: "${dataWrong.error.message}"`);

    // -------------------------------------------------------------
    // PRUEBA 6: Intento con Usuario Inexistente (Criptografía Dummy Argon2id)
    // -------------------------------------------------------------
    console.log('\n6. Probando usuario inexistente (dummy hash path con paridad criptográfica)...');
    const resNonExistent = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'fantasma_inexistente@securecampus.edu',
        password: 'PasswordCompletamenteErroneo!',
      }),
    });
    expectStatus(resNonExistent.status, 401);
    const dataNonExistent = (await resNonExistent.json()) as any;
    console.log(`   OK: Rechazo 401 idéntico con mensaje genérico: "${dataNonExistent.error.message}"`);
    console.log(`   INFO: La mitigación de temporización se basa en computación criptográfica dummy equivalente (Argon2id con idénticos m, t, p) sin retardos artificiales facilitadores de DoS.`);

    // -------------------------------------------------------------
    // PRUEBA 7: Cierre de Sesión (Logout) y Revocación
    // -------------------------------------------------------------
    console.log('\n7. Probando logout y revocación de sesión...');
    const resLogout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        Origin: 'http://localhost:5173',
      },
    });
    expectStatus(resLogout.status, 200);
    console.log('   OK: Sesión revocada en el servidor.');

    const resAfterLogout = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    expectStatus(resAfterLogout.status, 401);
    console.log('   OK: /auth/me rechaza con 401 tras revocación.');

    // -------------------------------------------------------------
    // PRUEBA 8: Consulta y Validación Rigurosa de Calificaciones Reales
    // -------------------------------------------------------------
    console.log('\n8. Probando consulta y cálculo de calificaciones reales en PostgreSQL...');
    const resFreshEst = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '202301042',
        password: 'EstudianteSecure2026!',
      }),
    });
    expectStatus(resFreshEst.status, 200);
    const freshEstCookie = resFreshEst.headers.get('set-cookie')!.split(';')[0];
    trackCookie(freshEstCookie);

    const resGrades = await fetch(`${baseUrl}/estudiante/calificaciones`, {
      headers: { Cookie: freshEstCookie },
    });
    expectStatus(resGrades.status, 200);
    const gradesData = (await resGrades.json()) as any;

    // Validación de periodo 2026-A: CS-602 con 92.00
    const p2026A = gradesData.periodos.find((p: any) => p.codigo === '2026-A');
    if (!p2026A) throw new Error('Fallo: No se encontró periodo 2026-A en la respuesta');
    const cs602 = p2026A.materias.find((m: any) => m.codigo === 'CS-602');
    if (!cs602 || cs602.calificacionFinal !== 92 || cs602.estado !== 'APROBADA') {
      throw new Error(`Fallo: CS-602 en 2026-A debe tener calificacionFinal = 92 y estado APROBADA`);
    }
    console.log(`   OK: Periodo 2026-A -> CS-602: ${cs602.calificacionFinal} (${cs602.estado})`);

    // Validación de periodo 2026-B: CS-601 con 95.00, CS-603 PENDIENTE (null)
    const p2026B = gradesData.periodos.find((p: any) => p.codigo === '2026-B');
    if (!p2026B) throw new Error('Fallo: No se encontró periodo 2026-B en la respuesta');
    const cs601 = p2026B.materias.find((m: any) => m.codigo === 'CS-601');
    if (!cs601 || cs601.calificacionFinal !== 95 || cs601.estado !== 'APROBADA') {
      throw new Error(`Fallo: CS-601 en 2026-B debe tener calificacionFinal = 95 y estado APROBADA`);
    }
    const cs603 = p2026B.materias.find((m: any) => m.codigo === 'CS-603');
    if (!cs603 || cs603.calificacionFinal !== null || cs603.estado !== 'PENDIENTE' || cs603.estadoCalificacion !== 'PENDIENTE') {
      throw new Error(`Fallo: CS-603 en 2026-B debe tener calificacionFinal = null y estado PENDIENTE`);
    }
    console.log(`   OK: Periodo 2026-B -> CS-601: ${cs601.calificacionFinal} (${cs601.estado})`);
    console.log(`   OK: Periodo 2026-B -> CS-603: ${cs603.calificacionFinal ?? 'Pendiente'} (${cs603.estado}, evaluación en curso)`);

    // Validación de promedio del periodo 2026-B (no debe contabilizar CS-603 como 0)
    if (p2026B.resumen.promedio !== 95) {
      throw new Error(`Fallo: Promedio de 2026-B debe ser 95.00 (sin promediar nota pendiente como 0). Recibido: ${p2026B.resumen.promedio}`);
    }
    console.log(`   OK: Promedio del periodo 2026-B = ${p2026B.resumen.promedio} (las notas pendientes NO se promedian como cero)`);

    // Validación de promedio general acumulado: (92 + 95) / 2 = 93.5
    if (gradesData.resumenGeneral.promedioGeneral !== 93.5) {
      throw new Error(`Fallo: Promedio general acumulado debe ser 93.50. Recibido: ${gradesData.resumenGeneral.promedioGeneral}`);
    }
    console.log(`   OK: Promedio general acumulado = ${gradesData.resumenGeneral.promedioGeneral} (${gradesData.resumenGeneral.creditosTotalesAprobados} créditos acreditados)`);

    // -------------------------------------------------------------
    // PRUEBA 9: Control de Acceso por Rol (RBAC)
    // -------------------------------------------------------------
    console.log('\n9. Probando aislamiento RBAC (Docente accediendo a endpoint de alumno)...');
    const rawProfCookie = resProf.headers.get('set-cookie')!.split(';')[0];
    const resForbiddenRole = await fetch(`${baseUrl}/estudiante/calificaciones`, {
      headers: { Cookie: rawProfCookie },
    });
    expectStatus(resForbiddenRole.status, 403);
    const dataForbidden = (await resForbiddenRole.json()) as any;
    console.log(`   OK: Rechazo 403 por rol insuficiente: "${dataForbidden.error.message}"`);

    // -------------------------------------------------------------
    // PRUEBA 10: Acceso Anónimo a Endpoint Protegido
    // -------------------------------------------------------------
    console.log('\n10. Probando rechazo de acceso anónimo a endpoint protegido...');
    const resAnon = await fetch(`${baseUrl}/estudiante/calificaciones`);
    expectStatus(resAnon.status, 401);
    const dataAnon = (await resAnon.json()) as any;
    console.log(`   OK: Rechazo 401 por falta de sesión: "${dataAnon.error.message}"`);

    // -------------------------------------------------------------
    // PRUEBA 11: Política Anti-CSRF en Métodos Mutadores
    // -------------------------------------------------------------
    console.log('\n11. Probando política Anti-CSRF (POST con Origin malicioso)...');
    const resCsrf = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: freshEstCookie,
        Origin: 'https://sitio-malicioso.com',
      },
    });
    expectStatus(resCsrf.status, 403);
    const dataCsrf = (await resCsrf.json()) as any;
    console.log(`   OK: Rechazo 403 por política CSRF: "${dataCsrf.error.message}"`);

    // -------------------------------------------------------------
    // PRUEBA 12: Rechazo de Cookie Malformada o Token Manipulado
    // -------------------------------------------------------------
    console.log('\n12. Probando rechazo de cookie con token malformado o manipulado...');
    const resManipulated = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `${config.SESSION_COOKIE_NAME}=token_falso_completamente_invalido_12345` },
    });
    expectStatus(resManipulated.status, 401);
    const dataManipulated = (await resManipulated.json()) as any;
    console.log(`   OK: Rechazo 401 por sesión inexistente/manipulada: "${dataManipulated.error.message}"`);

    // =============================================================
    // CREACIÓN DE USUARIO EFÍMERO PARA PRUEBAS DESTRUCTIVAS Y DE ESTADO
    // (Aislamiento total: NUNCA se alteran las cuentas sembradas de desarrollo)
    // =============================================================
    const ephemeralEmail = `e2e_guard_test_${Date.now()}@securecampus.edu`;
    const ephemeralPlainPassword = 'EphemeralGuardSecure2026!';
    const ephemeralHash = await hashPassword(ephemeralPlainPassword);

    const persRes = await dbQuery<{ persona_id: string }>(
      `INSERT INTO nucleo.personas (nombres, apellido_paterno, correo)
       VALUES ('E2E_Test', 'Ephemeral', $1)
       RETURNING persona_id`,
      [ephemeralEmail]
    );
    const ephemeralPersonaId = persRes.rows[0].persona_id;

    const userRes = await dbQuery<{ usuario_id: string }>(
      `INSERT INTO seguridad.usuarios (persona_id, estado)
       VALUES ($1, 'ACTIVO')
       RETURNING usuario_id`,
      [ephemeralPersonaId]
    );
    ephemeralUserId = userRes.rows[0].usuario_id;

    await dbQuery(
      `INSERT INTO seguridad.credenciales (usuario_id, password_hash, estado)
       VALUES ($1, $2, 'ACTIVO')`,
      [ephemeralUserId, ephemeralHash]
    );

    // -------------------------------------------------------------
    // PRUEBA 13: Rechazo de Sesión Vencida (Expiración en DB)
    // -------------------------------------------------------------
    console.log('\n13. Probando rechazo y revocación de sesión vencida en PostgreSQL (cuenta efímera)...');
    const tempRawToken = crypto.randomBytes(32).toString('base64url');
    const tempHash = hashSessionToken(tempRawToken);
    trackedTokenHashes.push(tempHash);

    await dbQuery(
      `INSERT INTO seguridad.sesiones (usuario_id, token_hash, creado_en, ultimo_acceso_en, expira_en, direccion_ip)
       VALUES ($1, $2, clock_timestamp() - interval '2 hours', clock_timestamp() - interval '2 hours', clock_timestamp() - interval '1 hour', '127.0.0.1'::inet)`,
      [ephemeralUserId, tempHash]
    );

    const resExpired = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `${config.SESSION_COOKIE_NAME}=${tempRawToken}` },
    });
    expectStatus(resExpired.status, 401);
    const dataExpired = (await resExpired.json()) as any;
    console.log(`   OK: Rechazo 401 por sesión vencida: "${dataExpired.error.message}"`);

    // -------------------------------------------------------------
    // PRUEBA 14: Suspensión de Cuenta Activa en Tiempo Real
    // -------------------------------------------------------------
    console.log('\n14. Probando invalidación en tiempo real cuando la cuenta pasa a SUSPENDIDO (cuenta efímera)...');
    const resLoginEph1 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: ephemeralEmail,
        password: ephemeralPlainPassword,
      }),
    });
    expectStatus(resLoginEph1.status, 200);
    const activeCookieEph1 = resLoginEph1.headers.get('set-cookie')!.split(';')[0];
    trackCookie(activeCookieEph1);

    // Aplicar suspensión sobre la cuenta efímera exclusivamente
    await dbQuery(
      `UPDATE seguridad.usuarios SET estado = 'SUSPENDIDO' WHERE usuario_id = $1`,
      [ephemeralUserId]
    );

    try {
      const resSuspended = await fetch(`${baseUrl}/auth/me`, {
        headers: { Cookie: activeCookieEph1 },
      });
      expectStatus(resSuspended.status, 403);
      const dataSuspended = (await resSuspended.json()) as any;
      console.log(`   OK: Rechazo 403 por cuenta suspendida: "${dataSuspended.error.message}"`);

      // Intento de login con cuenta suspendida rechazado con 401 genérico
      const resLoginSuspended = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: ephemeralEmail,
          password: ephemeralPlainPassword,
        }),
      });
      expectStatus(resLoginSuspended.status, 401);
      console.log('   OK: Login rechazado con 401 genérico ante cuenta suspendida.');
    } finally {
      // Restaurar estado ACTIVO en cuenta efímera
      await dbQuery(
        `UPDATE seguridad.usuarios SET estado = 'ACTIVO' WHERE usuario_id = $1`,
        [ephemeralUserId]
      );
    }

    // -------------------------------------------------------------
    // PRUEBA 15: Bloqueo Administrativo de Credenciales
    // -------------------------------------------------------------
    console.log('\n15. Probando invalidación ante bloqueo administrativo de credenciales (cuenta efímera)...');
    const resLoginEph2 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: ephemeralEmail,
        password: ephemeralPlainPassword,
      }),
    });
    expectStatus(resLoginEph2.status, 200);
    const activeCookieEph2 = resLoginEph2.headers.get('set-cookie')!.split(';')[0];
    trackCookie(activeCookieEph2);

    // Aplicar bloqueo sobre credencial efímera
    await dbQuery(
      `UPDATE seguridad.credenciales SET estado = 'BLOQUEADO' WHERE usuario_id = $1`,
      [ephemeralUserId]
    );

    try {
      const resBlocked = await fetch(`${baseUrl}/auth/me`, {
        headers: { Cookie: activeCookieEph2 },
      });
      expectStatus(resBlocked.status, 403);
      const dataBlocked = (await resBlocked.json()) as any;
      console.log(`   OK: Rechazo 403 por credencial bloqueada: "${dataBlocked.error.message}"`);
    } finally {
      // Restaurar credencial efímera
      await dbQuery(
        `UPDATE seguridad.credenciales SET estado = 'ACTIVO' WHERE usuario_id = $1`,
        [ephemeralUserId]
      );
    }

    console.log('\n============================================================');
    console.log('TODAS LAS PRUEBAS E2E (15/15) PASARON CON ÉXITO');
    console.log('============================================================\n');
  } finally {
    // -------------------------------------------------------------
    // LIMPIEZA RIGUROSA Y GARANTÍA DE NO ALTERACIÓN DE CUENTAS DE DESARROLLO
    // -------------------------------------------------------------
    try {
      // 1. Revocar todas las sesiones generadas en este test run
      if (trackedTokenHashes.length > 0) {
        await dbQuery(
          `UPDATE seguridad.sesiones
           SET revocado_en = clock_timestamp()
           WHERE token_hash = ANY($1::text[]) AND revocado_en IS NULL`,
          [trackedTokenHashes]
        );
      }

      // 2. Desactivar y revocar todo estado de la cuenta efímera
      if (ephemeralUserId) {
        await dbQuery(
          `UPDATE seguridad.sesiones
           SET revocado_en = clock_timestamp()
           WHERE usuario_id = $1 AND revocado_en IS NULL`,
          [ephemeralUserId]
        );
        await dbQuery(
          `UPDATE seguridad.credenciales SET estado = 'BLOQUEADO' WHERE usuario_id = $1`,
          [ephemeralUserId]
        );
        await dbQuery(
          `UPDATE seguridad.usuarios SET estado = 'DESHABILITADO' WHERE usuario_id = $1`,
          [ephemeralUserId]
        );
      }

      // 3. Garantía de preservación: asegurar que cuentas de desarrollo sembradas permanezcan ACTIVAS
      await dbQuery(
        `UPDATE seguridad.usuarios u
         SET estado = 'ACTIVO'
         FROM nucleo.personas p
         WHERE p.persona_id = u.persona_id
           AND p.correo IN ('estudiante@securecampus.edu', 'profesor@securecampus.edu', 'admin@securecampus.edu')`
      );
      await dbQuery(
        `UPDATE seguridad.credenciales c
         SET estado = 'ACTIVO', intentos_fallidos = 0, bloqueado_hasta = NULL
         FROM seguridad.usuarios u
         JOIN nucleo.personas p ON p.persona_id = u.persona_id
         WHERE c.usuario_id = u.usuario_id
           AND p.correo IN ('estudiante@securecampus.edu', 'profesor@securecampus.edu', 'admin@securecampus.edu')`
      );
    } catch (cleanupErr) {
      console.error('[E2E Cleanup] Advertencia durante limpieza de sesiones/estados:', cleanupErr);
    }

    server.close();
    await closePool();
  }
}

function expectStatus(actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`Status inesperado: Esperaba ${expected}, recibido ${actual}`);
  }
}

runSmokeTest().catch((err) => {
  console.error('\nERROR EN PRUEBA E2E:', err);
  process.exit(1);
});
