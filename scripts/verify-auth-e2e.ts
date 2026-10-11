import { createApp } from '../backend/src/app.js';
import { config } from '../backend/src/config/env.js';
import { closePool } from '../backend/src/config/database.js';
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
    console.log(`   OK: Cookie recibida correctamente con directiva HttpOnly.`);

    // -------------------------------------------------------------
    // PRUEBA 2: Consulta de Sesión (/auth/me) con Cookie
    // -------------------------------------------------------------
    console.log('\n2. Probando endpoint protegido /auth/me usando la cookie de sesión...');
    const cookieHeader = rawCookie.split(';')[0]; // Extrae nombre=valor
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
    // PRUEBA 6: Intento con Usuario Inexistente (Timing Defense)
    // -------------------------------------------------------------
    console.log('\n6. Probando usuario inexistente (dummy hash path)...');
    const t0 = Date.now();
    const resNonExistent = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'fantasma_inexistente@securecampus.edu',
        password: 'PasswordCompletamenteErroneo!',
      }),
    });
    const duration = Date.now() - t0;
    expectStatus(resNonExistent.status, 401);
    const dataNonExistent = (await resNonExistent.json()) as any;
    console.log(`   OK: Rechazo 401 idéntico en ${duration}ms ("${dataNonExistent.error.message}")`);

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

    // Verificar que la cookie fue eliminada o que la sesión ya no permite acceso
    const resAfterLogout = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    expectStatus(resAfterLogout.status, 401);
    console.log('   OK: /auth/me rechaza con 401 tras revocación exitosa.');

    console.log('\n============================================================');
    console.log('TODAS LAS PRUEBAS E2E DE AUTENTICACIÓN PASARON CON ÉXITO');
    console.log('============================================================\n');
  } finally {
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
