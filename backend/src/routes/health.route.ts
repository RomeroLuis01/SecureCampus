import { Router } from 'express';
import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/database.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const isReady = await checkDatabaseConnection();
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(503).json({
      status: 'not_ready',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

