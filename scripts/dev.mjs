import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isWindows = process.platform === 'win32';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const tsxBin = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const dockerBin = isWindows ? 'docker.exe' : 'docker';

const BACKEND_PORT = process.env.PORT || 4000;
const FRONTEND_PORT = 5173;
const DB_PORT = process.env.DB_PORT || 5433;

console.log('\n============================================================');
console.log(' [SecureCampus] Coordinando entorno integral de desarrollo');
console.log('============================================================\n');

let startedDbDuringRun = false;
let wasDbAlreadyRunning = false;
let backendProcess = null;
let viteProcess = null;
let isShuttingDown = false;

/**
 * Termina de forma fiable un proceso y todos sus descendientes en Windows o Unix.
 */
function killProcessTree(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  try {
    if (isWindows && child.pid) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else if (child.pid) {
      child.kill('SIGTERM');
    }
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Ignorar si ya terminó
    }
  }
}

/**
 * Limpieza ordenada e idempotente de procesos y recursos.
 */
function cleanupAndExit(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n\n [SecureCampus] Iniciando apagado ordenado del entorno...');

  // 1. Terminar Frontend (Vite)
  if (viteProcess) {
    killProcessTree(viteProcess);
    viteProcess = null;
  }

  // 2. Terminar Backend (Express / tsx)
  if (backendProcess) {
    killProcessTree(backendProcess);
    backendProcess = null;
  }

  // 3. Política consistente para PostgreSQL:
  // Si fue iniciado por esta ejecución, detenerlo para liberar memoria RAM y CPU (sin borrar datos ni volúmenes).
  // Si ya estaba en ejecución antes de iniciar este coordinador, conservarlo activo.
  if (startedDbDuringRun && !wasDbAlreadyRunning) {
    console.log(' [Docker] Deteniendo contenedor PostgreSQL iniciado en esta sesión...');
    try {
      spawnSync(dockerBin, ['compose', 'stop', 'db'], {
        cwd: rootDir,
        stdio: 'ignore',
      });
      console.log(' [Docker] Contenedor PostgreSQL detenido correctamente.');
    } catch {
      // Ignorar errores al detener el contenedor
    }
  } else if (wasDbAlreadyRunning) {
    console.log(' [Docker] Contenedor PostgreSQL conservado en ejecución (servicio preexistente preservado).');
  }

  console.log(' [SecureCampus] Cierre completado. ¡Hasta pronto!\n');
  process.exit(code);
}

// Captura de señales de terminación
if (isWindows && process.stdin.isTTY) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.on('SIGINT', () => cleanupAndExit(0));
}

process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));
process.on('SIGHUP', () => cleanupAndExit(0));

/**
 * Comprueba si Docker y Docker Compose están disponibles.
 */
function checkDockerAvailable() {
  const check = spawnSync(dockerBin, ['compose', 'version'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return check.status === 0;
}

/**
 * Comprueba si el servicio 'db' ya se encuentra en ejecución y saludable.
 */
function checkPostgresStatus() {
  const ps = spawnSync(dockerBin, ['compose', 'ps', 'db', '--format', 'json'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (ps.status !== 0 || !ps.stdout.trim()) {
    return { isRunning: false, isHealthy: false };
  }
  try {
    const raw = ps.stdout.trim();
    // Puede retornar un objeto o un array de objetos
    const info = raw.startsWith('[') ? JSON.parse(raw)[0] : JSON.parse(raw);
    const isRunning = info?.State === 'running';
    const isHealthy = info?.Health === 'healthy' || (info?.Status && info.Status.includes('healthy'));
    return { isRunning, isHealthy };
  } catch {
    const isRunning = ps.stdout.includes('"running"');
    const isHealthy = ps.stdout.includes('healthy');
    return { isRunning, isHealthy };
  }
}

/**
 * Espera de forma no bloqueante a que el backend reporte estado 'ready' en /api/v1/health/ready.
 */
async function waitForBackendReady(maxWaitMs = 25000, intervalMs = 300) {
  const readyUrl = `http://localhost:${BACKEND_PORT}/api/v1/health/ready`;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    if (backendProcess && backendProcess.exitCode !== null) {
      throw new Error(`El proceso del backend terminó prematuramente con código ${backendProcess.exitCode}`);
    }

    try {
      const res = await fetch(readyUrl, { signal: AbortSignal.timeout(1200) });
      if (res.status === 200) {
        const body = await res.json().catch(() => ({}));
        if (body.status === 'ready') {
          return true;
        }
      }
    } catch {
      // Backend aún iniciando; continuar esperando
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Tiempo límite agotado (${maxWaitMs}ms) esperando disponibilidad de ${readyUrl}`);
}

async function runCoordinator() {
  // -------------------------------------------------------------------------
  // 1. Verificación de Docker
  // -------------------------------------------------------------------------
  if (!checkDockerAvailable()) {
    console.error(' [Docker] Error: Docker o Docker Compose no están disponibles o el daemon no responde.');
    console.error(' Asegúrate de que Docker Desktop esté instalado y en ejecución antes de iniciar SecureCampus.');
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // 2. Estado de PostgreSQL y arranque
  // -------------------------------------------------------------------------
  const dbStatus = checkPostgresStatus();
  wasDbAlreadyRunning = dbStatus.isRunning && dbStatus.isHealthy;

  if (wasDbAlreadyRunning) {
    console.log(` [Docker] PostgreSQL ya se encontraba en ejecución y saludable (puerto ${DB_PORT}).`);
  } else {
    console.log(` [Docker] Levantando PostgreSQL en puerto ${DB_PORT} mediante Docker Compose...`);
    const up = spawnSync(dockerBin, ['compose', 'up', '-d', '--wait', 'db'], {
      cwd: rootDir,
      stdio: 'inherit',
    });

    if (up.status !== 0) {
      console.error(' [Docker] Error crítico: No se pudo levantar el contenedor de PostgreSQL.');
      process.exit(1);
    }

    startedDbDuringRun = true;
    console.log(` [Docker] PostgreSQL saludable y listo en puerto ${DB_PORT}.`);
  }

  // -------------------------------------------------------------------------
  // 3. Ejecución obligatoria de migraciones
  // -------------------------------------------------------------------------
  console.log(' [Migraciones] Verificando y aplicando migraciones de base de datos...');
  const mig = spawnSync(dockerBin, ['compose', 'run', '--rm', 'migrate'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (mig.status !== 0) {
    console.error(`\n [Migraciones] Error crítico: Fallaron las migraciones de base de datos (código ${mig.status}).`);
    console.error(' Deteniendo el arranque. No se iniciará el backend ni el frontend con migraciones pendientes o erróneas.');
    cleanupAndExit(1);
    return;
  }

  console.log(' [Migraciones] Base de datos sincronizada y migraciones aplicadas correctamente.');

  // -------------------------------------------------------------------------
  // 4. Iniciar Backend Express (con recarga automática de desarrollo)
  // -------------------------------------------------------------------------
  console.log(` [Backend] Iniciando API Express en puerto ${BACKEND_PORT}...`);
  backendProcess = spawn(process.execPath, [tsxBin, 'watch', 'backend/src/server.ts'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(BACKEND_PORT) },
  });

  backendProcess.on('error', (err) => {
    console.error(' [Backend] Error fatal al lanzar el proceso del backend:', err);
    cleanupAndExit(1);
  });

  backendProcess.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      console.error(` [Backend] El proceso del backend terminó inesperadamente (código ${code ?? signal}).`);
      cleanupAndExit(code ?? 1);
    }
  });

  // Esperar a que el backend confirme que está listo con /api/v1/health/ready
  try {
    await waitForBackendReady();
    console.log(` [Backend] API lista y verificada contra PostgreSQL en http://localhost:${BACKEND_PORT}`);
  } catch (readyErr) {
    console.error(` [Backend] Falló la comprobación de disponibilidad:`, readyErr instanceof Error ? readyErr.message : readyErr);
    cleanupAndExit(1);
    return;
  }

  // -------------------------------------------------------------------------
  // 5. Iniciar Frontend Vite
  // -------------------------------------------------------------------------
  console.log(` [Frontend] Iniciando servidor Vite en puerto ${FRONTEND_PORT}...`);
  viteProcess = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  viteProcess.on('error', (err) => {
    console.error(' [Frontend] Error fatal al lanzar el proceso de Vite:', err);
    cleanupAndExit(1);
  });

  viteProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      cleanupAndExit(code ?? 0);
    }
  });

  console.log('\n============================================================');
  console.log('   SecureCampus — Entorno coordinado listo para su uso');
  console.log(`   - Frontend:   http://localhost:${FRONTEND_PORT}`);
  console.log(`   - Backend:    http://localhost:${BACKEND_PORT}`);
  console.log(`   - PostgreSQL: 127.0.0.1:${DB_PORT} (Docker Compose)`);
  console.log('   Presiona Ctrl+C en cualquier momento para apagar ordenadamente.');
  console.log('============================================================\n');
}

runCoordinator().catch((err) => {
  console.error('[SecureCampus] Error no controlado en coordinador:', err);
  cleanupAndExit(1);
});
