-- migrate:up
-- ---------------------------------------------------------------------------
-- SecureCampus - Parciales por grupo, final entera y solicitudes activas
-- PostgreSQL 16 / dbmate
-- ---------------------------------------------------------------------------

-- 1. Agregar numero_parciales a academico.grupos con rango institucional [1, 6]
ALTER TABLE academico.grupos
    ADD COLUMN numero_parciales integer NOT NULL DEFAULT 3;

ALTER TABLE academico.grupos
    ADD CONSTRAINT ck_grupos_numero_parciales
        CHECK (numero_parciales >= 1 AND numero_parciales <= 6);

COMMENT ON COLUMN academico.grupos.numero_parciales IS
'Numero de evaluaciones parciales configuradas para el grupo al momento de su apertura (rango reglamentario 1 a 6, por defecto 3).';

-- 2. Restriccion de calificacion final entera en academico.calificaciones
ALTER TABLE academico.calificaciones
    ADD CONSTRAINT ck_calificaciones_final_entera
        CHECK (valor_calificacion IS NULL OR valor_calificacion = round(valor_calificacion));

COMMENT ON CONSTRAINT ck_calificaciones_final_entera ON academico.calificaciones IS
'La calificacion final oficial de la materia debe ser un numero entero sin parte decimal.';

-- 3. Tabla relacional de calificaciones por parcial
CREATE TABLE academico.calificaciones_parciales (
    calificacion_parcial_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id             uuid NOT NULL,
    numero_parcial             integer NOT NULL,
    valor_calificacion         numeric(5,2),
    estado                     varchar(20) NOT NULL DEFAULT 'PENDIENTE',
    capturada_por_usuario_id   uuid,
    capturada_en               timestamptz,
    actualizada_por_usuario_id uuid,
    creado_en                  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en             timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_calificaciones_parciales_inscripcion_numero
        UNIQUE (inscripcion_id, numero_parcial),
    CONSTRAINT ck_calificaciones_parciales_numero
        CHECK (numero_parcial >= 1 AND numero_parcial <= 6),
    CONSTRAINT ck_calificaciones_parciales_estado
        CHECK (estado IN ('PENDIENTE', 'CAPTURADA')),
    CONSTRAINT ck_calificaciones_parciales_rango
        CHECK (
            valor_calificacion IS NULL
            OR (valor_calificacion >= 0 AND valor_calificacion <= 100)
        ),
    CONSTRAINT ck_calificaciones_parciales_coherencia
        CHECK (
            (estado = 'PENDIENTE'
                AND valor_calificacion IS NULL
                AND capturada_por_usuario_id IS NULL
                AND capturada_en IS NULL)
         OR (estado = 'CAPTURADA'
                AND valor_calificacion IS NOT NULL
                AND capturada_por_usuario_id IS NOT NULL
                AND capturada_en IS NOT NULL)
        ),
    CONSTRAINT fk_calificaciones_parciales_inscripcion
        FOREIGN KEY (inscripcion_id)
        REFERENCES academico.inscripciones (inscripcion_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_calificaciones_parciales_capturada_por
        FOREIGN KEY (capturada_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_calificaciones_parciales_actualizada_por
        FOREIGN KEY (actualizada_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE academico.calificaciones_parciales IS
'Evaluaciones parciales capturadas para cada inscripcion segun el numero de parciales configurado en el grupo.';

CREATE INDEX ix_calificaciones_parciales_inscripcion
    ON academico.calificaciones_parciales (inscripcion_id);

CREATE INDEX ix_calificaciones_parciales_capturada_por
    ON academico.calificaciones_parciales (capturada_por_usuario_id);

-- 4. Trigger: Validar que el parcial pertenezca al grupo (numero_parcial <= grupo.numero_parciales)
CREATE OR REPLACE FUNCTION academico.fn_validar_parcial_pertenece_grupo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_numero_parciales integer;
    v_estado_inscripcion varchar(20);
BEGIN
    SELECT g.numero_parciales, i.estado
    INTO v_numero_parciales, v_estado_inscripcion
    FROM academico.inscripciones i
    JOIN academico.grupos g ON g.grupo_id = i.grupo_id
    WHERE i.inscripcion_id = NEW.inscripcion_id;

    IF v_numero_parciales IS NULL THEN
        RAISE EXCEPTION 'No se encontro el grupo correspondiente a la inscripcion %', NEW.inscripcion_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF v_estado_inscripcion NOT IN ('INSCRITO', 'COMPLETADA') THEN
        RAISE EXCEPTION 'No se puede capturar calificacion parcial: la inscripcion % esta en estado %',
            NEW.inscripcion_id, v_estado_inscripcion
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NEW.numero_parcial > v_numero_parciales THEN
        RAISE EXCEPTION 'El parcial % no pertenece al grupo: el grupo solo tiene % parcial(es) configurados',
            NEW.numero_parcial, v_numero_parciales
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calificaciones_parciales_validar_grupo
BEFORE INSERT OR UPDATE ON academico.calificaciones_parciales
FOR EACH ROW
EXECUTE FUNCTION academico.fn_validar_parcial_pertenece_grupo();

-- 5. Trigger: Impedir reduccion de numero_parciales en grupo si existen calificaciones en parciales que se perderian
CREATE OR REPLACE FUNCTION academico.fn_proteger_cambio_parciales_grupo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_parcial_existente integer;
BEGIN
    IF NEW.numero_parciales < OLD.numero_parciales THEN
        SELECT COALESCE(MAX(cp.numero_parcial), 0) INTO v_max_parcial_existente
        FROM academico.inscripciones i
        JOIN academico.calificaciones_parciales cp ON cp.inscripcion_id = i.inscripcion_id
        WHERE i.grupo_id = NEW.grupo_id AND cp.estado = 'CAPTURADA';

        IF v_max_parcial_existente > NEW.numero_parciales THEN
            RAISE EXCEPTION 'No se puede reducir a % parciales: el grupo ya tiene calificaciones registradas en el parcial %',
                NEW.numero_parciales, v_max_parcial_existente
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grupos_proteger_parciales
BEFORE UPDATE OF numero_parciales ON academico.grupos
FOR EACH ROW
EXECUTE FUNCTION academico.fn_proteger_cambio_parciales_grupo();

-- 6. Trigger: Validar que solo alumnos activos puedan generar solicitudes documentales
CREATE OR REPLACE FUNCTION solicitudes.fn_validar_alumno_activo_solicitud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_alumno varchar(20);
    v_es_alumno boolean;
BEGIN
    -- Comprobar si el solicitante es un alumno
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

CREATE TRIGGER trg_solicitudes_solo_alumnos_activos
BEFORE INSERT ON solicitudes.solicitudes
FOR EACH ROW
EXECUTE FUNCTION solicitudes.fn_validar_alumno_activo_solicitud();

-- 7. Asegurar tipos de solicitud adicionales si no existen
INSERT INTO solicitudes.tipos_solicitud (codigo, nombre, descripcion)
VALUES
    ('SOBRECUPO', 'Autorización de Sobrecupo', 'Solicitud de cupo adicional en grupo académico.'),
    ('EXAMEN_EXTRAORDINARIO', 'Examen Extraordinario', 'Solicitud de evaluación extraordinaria.'),
    ('BAJA_TEMPORAL', 'Baja Temporal', 'Solicitud de baja temporal de periodo académico.')
ON CONFLICT (codigo) DO NOTHING;

-- 8. Otorgar permisos a roles de aplicacion
GRANT SELECT, INSERT, UPDATE ON academico.calificaciones_parciales TO securecampus_app;
GRANT SELECT ON academico.calificaciones_parciales TO securecampus_lectura;

-- migrate:down
DROP TRIGGER IF EXISTS trg_solicitudes_solo_alumnos_activos ON solicitudes.solicitudes;
DROP FUNCTION IF EXISTS solicitudes.fn_validar_alumno_activo_solicitud();

DROP TRIGGER IF EXISTS trg_grupos_proteger_parciales ON academico.grupos;
DROP FUNCTION IF EXISTS academico.fn_proteger_cambio_parciales_grupo();

DROP TRIGGER IF EXISTS trg_calificaciones_parciales_validar_grupo ON academico.calificaciones_parciales;
DROP FUNCTION IF EXISTS academico.fn_validar_parcial_pertenece_grupo();

DROP TABLE IF EXISTS academico.calificaciones_parciales;

ALTER TABLE academico.calificaciones
    DROP CONSTRAINT IF EXISTS ck_calificaciones_final_entera;

ALTER TABLE academico.grupos
    DROP CONSTRAINT IF EXISTS ck_grupos_numero_parciales;

ALTER TABLE academico.grupos
    DROP COLUMN IF EXISTS numero_parciales;
