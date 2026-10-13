import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { authRouter } from './auth.route.js';
import { studentRouter } from './student.route.js';
import { groupRouter } from './group.route.js';
import { gradeRouter } from './grade.route.js';
import { requestRouter } from './request.route.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(studentRouter);
apiRouter.use(groupRouter);
apiRouter.use(gradeRouter);
apiRouter.use(requestRouter);
