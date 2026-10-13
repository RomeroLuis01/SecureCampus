import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRoles, requirePermissions } from '../auth/auth.middleware.js';
import {
  createAcademicGroup,
  updateAcademicGroup,
  getAcademicGroupById,
} from '../academic/group.service.js';
import { AppClientError } from '../middleware/errorHandler.js';

export const groupRouter = Router();

const createGroupSchema = z.object({
  carreraMateriaId: z.string().uuid('ID de plan de materia inválido'),
  periodoAcademicoId: z.string().uuid('ID de periodo académico inválido'),
  claveGrupo: z.string().trim().min(1, 'La clave de grupo es obligatoria').max(30),
  cupoMaximo: z.number().int().positive('El cupo debe ser positivo').optional().nullable(),
  numeroParciales: z
    .number()
    .int('El número de parciales debe ser un entero')
    .min(1, 'El mínimo institucional es 1 parcial')
    .max(6, 'El máximo institucional es 6 parciales'),
});

const updateGroupSchema = z.object({
  cupoMaximo: z.number().int().positive('El cupo debe ser positivo').optional().nullable(),
  numeroParciales: z
    .number()
    .int('El número de parciales debe ser un entero')
    .min(1, 'El mínimo institucional es 1 parcial')
    .max(6, 'El máximo institucional es 6 parciales')
    .optional(),
});

/**
 * POST /api/v1/grupos
 * Creates and opens a new academic group with its configured number of partials.
 * Protected by requireAuth, roles JEFE_CARRERA/ADMINISTRADOR, and permission grupos.crear.
 */
groupRouter.post(
  '/grupos',
  requireAuth,
  requireRoles('JEFE_CARRERA', 'ADMINISTRADOR'),
  requirePermissions('grupos.crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues?.[0]?.message || 'Datos de grupo inválidos';
        throw new AppClientError(msg, 400);
      }

      const group = await createAcademicGroup(parsed.data);
      res.status(201).json(group);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/grupos/:grupoId
 * Retrieves group details and partials configuration.
 */
groupRouter.get(
  '/grupos/:grupoId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const grupoId = Array.isArray(req.params.grupoId) ? req.params.grupoId[0] : req.params.grupoId;
      if (!grupoId) {
        throw new AppClientError('ID de grupo requerido', 400);
      }
      const group = await getAcademicGroupById(grupoId);
      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/grupos/:grupoId
 * Updates group parameters (cupo or numeroParciales).
 * Protected by requireAuth, roles JEFE_CARRERA/ADMINISTRADOR, and permission grupos.actualizar.
 */
groupRouter.patch(
  '/grupos/:grupoId',
  requireAuth,
  requireRoles('JEFE_CARRERA', 'ADMINISTRADOR'),
  requirePermissions('grupos.actualizar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const grupoId = Array.isArray(req.params.grupoId) ? req.params.grupoId[0] : req.params.grupoId;
      if (!grupoId) {
        throw new AppClientError('ID de grupo requerido', 400);
      }
      const parsed = updateGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues?.[0]?.message || 'Datos de actualización inválidos';
        throw new AppClientError(msg, 400);
      }

      const updated = await updateAcademicGroup({
        grupoId,
        ...parsed.data,
      });

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }
);
