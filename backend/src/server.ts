import { config } from './config/env.js';
import { createApp } from './app.js';
import { closePool } from './config/database.js';
import type { Server } from 'node:http';

const app = createApp(config);

const server: Server = app.listen(config.PORT, () => {
  console.log(`[SecureCampus Backend] HTTP server listening on port ${config.PORT} (NODE_ENV: ${config.NODE_ENV})`);
  console.log(`[SecureCampus Backend] Health endpoint: http://localhost:${config.PORT}/api/v1/health`);
  console.log(`[SecureCampus Backend] Ready endpoint: http://localhost:${config.PORT}/api/v1/health/ready`);
});

let isShuttingDown = false;
let emergencyTimer: NodeJS.Timeout | null = null;

export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`[SecureCampus Backend] Received ${signal}. Starting graceful shutdown...`);

  // Emergency timeout: force process termination if graceful shutdown exceeds 5000ms
  emergencyTimer = setTimeout(() => {
    console.error('[SecureCampus Backend] Emergency timeout exceeded (5000ms). Forcing process exit.');
    server.closeAllConnections?.();
    process.exit(1);
  }, 5000);
  emergencyTimer.unref();

  // 1. Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      console.error('[SecureCampus Backend] Error closing HTTP server:', err.message);
      try {
        await closePool();
      } catch (poolErr) {
        console.error('[SecureCampus Backend] Error closing database pool during failed server shutdown:', poolErr instanceof Error ? poolErr.message : 'Unknown error');
      }
      if (emergencyTimer) {
        clearTimeout(emergencyTimer);
        emergencyTimer = null;
      }
      process.exit(1);
    }

    console.log('[SecureCampus Backend] HTTP server closed cleanly. Closing database pool...');

    // 2. All in-flight requests have now completed. Safely close database pool.
    try {
      await closePool();
      if (emergencyTimer) {
        clearTimeout(emergencyTimer);
        emergencyTimer = null;
      }
      console.log('[SecureCampus Backend] Graceful shutdown completed. Process terminating.');
      process.exit(0);
    } catch (poolErr) {
      if (emergencyTimer) {
        clearTimeout(emergencyTimer);
        emergencyTimer = null;
      }
      console.error('[SecureCampus Backend] Error closing database pool:', poolErr instanceof Error ? poolErr.message : 'Unknown error');
      process.exit(1);
    }
  });

  // 3. Close idle Keep-Alive connections immediately so they don't block server.close()
  server.closeIdleConnections?.();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export { app, server };
