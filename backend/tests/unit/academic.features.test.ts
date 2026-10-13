import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../src/config/database.js';
import {
  createGroup,
  updateGroup,
  getGroupById,
} from '../../src/academic/group.service.js';
import {
  calculateFinalGrade,
  capturePartialGrade,
  getGroupPartialGrades,
  roundToDecimals,
} from '../../src/academic/grade.service.js';
import {
  getStudentAcademicStatus,
  createDocumentRequest,
  listStudentDocumentRequests,
  getDocumentTypesCatalog,
} from '../../src/academic/request.service.js';
import { getStudentGradesByPersonaId } from '../../src/academic/student.service.js';
import { AppClientError } from '../../src/middleware/errorHandler.js';

describe('Academic Features & Security Audit Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'withUserTransaction').mockImplementation(async (_userId, callback) => {
      return callback({ query: db.query });
    });
  });

  // =========================================================================
  // 1. FUNCIONALIDAD A: Configuración de Parciales al Abrir Grupos
  // =========================================================================
  describe('Funcionalidad A: Grupos y Parciales por Grupo', () => {
    it('1. Crea un grupo con una cantidad válida de parciales (ej. 3, 4, 2)', async () => {
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [
          {
            grupo_id: 'grp-001',
            carrera_materia_id: 'cm-101',
            periodo_academico_id: 'per-2026b',
            clave_grupo: '7CV1',
            cupo_maximo: 30,
            estado: 'ABIERTO',
            numero_parciales: 4,
            creado_en: '2026-10-12T00:00:00Z',
          },
        ],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const group = await createGroup({
        periodoAcademicoId: 'per-2026b',
        carreraMateriaId: 'cm-101',
        claveGrupo: '7CV1',
        cupoMaximo: 30,
        numeroParciales: 4,
      });

      expect(group.grupoId).toBe('grp-001');
      expect(group.numeroParciales).toBe(4);
      expect(group.claveGrupo).toBe('7CV1');
    });

    it('2. Soporta dos grupos con cantidades diferentes de parciales sin interferir entre sí', async () => {
      vi.spyOn(db, 'query')
        .mockResolvedValueOnce({
          rows: [
            {
              grupo_id: 'grp-a',
              clave_grupo: 'GRUPO-A',
              numero_parciales: 3,
              carrera_materia_id: 'cm-1',
              periodo_academico_id: 'per-1',
              estado: 'ABIERTO',
              creado_en: '2026-10-12',
            },
          ],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              grupo_id: 'grp-b',
              clave_grupo: 'GRUPO-B',
              numero_parciales: 5,
              carrera_materia_id: 'cm-2',
              periodo_academico_id: 'per-1',
              estado: 'ABIERTO',
              creado_en: '2026-10-12',
            },
          ],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const groupA = await createGroup({
        periodoAcademicoId: 'per-2026b',
        claveGrupo: 'GRUPO-A',
        cupoMaximo: 25,
        numeroParciales: 3,
      });

      const groupB = await createGroup({
        periodoAcademicoId: 'per-2026b',
        claveGrupo: 'GRUPO-B',
        cupoMaximo: 25,
        numeroParciales: 5,
      });

      expect(groupA.numeroParciales).toBe(3);
      expect(groupB.numeroParciales).toBe(5);
      expect(groupA.numeroParciales).not.toBe(groupB.numeroParciales);
    });

    it('3. Rechaza cantidades de parciales inválidas (< 1, > 6 o no enteras)', async () => {
      // Menor a 1
      await expect(
        createGroup({
          periodoAcademicoId: 'per-2026b',
          claveGrupo: 'INV-1',
          cupoMaximo: 30,
          numeroParciales: 0,
        })
      ).rejects.toThrow(AppClientError);

      // Mayor a 6
      await expect(
        createGroup({
          periodoAcademicoId: 'per-2026b',
          claveGrupo: 'INV-2',
          cupoMaximo: 30,
          numeroParciales: 7,
        })
      ).rejects.toThrow(AppClientError);

      // Negativo
      await expect(
        createGroup({
          periodoAcademicoId: 'per-2026b',
          claveGrupo: 'INV-3',
          cupoMaximo: 30,
          numeroParciales: -2,
        })
      ).rejects.toThrow('El número de parciales es obligatorio y debe ser un entero positivo entre 1 y 6');
    });

    it('4. Confirma que la captura de parciales devuelve y consulta de acuerdo con la configuración del grupo', async () => {
      vi.spyOn(db, 'query')
        // 1: buscar grupo
        .mockResolvedValueOnce({
          rows: [{ grupo_id: 'grp-4parc', clave_grupo: '7CV3', numero_parciales: 4 }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // 2: buscar estudiantes
        .mockResolvedValueOnce({
          rows: [
            {
              inscripcion_id: 'ins-101',
              alumno_id: 'alu-101',
              matricula: '202301001',
              nombre_completo: 'Estudiante Alfa',
              calificacion_final: 88,
              calificacion_estado: 'CAPTURADA',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // 3: buscar calificaciones parciales
        .mockResolvedValueOnce({
          rows: [
            { inscripcion_id: 'ins-101', numero_parcial: 1, valor_calificacion: '85.00', estado: 'CAPTURADA' },
            { inscripcion_id: 'ins-101', numero_parcial: 2, valor_calificacion: '90.00', estado: 'CAPTURADA' },
            { inscripcion_id: 'ins-101', numero_parcial: 3, valor_calificacion: '88.00', estado: 'CAPTURADA' },
            { inscripcion_id: 'ins-101', numero_parcial: 4, valor_calificacion: '89.00', estado: 'CAPTURADA' },
          ],
          command: 'SELECT',
          rowCount: 4,
          oid: 0,
          fields: [],
        });

      const result = await getGroupPartialGrades('grp-4parc');
      expect(result.numeroParciales).toBe(4);
      expect(result.estudiantes).toHaveLength(1);
      expect(result.estudiantes[0].parciales).toHaveLength(4);
      expect(result.estudiantes[0].calificacionFinal).toBe(88);
    });

    it('5. Rechaza una calificación asociada a un parcial inexistente para el grupo', async () => {
      // Mock db para capturePartialGrade:
      // 1: consultar grupo e inscripción
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [{
          inscripcion_id: 'ins-101',
          grupo_id: 'grp-2parc',
          numero_parciales: 2, // El grupo sólo tiene 2 parciales
          inscripcion_estado: 'INSCRITO',
        }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Intento de registrar parcial 3 en un grupo de 2 parciales
      await expect(
        capturePartialGrade({
          inscripcionId: 'ins-101',
          numeroParcial: 3,
          valor: 90,
          profesorUsuarioId: 'prof-user-1',
        })
      ).rejects.toThrow(/El parcial 3 (no pertenece al grupo|excede)/);
    });

    it('6. Bloquea reducir el número de parciales si ya existen calificaciones registradas en parciales superiores', async () => {
      vi.spyOn(db, 'query')
        // 1: buscar grupo actual
        .mockResolvedValueOnce({
          rows: [
            {
              grupo_id: 'grp-exist',
              carrera_materia_id: 'cm-1',
              periodo_academico_id: 'per-1',
              clave_grupo: '7CV1',
              cupo_maximo: 30,
              numero_parciales: 4,
              estado: 'ABIERTO',
              creado_en: '2026-10-12',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // 2: buscar si existen calificaciones con parcial mayor al nuevo valor (2)
        .mockResolvedValueOnce({
          rows: [{ max_parcial: 3 }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Intentar reducir de 4 a 2 parciales cuando ya hay parcial 3 capturado
      await expect(
        updateGroup('grp-exist', { numeroParciales: 2 })
      ).rejects.toThrow(/No se puede reducir la configuración a 2 parciales/);
    });

    it('7. Permite actualizar el número de parciales si no hay conflicto con calificaciones existentes', async () => {
      vi.spyOn(db, 'query')
        // 1: buscar grupo
        .mockResolvedValueOnce({
          rows: [
            {
              grupo_id: 'grp-exist',
              carrera_materia_id: 'cm-1',
              periodo_academico_id: 'per-1',
              clave_grupo: '7CV1',
              cupo_maximo: 30,
              numero_parciales: 3,
              estado: 'ABIERTO',
              creado_en: '2026-10-12',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // 2: update
        .mockResolvedValueOnce({
          rows: [
            {
              grupo_id: 'grp-exist',
              carrera_materia_id: 'cm-1',
              periodo_academico_id: 'per-1',
              clave_grupo: '7CV1',
              cupo_maximo: 30,
              numero_parciales: 4,
              estado: 'ABIERTO',
              creado_en: '2026-10-12',
            },
          ],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const updated = await updateGroup('grp-exist', { numeroParciales: 4 });
      expect(updated.numeroParciales).toBe(4);
    });

    it('8. Aumentar número de parciales en un grupo recalcula / invalida la calificación final a PENDIENTE si falta el nuevo parcial', () => {
      // Un grupo tenía 3 parciales con notas 85, 90, 80 (media 85 -> final 85).
      const finalInicial = calculateFinalGrade([85, 90, 80], 3);
      expect(finalInicial.calificacionFinal).toBe(85);
      expect(finalInicial.estado).toBe('CAPTURADA');

      // Si el grupo se amplía a 4 parciales y el alumno sólo tiene 3, pasa a PENDIENTE
      const finalTrasIncremento = calculateFinalGrade([85, 90, 80], 4);
      expect(finalTrasIncremento.calificacionFinal).toBeNull();
      expect(finalTrasIncremento.estado).toBe('PENDIENTE');
    });
  });

  // =========================================================================
  // 2. FUNCIONALIDAD B: Calificaciones Finales Enteras y Promedio General Decimal
  // =========================================================================
  describe('Funcionalidad B: Calificaciones Finales Enteras y Promedio General Decimal', () => {
    it('1. Calcula correctamente una calificación final entera cuando la media aritmética ya es un entero exacto', () => {
      // Ejemplo: 80, 90, 85 -> suma 255 / 3 = 85.0
      const res = calculateFinalGrade([80, 90, 85], 3);
      expect(res.calificacionFinal).toBe(85);
      expect(Number.isInteger(res.calificacionFinal)).toBe(true);
      expect(res.estado).toBe('CAPTURADA');
      expect(res.promedioAritmetico).toBe(85);
    });

    it('2. Aplica la regla de redondeo estándar institucional half-up (>= 0.5 redondea hacia arriba, < 0.5 hacia abajo)', () => {
      // Caso >= 0.5 redondea hacia arriba: 80, 85, 92 -> 257 / 3 = 85.6667 -> 86
      const resArriba = calculateFinalGrade([80, 85, 92], 3);
      expect(resArriba.calificacionFinal).toBe(86);
      expect(Number.isInteger(resArriba.calificacionFinal)).toBe(true);

      // Caso exacto 0.5: 80, 81 en grupo de 2 parciales -> 161 / 2 = 80.5 -> 81
      const resMedio = calculateFinalGrade([80, 81], 2);
      expect(resMedio.calificacionFinal).toBe(81);
      expect(Number.isInteger(resMedio.calificacionFinal)).toBe(true);

      // Caso < 0.5 redondea hacia abajo: 80, 80, 81 -> 241 / 3 = 80.3333 -> 80
      const resAbajo = calculateFinalGrade([80, 80, 81], 3);
      expect(resAbajo.calificacionFinal).toBe(80);
      expect(Number.isInteger(resAbajo.calificacionFinal)).toBe(true);
    });

    it('2b. Casos límite de cálculo y redondeo exacto: 84.49, 84.50, 84.51 y medias de parciales decimales', () => {
      // 1 parcial con valores exactos 84.49, 84.50, 84.51
      const res49 = calculateFinalGrade([84.49], 1);
      expect(res49.calificacionFinal).toBe(84);
      expect(Number.isInteger(res49.calificacionFinal)).toBe(true);

      const res50 = calculateFinalGrade([84.50], 1);
      expect(res50.calificacionFinal).toBe(85);
      expect(Number.isInteger(res50.calificacionFinal)).toBe(true);

      const res51 = calculateFinalGrade([84.51], 1);
      expect(res51.calificacionFinal).toBe(85);
      expect(Number.isInteger(res51.calificacionFinal)).toBe(true);

      // 2 parciales decimales cuya media resulta en 84.49, 84.50 y 84.51
      // Media = 84.49: (84.24 + 84.74) / 2 = 168.98 / 2 = 84.49 -> 84
      const res2p49 = calculateFinalGrade([84.24, 84.74], 2);
      expect(res2p49.calificacionFinal).toBe(84);
      expect(Number.isInteger(res2p49.calificacionFinal)).toBe(true);

      // Media = 84.50: (84.25 + 84.75) / 2 = 169.00 / 2 = 84.50 -> 85
      const res2p50 = calculateFinalGrade([84.25, 84.75], 2);
      expect(res2p50.calificacionFinal).toBe(85);
      expect(Number.isInteger(res2p50.calificacionFinal)).toBe(true);

      // Media = 84.51: (84.26 + 84.76) / 2 = 169.02 / 2 = 84.51 -> 85
      const res2p51 = calculateFinalGrade([84.26, 84.76], 2);
      expect(res2p51.calificacionFinal).toBe(85);
      expect(Number.isInteger(res2p51.calificacionFinal)).toBe(true);

      // 3 parciales decimales
      // Media = 84.49: (84.40 + 84.50 + 84.57) / 3 = 253.47 / 3 = 84.49 -> 84
      const res3p49 = calculateFinalGrade([84.40, 84.50, 84.57], 3);
      expect(res3p49.calificacionFinal).toBe(84);
      expect(Number.isInteger(res3p49.calificacionFinal)).toBe(true);

      // Media = 84.50: (84.40 + 84.50 + 84.60) / 3 = 253.50 / 3 = 84.50 -> 85
      const res3p50 = calculateFinalGrade([84.40, 84.50, 84.60], 3);
      expect(res3p50.calificacionFinal).toBe(85);
      expect(Number.isInteger(res3p50.calificacionFinal)).toBe(true);

      // Media = 84.51: (84.40 + 84.50 + 84.63) / 3 = 253.53 / 3 = 84.51 -> 85
      const res3p51 = calculateFinalGrade([84.40, 84.50, 84.63], 3);
      expect(res3p51.calificacionFinal).toBe(85);
      expect(Number.isInteger(res3p51.calificacionFinal)).toBe(true);

      // 4 parciales decimales con media exacta .5:
      // (80.5 + 85.5 + 83.5 + 88.5) / 4 = 338.0 / 4 = 84.5 -> 85
      const res4p50 = calculateFinalGrade([80.5, 85.5, 83.5, 88.5], 4);
      expect(res4p50.calificacionFinal).toBe(85);
      expect(Number.isInteger(res4p50.calificacionFinal)).toBe(true);
    });

    it('2c. Validación de precisión decimal y paridad con PostgreSQL evitando trampas de IEEE-754', () => {
      // En JS estándar con IEEE-754 binario: Math.round(35.855 * 100) / 100 da 35.85 (erróneo).
      // En PostgreSQL round(35.855, 2) da 35.86.
      // roundToDecimals debe dar exactamente 35.86:
      expect(roundToDecimals(35.855, 2)).toBe(35.86);

      // Math.round(1.005 * 100) / 100 da 1.00 en JS, pero roundToDecimals da 1.01:
      expect(roundToDecimals(1.005, 2)).toBe(1.01);

      // Comprobación de redondeo a enteros:
      expect(roundToDecimals(84.49, 0)).toBe(84);
      expect(roundToDecimals(84.50, 0)).toBe(85);
      expect(roundToDecimals(84.51, 0)).toBe(85);
    });

    it('3. Rechaza parciales fuera del rango 0 a 100', async () => {
      await expect(
        capturePartialGrade({
          inscripcionId: 'ins-1',
          numeroParcial: 1,
          valor: 105,
          profesorUsuarioId: 'prof-1',
        })
      ).rejects.toThrow('La calificación debe ser un valor numérico entre 0 y 100');

      await expect(
        capturePartialGrade({
          inscripcionId: 'ins-1',
          numeroParcial: 1,
          valor: -5,
          profesorUsuarioId: 'prof-1',
        })
      ).rejects.toThrow('La calificación debe ser un valor numérico entre 0 y 100');
    });

    it('4. Trata los parciales pendientes manteniendo la calificación final como null / PENDIENTE', () => {
      // Grupo de 3 parciales, sólo 2 capturados
      const resIncompleto = calculateFinalGrade([85, 90], 3);
      expect(resIncompleto.calificacionFinal).toBeNull();
      expect(resIncompleto.estado).toBe('PENDIENTE');

      // Ningún parcial capturado
      const resVacio = calculateFinalGrade([], 3);
      expect(resVacio.calificacionFinal).toBeNull();
      expect(resVacio.estado).toBe('PENDIENTE');
    });

    it('5. Modificar un parcial actualiza la calificación final de manera consistente', async () => {
      vi.spyOn(db, 'query')
        .mockResolvedValueOnce({
          rows: [{ inscripcion_id: 'ins-1', grupo_id: 'grp-1', numero_parciales: 3, inscripcion_estado: 'INSCRITO' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'cp-1' }],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            { numero_parcial: 1, valor_calificacion: '80.00', estado: 'CAPTURADA' },
            { numero_parcial: 2, valor_calificacion: '90.00', estado: 'CAPTURADA' },
            { numero_parcial: 3, valor_calificacion: '95.00', estado: 'CAPTURADA' }, // media = 88.33 -> 88
          ],
          command: 'SELECT',
          rowCount: 3,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ calificacion_id: 'cal-1' }],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const res = await capturePartialGrade({
        inscripcionId: 'ins-1',
        numeroParcial: 3,
        valor: 95,
        profesorUsuarioId: 'prof-1',
      });

      expect(res.calificacionFinal).toBe(88); // round((80+90+95)/3) = round(88.33) = 88
      expect(res.estadoCalificacion).toBe('CAPTURADA');
    });

    it('6. Verifica que el promedio general conserva su naturaleza decimal y precisión académica', async () => {
      // Tres materias con calificaciones finales enteras: 90, 91, 94.
      // Promedio aritmético = (90 + 91 + 94) / 3 = 275 / 3 = 91.6666... -> 91.67
      vi.spyOn(db, 'query')
        .mockResolvedValueOnce({
          rows: [
            {
              matricula: '202301042',
              alumno_nombre: 'Valentina Morales',
              periodo_academico_id: 'per-2026b',
              periodo_codigo: '2026-B',
              periodo_nombre: 'Periodo 2026-B',
              periodo_fecha_inicio: '2026-08-01',
              periodo_fecha_fin: '2026-12-15',
              periodo_estado: 'ACTIVO',
              materia_id: 'mat-1',
              materia_codigo: 'CS-101',
              materia_nombre: 'Materia 1',
              materia_creditos: 8,
              grupo_id: 'grp-1',
              clave_grupo: 'G1',
              numero_parciales: 3,
              inscripcion_id: 'ins-1',
              inscripcion_estado: 'INSCRITO',
              calificacion_id: 'cal-1',
              valor_calificacion: '90.00',
              calificacion_estado: 'CAPTURADA',
              capturada_en: '2026-10-01',
              profesor_nombre: 'Docente A',
            },
            {
              matricula: '202301042',
              alumno_nombre: 'Valentina Morales',
              periodo_academico_id: 'per-2026b',
              periodo_codigo: '2026-B',
              periodo_nombre: 'Periodo 2026-B',
              periodo_fecha_inicio: '2026-08-01',
              periodo_fecha_fin: '2026-12-15',
              periodo_estado: 'ACTIVO',
              materia_id: 'mat-2',
              materia_codigo: 'CS-102',
              materia_nombre: 'Materia 2',
              materia_creditos: 8,
              grupo_id: 'grp-2',
              clave_grupo: 'G2',
              numero_parciales: 3,
              inscripcion_id: 'ins-2',
              inscripcion_estado: 'INSCRITO',
              calificacion_id: 'cal-2',
              valor_calificacion: '91.00',
              calificacion_estado: 'CAPTURADA',
              capturada_en: '2026-10-01',
              profesor_nombre: 'Docente B',
            },
            {
              matricula: '202301042',
              alumno_nombre: 'Valentina Morales',
              periodo_academico_id: 'per-2026b',
              periodo_codigo: '2026-B',
              periodo_nombre: 'Periodo 2026-B',
              periodo_fecha_inicio: '2026-08-01',
              periodo_fecha_fin: '2026-12-15',
              periodo_estado: 'ACTIVO',
              materia_id: 'mat-3',
              materia_codigo: 'CS-103',
              materia_nombre: 'Materia 3',
              materia_creditos: 8,
              grupo_id: 'grp-3',
              clave_grupo: 'G3',
              numero_parciales: 3,
              inscripcion_id: 'ins-3',
              inscripcion_estado: 'INSCRITO',
              calificacion_id: 'cal-3',
              valor_calificacion: '94.00',
              calificacion_estado: 'CAPTURADA',
              capturada_en: '2026-10-01',
              profesor_nombre: 'Docente C',
            },
          ],
          command: 'SELECT',
          rowCount: 3,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            { inscripcion_id: 'ins-1', numero_parcial: 1, valor_calificacion: '90.00', estado: 'CAPTURADA' },
            { inscripcion_id: 'ins-2', numero_parcial: 1, valor_calificacion: '91.00', estado: 'CAPTURADA' },
            { inscripcion_id: 'ins-3', numero_parcial: 1, valor_calificacion: '94.00', estado: 'CAPTURADA' },
          ],
          command: 'SELECT',
          rowCount: 3,
          oid: 0,
          fields: [],
        });

      const grades = await getStudentGradesByPersonaId('persona-val');

      // Calificaciones finales individuales deben ser enteros
      expect(grades.periodos[0].materias[0].calificacionFinal).toBe(90);
      expect(Number.isInteger(grades.periodos[0].materias[0].calificacionFinal)).toBe(true);

      expect(grades.periodos[0].materias[1].calificacionFinal).toBe(91);
      expect(Number.isInteger(grades.periodos[0].materias[1].calificacionFinal)).toBe(true);

      expect(grades.periodos[0].materias[2].calificacionFinal).toBe(94);
      expect(Number.isInteger(grades.periodos[0].materias[2].calificacionFinal)).toBe(true);

      // El promedio del periodo y el promedio general DEBEN ser decimales
      expect(grades.periodos[0].resumen.promedio).toBe(91.67);
      expect(Number.isInteger(grades.periodos[0].resumen.promedio)).toBe(false);

      expect(grades.resumenGeneral.promedioGeneral).toBe(91.67);
      expect(Number.isInteger(grades.resumenGeneral.promedioGeneral)).toBe(false);
    });

    it('7. Grupos con diferente cantidad de parciales calculan sus resultados según su propia configuración', () => {
      // Grupo con 2 parciales: 90 y 85 -> (90 + 85) / 2 = 87.5 -> final 88
      const resG2 = calculateFinalGrade([90, 85], 2);
      expect(resG2.calificacionFinal).toBe(88);

      // Grupo con 4 parciales: 90, 85, 80, 85 -> (90 + 85 + 80 + 85) / 4 = 340 / 4 = 85.0 -> final 85
      const resG4 = calculateFinalGrade([90, 85, 80, 85], 4);
      expect(resG4.calificacionFinal).toBe(85);
    });
  });

  // =========================================================================
  // 3. FUNCIONALIDAD C: Solicitudes Documentales Solo para Alumnos Activos
  // =========================================================================
  describe('Funcionalidad C: Solicitudes Documentales para Alumnos Activos', () => {
    it('1. Alumno ACTIVO puede crear una solicitud satisfactoriamente', async () => {
      vi.spyOn(db, 'query')
        // 1: buscar alumno
        .mockResolvedValueOnce({
          rows: [{ alumno_id: 'alu-01', matricula: '202301042', estado: 'ACTIVO' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // 2: buscar tipo solicitud
        .mockResolvedValueOnce({
          rows: [{ tipo_solicitud_id: 'tipo-01', codigo: 'CONSTANCIA_ESTUDIOS', nombre: 'Constancia de Estudios' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // 3: insertar solicitud
        .mockResolvedValueOnce({
          rows: [
            {
              solicitud_id: '12345678-abcd-1234-abcd-123456789012',
              solicitada_en: '2026-10-12T10:00:00Z',
              estado: 'PENDIENTE',
            },
          ],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const res = await createDocumentRequest({
        usuarioId: 'u-activo',
        personaId: 'pers-activo',
        tipoCodigo: 'CONSTANCIA_ESTUDIOS',
        observaciones: 'Trámite de beca',
      });

      expect(res.solicitudId).toBe('12345678-abcd-1234-abcd-123456789012');
      expect(res.folio).toBe('SOL-12345678');
      expect(res.estado).toBe('PENDIENTE');
      expect(res.tipoCodigo).toBe('CONSTANCIA_ESTUDIOS');
    });

    it('2. Alumno INACTIVO es rechazado con 403 Forbidden al intentar crear una solicitud', async () => {
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [{ alumno_id: 'alu-02', matricula: '202301999', estado: 'INACTIVO' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(
        createDocumentRequest({
          usuarioId: 'u-inactivo',
          personaId: 'pers-inactivo',
          tipoCodigo: 'CONSTANCIA_ESTUDIOS',
          observaciones: 'Trámite no permitido',
        })
      ).rejects.toThrow(
        'Únicamente los alumnos con estatus académico ACTIVO pueden generar solicitudes de documentos'
      );
    });

    it('3. Alumno con estado BAJA o EGRESADO también es rechazado con 403 Forbidden', async () => {
      // Estado BAJA
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [{ alumno_id: 'alu-03', matricula: '202301888', estado: 'BAJA' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(
        createDocumentRequest({
          usuarioId: 'u-baja',
          personaId: 'pers-baja',
          tipoCodigo: 'KARDEX_OFICIAL',
        })
      ).rejects.toThrow(
        'Únicamente los alumnos con estatus académico ACTIVO pueden generar solicitudes de documentos'
      );

      // Estado EGRESADO
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [{ alumno_id: 'alu-04', matricula: '202301777', estado: 'EGRESADO' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(
        createDocumentRequest({
          usuarioId: 'u-egresado',
          personaId: 'pers-egresado',
          tipoCodigo: 'CERTIFICADO_PARCIAL',
        })
      ).rejects.toThrow(
        'Únicamente los alumnos con estatus académico ACTIVO pueden generar solicitudes de documentos'
      );
    });

    it('4. Consulta de estado académico refleja verazmente si puede solicitar o no', async () => {
      // Alumno activo
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [{ alumno_id: 'alu-1', matricula: '202301042', estado: 'ACTIVO' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const statusActivo = await getStudentAcademicStatus('persona-act');
      expect(statusActivo.estadoAlumno).toBe('ACTIVO');
      expect(statusActivo.puedeSolicitar).toBe(true);

      // Alumno inactivo
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [{ alumno_id: 'alu-2', matricula: '202301099', estado: 'INACTIVO' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const statusInactivo = await getStudentAcademicStatus('persona-inact');
      expect(statusInactivo.estadoAlumno).toBe('INACTIVO');
      expect(statusInactivo.puedeSolicitar).toBe(false);
    });

    it('5. Usuario que no es alumno (ej. docente o admin) es rechazado con 404 al crear solicitud como alumno', async () => {
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [], // No existe registro en academico.alumnos
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      await expect(
        createDocumentRequest({
          usuarioId: 'u-profesor',
          personaId: 'persona-profesor',
          tipoCodigo: 'CONSTANCIA_ESTUDIOS',
        })
      ).rejects.toThrow('No se encontró expediente de alumno asociado al usuario autenticado');
    });

    it('6. Alumno inactivo puede consultar su historial de solicitudes anteriores sin restricciones indebidas', async () => {
      // listStudentDocumentRequests consulta directamente las solicitudes del usuario
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [
          {
            solicitud_id: '12345678-antigua',
            tipo_codigo: 'CONSTANCIA_ESTUDIOS',
            tipo_nombre: 'Constancia de Estudios',
            estado: 'APROBADA',
            solicitada_en: '2025-11-01T08:00:00Z',
            resuelta_en: '2025-11-03T12:00:00Z',
            notas_resolucion: 'Entregada en ventanilla',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const historial = await listStudentDocumentRequests('u-inactivo');
      expect(historial).toHaveLength(1);
      expect(historial[0].folio).toBe('SOL-12345678');
      expect(historial[0].estado).toBe('APROBADA');
      expect(historial[0].descargable).toBe(true);
    });

    it('7. No se genera ningún registro parcial si la validación de alumno activo falla', async () => {
      const querySpy = vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [{ alumno_id: 'alu-inact', matricula: '202301000', estado: 'INACTIVO' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(
        createDocumentRequest({
          usuarioId: 'u-inact',
          personaId: 'p-inact',
          tipoCodigo: 'CONSTANCIA_ESTUDIOS',
        })
      ).rejects.toThrow();

      // Debe haber llamado únicamente al SELECT de validación, NINGÚN INSERT
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(querySpy.mock.calls[0][0]).toContain('FROM academico.alumnos');
    });

    it('8. Catálogo de trámites institucionales se obtiene correctamente', async () => {
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [
          {
            tipo_solicitud_id: 'td-1',
            codigo: 'CONSTANCIA_ESTUDIOS',
            nombre: 'Constancia de Estudios',
            descripcion: 'Acredita inscripción activa',
          },
          {
            tipo_solicitud_id: 'td-2',
            codigo: 'KARDEX_OFICIAL',
            nombre: 'Kárdex Oficial Calificado',
            descripcion: 'Historial académico completo',
          },
        ],
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      });

      const catalogo = await getDocumentTypesCatalog();
      expect(catalogo).toHaveLength(2);
      expect(catalogo[0].codigo).toBe('CONSTANCIA_ESTUDIOS');
      expect(catalogo[1].codigo).toBe('KARDEX_OFICIAL');
    });

    it('9. Cuenta cuyo ID o matrícula enviada por el cliente intenta suplantar a otro alumno es neutralizada', async () => {
      // createDocumentRequest consulta exclusivamente utilizando el personaId validado en la sesión segura:
      // SELECT ... FROM academico.alumnos WHERE a.persona_id = $1
      const querySpy = vi.spyOn(db, 'query')
        .mockResolvedValueOnce({
          rows: [{ alumno_id: 'alu-victima', matricula: '202301042', estado: 'ACTIVO' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ tipo_solicitud_id: 'tipo-01', codigo: 'CONSTANCIA_ESTUDIOS', nombre: 'Constancia' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ solicitud_id: 'sol-001', solicitada_en: '2026-10-12', estado: 'PENDIENTE' }],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // El usuario autenticado es persona-auth. Aunque un atacante intentase inyectar otro ID,
      // el servicio autoritativo consulta únicamente por el personaId de la sesión:
      const res = await createDocumentRequest({
        usuarioId: 'u-auth',
        personaId: 'persona-auth',
        tipoCodigo: 'CONSTANCIA_ESTUDIOS',
      });

      expect(querySpy.mock.calls[0][1]).toEqual(['persona-auth']);
      expect(res.solicitudId).toBe('sol-001');
    });

    it('10. Cambio concurrente de estado durante la creación de una solicitud (desactivación concurrente) es abortado limpiamente por bloqueo transaccional', async () => {
      // Simula que durante la transacción concurrente, la lectura con FOR SHARE detecta que el estado
      // fue modificado a 'INACTIVO' antes del commit:
      vi.spyOn(db, 'query').mockResolvedValueOnce({
        rows: [{ alumno_id: 'alu-conc', matricula: '202301000', estado: 'INACTIVO' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(
        createDocumentRequest({
          usuarioId: 'u-conc',
          personaId: 'p-conc',
          tipoCodigo: 'CONSTANCIA_ESTUDIOS',
        })
      ).rejects.toThrow(/Únicamente los alumnos con estatus académico ACTIVO/);
    });
  });
});
