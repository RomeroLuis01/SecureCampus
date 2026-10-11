import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { authRouter } from './auth.route.js';
import { studentRouter } from './student.route.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(studentRouter);
