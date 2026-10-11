import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isWindows = process.platform === 'win32';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const dockerBin = isWindows ? 'docker.exe' : 'docker';

console.log('\n [SecureCampus] Coordinando entorno de desarrollo...');

let dockerStarted = false;

// 1. PostgreSQL y migraciones (espera a que la base esté sana y a que terminen)
const up = spawnSync(dockerBin, ['compose', 'up', '-d', '--wait', 'db'], {
  cwd: rootDir,
  stdio: 'inherit',
});

if (up.status === 0) {
  dockerStarted = true; // para que Ctrl+C apague la base aunque fallen las migraciones
  const mig = spawnSync(dockerBin, ['compose', 'run', '--rm', 'migrate'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (mig.status === 0) {
    console.log(' [Docker] Base de datos lista y migraciones aplicadas.');
  } else {
    console.error(' [Docker] Fallaron las migraciones. Revisa el error de arriba.');
  }
} else {
  console.warn('  [Docker] No se pudo levantar la base. ¿Docker Desktop está iniciado? Continuando con el frontend...');
}

// 2. Servidor Vite con el mismo binario de Node
const vite = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: 'inherit',
});

let isShuttingDown = false;

function cleanupAndExit(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (vite.exitCode === null && !vite.killed) {
    vite.kill();
  }

  if (dockerStarted) {
    console.log('\n [Docker] Deteniendo PostgreSQL para liberar memoria RAM y CPU...');
    try {
      spawnSync(dockerBin, ['compose', 'stop'], {
        cwd: rootDir,
        stdio: 'inherit',
      });
      console.log(' [Docker] Contenedor detenido correctamente. ¡Hasta pronto!\n');
    } catch {
      // Ignorar errores al apagar
    }
  }

  process.exit(code);
}

// Capturar Ctrl+C en Windows
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

vite.on('exit', (code) => cleanupAndExit(code ?? 0));
