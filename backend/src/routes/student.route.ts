import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';
import { getStudentGradesByPersonaId } from '../academic/student.service.js';
import { AppClientError } from '../middleware/errorHandler.js';

export const studentRouter = Router();

/**
 * GET /api/v1/estudiante/calificaciones
 * Returns grades and academic periods for the authenticated student.
 * Protected by requireAuth and requireRoles('ALUMNO').
 * Student identity is derived exclusively from the verified server-side session.
 */
studentRouter.get(
  '/estudiante/calificaciones',
  requireAuth,
  requireRoles('ALUMNO'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const personaId = req.user?.personaId;
      if (!personaId) {
        throw new AppClientError('No se encontró identidad de persona asociada a la sesión', 400);
      }

      const gradesData = await getStudentGradesByPersonaId(personaId);

      res.status(200).json(gradesData);
    } catch (error) {
      next(error);
    }
  }
);
