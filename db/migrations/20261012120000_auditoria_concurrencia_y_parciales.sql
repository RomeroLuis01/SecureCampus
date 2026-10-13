-- migrate:up
-- ---------------------------------------------------------------------------
-- SecureCampus - Auditoria de concurrencia y sincronizacion de parciales
-- ---------------------------------------------------------------------------

-- 1. Actualizar funcion de validacion de solicitudes con bloqueo de fila FOR SHARE
--    Evita condiciones de carrera ante desactivaciones concurrentes de alumnos.
CREATE OR REPLACE FUNCTION solicitudes.fn_validar_alumno_activo_solicitud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_alumno varchar(20);
    v_es_alumno boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM seguridad.usuarios_roles ur
        JOIN seguridad.roles r ON r.rol_id = ur.rol_id
        WHERE ur.usuario_id = NEW.solicitante_usuario_id AND r.codigo = 'ALUMNO'
    ) INTO v_es_alumno;

    IF NOT v_es_alumno THEN
        SELECT EXISTS (
            SELECT 1
            FROM seguridad.usuarios u
            JOIN academico.alumnos a ON a.persona_id = u.persona_id
            WHERE u.usuario_id = NEW.solicitante_usuario_id
        ) INTO v_es_alumno;
    END IF;

    IF v_es_alumno THEN
        SELECT a.estado INTO v_estado_alumno
        FROM seguridad.usuarios u
        JOIN academico.alumnos a ON a.persona_id = u.persona_id
        WHERE u.usuario_id = NEW.solicitante_usuario_id
        FOR SHARE OF a;

        IF v_estado_alumno IS NULL THEN
            RAISE EXCEPTION 'El solicitante no cuenta con expediente de alumno registrado'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_estado_alumno <> 'ACTIVO' THEN
            RAISE EXCEPTION 'Acceso denegado: Únicamente los alumnos con estatus académico ACTIVO pueden generar solicitudes documentales (estado actual: %)',
                v_estado_alumno
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Trigger para sincronizar calificaciones finales cuando cambia numero_parciales de un grupo
CREATE OR REPLACE FUNCTION academico.fn_sincronizar_calificaciones_cambio_parciales()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.numero_parciales <> OLD.numero_parciales THEN
        -- Si aumento o cambio el numero de parciales, cualquier inscripcion que tenga
        -- menos evaluaciones capturadas que el nuevo numero_parciales pasa a PENDIENTE
        UPDATE academico.calificaciones c
        SET valor_calificacion = NULL,
            estado = 'PENDIENTE',
            capturada_por_usuario_id = NULL,
            capturada_en = NULL,
            actualizado_en = CURRENT_TIMESTAMP
        FROM academico.inscripciones i
        WHERE i.inscripcion_id = c.inscripcion_id
          AND i.grupo_id = NEW.grupo_id
          AND (
              SELECT COUNT(*)
              FROM academico.calificaciones_parciales cp
              WHERE cp.inscripcion_id = i.inscripcion_id
                AND cp.estado = 'CAPTURADA'
                AND cp.numero_parcial <= NEW.numero_parciales
          ) < NEW.numero_parciales;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grupos_sincronizar_calificaciones ON academico.grupos;
CREATE TRIGGER trg_grupos_sincronizar_calificaciones
AFTER UPDATE OF numero_parciales ON academico.grupos
FOR EACH ROW
EXECUTE FUNCTION academico.fn_sincronizar_calificaciones_cambio_parciales();

-- migrate:down
DROP TRIGGER IF EXISTS trg_grupos_sincronizar_calificaciones ON academico.grupos;
DROP FUNCTION IF EXISTS academico.fn_sincronizar_calificaciones_cambio_parciales();

-- Restaurar funcion previa de validacion de solicitudes
CREATE OR REPLACE FUNCTION solicitudes.fn_validar_alumno_activo_solicitud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_alumno varchar(20);
    v_es_alumno boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM seguridad.usuarios_roles ur
        JOIN seguridad.roles r ON r.rol_id = ur.rol_id
        WHERE ur.usuario_id = NEW.solicitante_usuario_id AND r.codigo = 'ALUMNO'
    ) INTO v_es_alumno;

    IF NOT v_es_alumno THEN
        SELECT EXISTS (
            SELECT 1
            FROM seguridad.usuarios u
            JOIN academico.alumnos a ON a.persona_id = u.persona_id
            WHERE u.usuario_id = NEW.solicitante_usuario_id
        ) INTO v_es_alumno;
    END IF;

    IF v_es_alumno THEN
        SELECT a.estado INTO v_estado_alumno
        FROM seguridad.usuarios u
        JOIN academico.alumnos a ON a.persona_id = u.persona_id
        WHERE u.usuario_id = NEW.solicitante_usuario_id;

        IF v_estado_alumno IS NULL THEN
            RAISE EXCEPTION 'El solicitante no cuenta con expediente de alumno registrado'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_estado_alumno <> 'ACTIVO' THEN
            RAISE EXCEPTION 'Acceso denegado: Únicamente los alumnos con estatus académico ACTIVO pueden generar solicitudes documentales (estado actual: %)',
                v_estado_alumno
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
