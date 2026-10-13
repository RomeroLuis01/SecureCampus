import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRoles, requirePermissions } from '../auth/auth.middleware.js';
import { capturePartialGrade, getGroupGrades } from '../academic/grade.service.js';
import { AppClientError } from '../middleware/errorHandler.js';

export const gradeRouter = Router();

const captureGradeSchema = z.object({
  inscripcionId: z.string().uuid('ID de inscripción inválido'),
  numeroParcial: z
    .number()
    .int('El parcial debe ser un número entero')
    .min(1, 'El parcial debe ser mayor o igual a 1')
    .max(6, 'El parcial no puede ser mayor a 6'),
  valorCalificacion: z
    .number()
    .min(0, 'La calificación mínima es 0')
    .max(100, 'La calificación máxima es 100'),
});

/**
 * GET /api/v1/profesor/grupos/:grupoId/calificaciones
 * Retrieves group roster, configured partials, and student grade matrix.
 * Protected by requireAuth, PROFESOR role, and calificaciones.leer.asignadas.
 */
gradeRouter.get(
  '/profesor/grupos/:grupoId/calificaciones',
  requireAuth,
  requireRoles('PROFESOR'),
  requirePermissions('calificaciones.leer.asignadas'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const grupoId = Array.isArray(req.params.grupoId) ? req.params.grupoId[0] : req.params.grupoId;
      if (!grupoId) {
        throw new AppClientError('ID de grupo requerido', 400);
      }
      const groupGrades = await getGroupGrades(grupoId);
      res.status(200).json(groupGrades);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/profesor/grupos/:grupoId/calificaciones/parcial
 * Captures a partial grade for a student and recalculates the integer final grade.
 * Protected by requireAuth, PROFESOR role, and calificaciones.escribir.asignadas.
 */
gradeRouter.post(
  '/profesor/grupos/:grupoId/calificaciones/parcial',
  requireAuth,
  requireRoles('PROFESOR'),
  requirePermissions('calificaciones.escribir.asignadas'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = captureGradeSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues?.[0]?.message || 'Datos de captura de calificación inválidos';
        throw new AppClientError(errorMsg, 400);
      }

      const profesorUsuarioId = req.user?.usuarioId;
      if (!profesorUsuarioId) {
        throw new AppClientError('No se encontró identidad de profesor en la sesión', 400);
      }

      const result = await capturePartialGrade({
        ...parsed.data,
        profesorUsuarioId,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);
