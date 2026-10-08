import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isWindows = process.platform === 'win32';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const dockerBin = isWindows ? 'docker.exe' : 'docker';

console.log('\n📦 [SecureCampus] Coordinando entorno de desarrollo...');

let dockerStarted = false;

// 1. Iniciar PostgreSQL en segundo plano con Docker
try {
  console.log('🐳 [Docker] Levantando base de datos y ejecutando migraciones...');
  const res = spawnSync(dockerBin, ['compose', 'up', '-d'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (res.status === 0) {
    dockerStarted = true;
    console.log('✅ [Docker] Base de datos activa en puerto 5433.');
  } else {
    console.warn('⚠️  [Docker] No se pudo levantar el contenedor. ¿Docker Desktop está iniciado? Continuando con el frontend...');
  }
} catch {
  console.warn('⚠️  [Docker] Docker CLI no disponible. Continuando con el frontend...');
}

// 2. Iniciar el servidor Vite con el mismo binario de Node
const vite = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: 'inherit',
});

let isShuttingDown = false;

function cleanupAndExit() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (dockerStarted) {
    console.log('\n🛑 [Docker] Deteniendo PostgreSQL para liberar memoria RAM y CPU...');
    try {
      spawnSync(dockerBin, ['compose', 'stop'], {
        cwd: rootDir,
        stdio: 'inherit',
      });
      console.log('💤 [Docker] Contenedor detenido correctamente. ¡Hasta pronto!\n');
    } catch {
      // Ignorar errores al apagar
    }
  }

  process.exit(0);
}

// Capturar Ctrl+C en Windows
if (isWindows && process.stdin.isTTY) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.on('SIGINT', () => {
    cleanupAndExit();
  });
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

vite.on('exit', () => {
  cleanupAndExit();
});
