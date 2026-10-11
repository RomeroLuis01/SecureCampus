import { config } from './config/env.js';
import { createApp } from './app.js';
import type { Server } from 'node:http';

const app = createApp(config);

const server: Server = app.listen(config.PORT, () => {
  console.log(`[SecureCampus Backend] HTTP server listening on port ${config.PORT} (NODE_ENV: ${config.NODE_ENV})`);
  console.log(`[SecureCampus Backend] Health endpoint: http://localhost:${config.PORT}/api/v1/health`);
});

function gracefulShutdown(signal: string): void {
  console.log(`[SecureCampus Backend] Received ${signal}. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error('[SecureCampus Backend] Error during server close:', err.message);
      process.exit(1);
    }
    console.log('[SecureCampus Backend] HTTP server closed cleanly. Process terminating.');
    process.exit(0);
  });

  // Force exit if connections take too long to close
  setTimeout(() => {
    console.error('[SecureCampus Backend] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export { app, server };
