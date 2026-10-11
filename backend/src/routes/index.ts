import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { authRouter } from './auth.route.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
