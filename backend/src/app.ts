import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { createErrorHandler, CorsOriginError } from './middleware/errorHandler.js';
import type { EnvConfig } from './config/env.js';

export function createApp(config: EnvConfig): express.Express {
  const app = express();

  // Security headers via Helmet
  app.use(helmet());

  // Restrictive CORS configuration
  const allowedOrigins = config.corsOrigins;
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no Origin header (e.g. server-to-server, curl, health probes)
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new CorsOriginError(`Origin '${origin}' not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      optionsSuccessStatus: 204,
    })
  );

  // Cookie parsing for secure HttpOnly session tokens
  app.use(cookieParser());

  // Body parsing with safe size limits
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Versioned API routes
  app.use('/api/v1', apiRouter);

  // 404 Handler for unmatched routes
  app.use(notFoundHandler);

  // Centralized Error Handler
  const isProduction = config.NODE_ENV === 'production';
  app.use(createErrorHandler(isProduction));

  return app;
}
