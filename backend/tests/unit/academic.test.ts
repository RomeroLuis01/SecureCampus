import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import * as db from '../../src/config/database.js';
import { getStudentGradesByPersonaId } from '../../src/academic/student.service.js';
import { studentRouter } from '../../src/routes/student.route.js';
import { requireAuth, requireRoles } from '../../src/auth/auth.middleware.js';
import { AppClientError } from '../../src/middleware/errorHandler.js';
import { getStudentGrades } from '../../../src/services/academicClient.js';

describe('Academic Module - Student Grades Consultation Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Service Level: getStudentGradesByPersonaId
  // ---------------------------------------------------------------------------
  describe('student.service - getStudentGradesByPersonaId', () => {
    it('1. retrieves and groups grades properly for an authenticated student with records', async () => {
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [
          {
            matricula: '202301042',
            alumno_nombre: 'Valentina Morales',
            periodo_academico_id: 'per-2026b',
            periodo_codigo: '2026-B',
            periodo_nombre: 'Periodo 2026-B (Semestre en curso)',
            periodo_fecha_inicio: '2026-08-01',
            periodo_fecha_fin: '2026-12-15',
            periodo_estado: 'ACTIVO',
            materia_id: 'mat-601',
            materia_codigo: 'CS-601',
            materia_nombre: 'Seguridad en Aplicaciones Web',
            materia_creditos: 8,
            grupo_id: 'g-601a',
            clave_grupo: 'G-601A',
            inscripcion_id: 'ins-1',
            inscripcion_estado: 'INSCRITO',
            calificacion_id: 'cal-1',
            valor_calificacion: '95.00',
            calificacion_estado: 'CAPTURADA',
            capturada_en: '2026-09-20T10:00:00Z',
            profesor_nombre: 'Dr. Antonio Méndez',
          },
          {
            matricula: '202301042',
            alumno_nombre: 'Valentina Morales',
            periodo_academico_id: 'per-2026b',
            periodo_codigo: '2026-B',
            periodo_nombre: 'Periodo 2026-B (Semestre en curso)',
            periodo_fecha_inicio: '2026-08-01',
            periodo_fecha_fin: '2026-12-15',
            periodo_estado: 'ACTIVO',
            materia_id: 'mat-603',
            materia_codigo: 'CS-603',
            materia_nombre: 'Análisis Forense',
            materia_creditos: 8,
            grupo_id: 'g-603a',
            clave_grupo: 'G-603A',
            inscripcion_id: 'ins-2',
            inscripcion_estado: 'INSCRITO',
            calificacion_id: null,
            valor_calificacion: null,
            calificacion_estado: 'PENDIENTE',
            capturada_en: null,
            profesor_nombre: 'Dr. Antonio Méndez',
          },
          {
            matricula: '202301042',
            alumno_nombre: 'Valentina Morales',
            periodo_academico_id: 'per-2026a',
            periodo_codigo: '2026-A',
            periodo_nombre: 'Periodo 2026-A (Semestre previo)',
            periodo_fecha_inicio: '2026-01-15',
            periodo_fecha_fin: '2026-06-30',
            periodo_estado: 'CERRADO',
            materia_id: 'mat-602',
            materia_codigo: 'CS-602',
            materia_nombre: 'Criptografía Aplicada',
            materia_creditos: 8,
            grupo_id: 'g-602a',
            clave_grupo: 'G-602A',
            inscripcion_id: 'ins-3',
            inscripcion_estado: 'COMPLETADA',
            calificacion_id: 'cal-3',
            valor_calificacion: '92.00',
            calificacion_estado: 'CAPTURADA',
            capturada_en: '2026-06-28T10:00:00Z',
            profesor_nombre: 'Dr. Antonio Méndez',
          },
        ],
        command: 'SELECT',
        rowCount: 3,
        oid: 0,
        fields: [],
      });

      const result = await getStudentGradesByPersonaId('persona-val-123');

      expect(result.matricula).toBe('202301042');
      expect(result.alumnoNombre).toBe('Valentina Morales');
      expect(result.periodos).toHaveLength(2);

      // Periodo 2026-B
      const p2026b = result.periodos.find((p) => p.codigo === '2026-B');
      expect(p2026b).toBeDefined();
      expect(p2026b!.esActivo).toBe(true);
      expect(p2026b!.materias).toHaveLength(2);
      expect(p2026b!.resumen.promedio).toBe(95);
      expect(p2026b!.resumen.creditosAprobados).toBe(8);

      // Materia con calificacion capturada
      const mat601 = p2026b!.materias.find((m) => m.codigo === 'CS-601');
      expect(mat601!.calificacionFinal).toBe(95);
      expect(mat601!.estado).toBe('APROBADA');
      expect(mat601!.estadoCalificacion).toBe('CAPTURADA');

      // Materia pendiente
      const mat603 = p2026b!.materias.find((m) => m.codigo === 'CS-603');
      expect(mat603!.calificacionFinal).toBeNull();
      expect(mat603!.estado).toBe('PENDIENTE');
      expect(mat603!.estadoCalificacion).toBe('PENDIENTE');

      // Resumen General
      expect(result.resumenGeneral.promedioGeneral).toBe(93.5); // (95 + 92) / 2
      expect(result.resumenGeneral.creditosTotalesAprobados).toBe(16);
      expect(result.resumenGeneral.totalMateriasCursadas).toBe(3);
    });

    it('2. returns empty periods array cleanly when student has no enrolled courses', async () => {
      // First query (grades) returns empty
      vi.spyOn(db, 'query')
        .mockResolvedValueOnce({
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        // Second query (student info) returns student row
        .mockResolvedValueOnce({
          rows: [{ matricula: '202309999', nombre_completo: 'Alumno Nuevo' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const result = await getStudentGradesByPersonaId('persona-new-456');

      expect(result.matricula).toBe('202309999');
      expect(result.alumnoNombre).toBe('Alumno Nuevo');
      expect(result.periodos).toEqual([]);
      expect(result.resumenGeneral.promedioGeneral).toBeNull();
      expect(result.resumenGeneral.creditosTotalesAprobados).toBe(0);
      expect(result.resumenGeneral.totalMateriasCursadas).toBe(0);
    });

    it('3. bubbles database query errors to caller', async () => {
      vi.spyOn(db, 'query').mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

      await expect(getStudentGradesByPersonaId('persona-err')).rejects.toThrow(
        'Connection terminated unexpectedly'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Authorization & Isolation: Route Middleware Defense
  // ---------------------------------------------------------------------------
  describe('studentRouter - Authorization & Security Constraints', () => {
    it('4. rejects request with 401 when no session cookie is provided', async () => {
      const req = {
        method: 'GET',
        headers: {},
        cookies: {},
      } as unknown as Request;

      const res = {
        clearCookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppClientError));
      const err = next.mock.calls[0][0] as AppClientError;
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain('No autenticado: sesión requerida');
    });

    it('5. rejects request with 403 when authenticated user lacks ALUMNO role (e.g. PROFESOR)', () => {
      const req = {
        user: {
          usuarioId: 'u-docente',
          personaId: 'p-docente',
          nombreCompleto: 'Dr. Méndez',
          correo: 'a.mendez@securecampus.edu',
          estado: 'ACTIVO',
          roles: [{ rolId: 'r-prof', codigo: 'PROFESOR', carreraId: null }],
          permisos: ['calificaciones.leer.asignadas'],
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = vi.fn();

      const middleware = requireRoles('ALUMNO');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppClientError));
      const err = next.mock.calls[0][0] as AppClientError;
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain('Acceso denegado: rol insuficiente');
    });

    it('6. rejects request with 403 when authenticated user account is SUSPENDIDO', async () => {
      // Mock session validation valid
      vi.spyOn(await import('../../src/auth/session.service.js'), 'validateSession').mockResolvedValueOnce({
        isValid: true,
        usuarioId: 'u-suspended',
      });

      // Mock user profile with estado SUSPENDIDO
      vi.spyOn(await import('../../src/auth/auth.service.js'), 'getUserProfile').mockResolvedValueOnce({
        usuarioId: 'u-suspended',
        personaId: 'p-suspended',
        nombreCompleto: 'Alumno Suspendido',
        correo: 'sus@securecampus.edu',
        estado: 'SUSPENDIDO',
        roles: [{ rolId: 'r-alu', codigo: 'ALUMNO', carreraId: null }],
        permisos: [],
      });

      const req = {
        method: 'GET',
        headers: {},
        cookies: { sc_session: 'some-token' },
      } as unknown as Request;

      const res = {
        clearCookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppClientError));
      const err = next.mock.calls[0][0] as AppClientError;
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain('Cuenta suspendida o inactiva');
    });

    it('7. completely ignores client query/params attempting to target another student', async () => {
      const querySpy = vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      }).mockResolvedValueOnce({
        rows: [{ matricula: '202301042', nombre_completo: 'Valentina Morales' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Attacker tries injecting ?matricula=999999999 or ?personaId=other-uuid
      const req = {
        user: {
          usuarioId: 'u-student',
          personaId: 'legit-persona-id',
          nombreCompleto: 'Valentina Morales',
          correo: 'v.morales@securecampus.edu',
          estado: 'ACTIVO',
          roles: [{ rolId: 'r-alu', codigo: 'ALUMNO', carreraId: null }],
          permisos: ['calificaciones.leer.propias'],
        },
        query: {
          matricula: 'victim-matricula',
          personaId: 'victim-persona-id',
          alumnoId: 'victim-alumno-id',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      // Invoke the route handler
      const personaId = req.user!.personaId;
      const data = await getStudentGradesByPersonaId(personaId);
      res.status(200).json(data);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.persona_id = $1'),
        ['legit-persona-id'] // Parameter MUST strictly be legit-persona-id from req.user
      );
      expect(querySpy).not.toHaveBeenCalledWith(
        expect.anything(),
        ['victim-persona-id']
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Frontend Client Level: academicClient.ts
  // ---------------------------------------------------------------------------
  describe('academicClient - Frontend API integration', () => {
    it('8. getStudentGrades parses successful JSON response and credentials: include', async () => {
      const mockPayload = {
        matricula: '202301042',
        alumnoNombre: 'Valentina Morales',
        periodos: [
          {
            periodoId: 'per-1',
            codigo: '2026-B',
            nombre: 'Periodo 2026-B',
            esActivo: true,
            materias: [],
            resumen: { promedio: 95, creditosAprobados: 8, totalMaterias: 1 },
          },
        ],
        resumenGeneral: {
          promedioGeneral: 95,
          creditosTotalesAprobados: 8,
          totalMateriasCursadas: 1,
        },
      };

      const fetchSpy = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await getStudentGrades();

      expect(result).toEqual(mockPayload);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/estudiante/calificaciones',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('9. getStudentGrades throws 401 AuthApiError when session is expired', async () => {
      const fetchSpy = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Sesión expirada' } }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(getStudentGrades()).rejects.toThrow('Sesión requerida o expirada');
    });

    it('10. getStudentGrades throws 403 AuthApiError when role is insufficient', async () => {
      const fetchSpy = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Rol insuficiente' } }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(getStudentGrades()).rejects.toThrow('Acceso denegado: rol de estudiante requerido');
    });
  });
});
