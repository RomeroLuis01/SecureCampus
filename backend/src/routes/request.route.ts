import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRoles, requirePermissions } from '../auth/auth.middleware.js';
import {
  createDocumentRequest,
  getStudentRequests,
  getStudentAcademicStatus,
  getActiveRequestTypes,
} from '../academic/request.service.js';
import { AppClientError } from '../middleware/errorHandler.js';

export const requestRouter = Router();

const createRequestSchema = z.object({
  tipoCodigo: z.string().trim().min(1, 'El tipo de trámite es requerido').max(50),
  observaciones: z.string().trim().max(1000).optional(),
});

/**
 * GET /api/v1/estudiante/estado-academico
 * Returns the student's authoritative academic standing and eligibility to request documents.
 * Protected by requireAuth and requireRoles('ALUMNO').
 */
requestRouter.get(
  '/estudiante/estado-academico',
  requireAuth,
  requireRoles('ALUMNO'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const personaId = req.user?.personaId;
      if (!personaId) {
        throw new AppClientError('No se encontró identidad de persona en la sesión', 400);
      }

      const status = await getStudentAcademicStatus(personaId);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/estudiante/solicitudes
 * Lists all previous document requests for the authenticated student.
 * Permitted for inactive students to allow historical record consultation.
 * Protected by requireAuth, requireRoles('ALUMNO'), and permission solicitudes.leer.propias.
 */
requestRouter.get(
  '/estudiante/solicitudes',
  requireAuth,
  requireRoles('ALUMNO'),
  requirePermissions('solicitudes.leer.propias'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const usuarioId = req.user?.usuarioId;
      if (!usuarioId) {
        throw new AppClientError('No se encontró identidad de usuario en la sesión', 400);
      }

      const requests = await getStudentRequests(usuarioId);
      res.status(200).json(requests);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/estudiante/solicitudes
 * Creates a new document request. Strictly enforces active student standing.
 * Protected by requireAuth, requireRoles('ALUMNO'), and permission solicitudes.crear.propias.
 */
requestRouter.post(
  '/estudiante/solicitudes',
  requireAuth,
  requireRoles('ALUMNO'),
  requirePermissions('solicitudes.crear.propias'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const usuarioId = req.user?.usuarioId;
      const personaId = req.user?.personaId;

      if (!usuarioId || !personaId) {
        throw new AppClientError('No se encontró identidad autenticada completa en la sesión', 400);
      }

      const parsed = createRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues?.[0]?.message || 'Datos de solicitud inválidos';
        throw new AppClientError(msg, 400);
      }

      const newRequest = await createDocumentRequest({
        usuarioId,
        personaId,
        tipoCodigo: parsed.data.tipoCodigo,
        observaciones: parsed.data.observaciones,
      });

      res.status(201).json(newRequest);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/estudiante/solicitudes/tipos
 * Returns the catalog of active document request types.
 * Protected by requireAuth and requireRoles('ALUMNO').
 */
requestRouter.get(
  '/estudiante/solicitudes/tipos',
  requireAuth,
  requireRoles('ALUMNO'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const types = await getActiveRequestTypes();
      res.status(200).json(types);
    } catch (error) {
      next(error);
    }
  }
);
