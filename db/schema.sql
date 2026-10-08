\restrict dbmate

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: academico; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA academico;


--
-- Name: SCHEMA academico; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA academico IS 'Alumnos, profesores, materias, grupos y calificaciones.';


--
-- Name: auditoria; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auditoria;


--
-- Name: SCHEMA auditoria; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA auditoria IS 'Bitacora de eventos de seguridad y negocio.';


--
-- Name: documentos; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA documentos;


--
-- Name: SCHEMA documentos; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA documentos IS 'Metadatos de documentos; los binarios viven fuera de la BD.';


--
-- Name: nucleo; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA nucleo;


--
-- Name: SCHEMA nucleo; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA nucleo IS 'Entidades transversales: personas y carreras.';


--
-- Name: seguridad; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA seguridad;


--
-- Name: SCHEMA seguridad; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA seguridad IS 'Identidad de aplicacion, roles y permisos.';


--
-- Name: solicitudes; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA solicitudes;


--
-- Name: SCHEMA solicitudes; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA solicitudes IS 'Solicitudes de tramites y su historial.';


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: rango_hora; Type: TYPE; Schema: academico; Owner: -
--

CREATE TYPE academico.rango_hora AS RANGE (
    subtype = time without time zone,
    multirange_type_name = academico.rango_hora_multirange
);


--
-- Name: fn_asignar_carrera_grupo(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_asignar_carrera_grupo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT cm.carrera_id INTO NEW.carrera_id
    FROM academico.carreras_materias cm
    WHERE cm.carrera_materia_id = NEW.carrera_materia_id;

    IF NEW.carrera_id IS NULL THEN
        RAISE EXCEPTION 'No existe el plan de estudios %', NEW.carrera_materia_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_asignar_llaves_inscripcion(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_asignar_llaves_inscripcion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT g.carrera_id, g.carrera_materia_id, g.periodo_academico_id
      INTO NEW.carrera_id, NEW.carrera_materia_id, NEW.periodo_academico_id
    FROM academico.grupos g
    WHERE g.grupo_id = NEW.grupo_id;

    IF NEW.carrera_id IS NULL THEN
        RAISE EXCEPTION 'No existe el grupo %', NEW.grupo_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_asignar_periodo_sesion(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_asignar_periodo_sesion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT g.periodo_academico_id INTO NEW.periodo_academico_id
    FROM academico.grupos g WHERE g.grupo_id = NEW.grupo_id;

    IF NEW.periodo_academico_id IS NULL THEN
        RAISE EXCEPTION 'No existe el grupo %', NEW.grupo_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_registrar_cambio_calificacion(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_registrar_cambio_calificacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_autor            uuid;
    v_cambio_valor     boolean;
    v_cambio_metadatos boolean;
    v_metadatos        jsonb := '{}'::jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado = 'CAPTURADA' THEN
            INSERT INTO academico.historial_calificaciones (
                calificacion_id, valor_anterior, valor_nuevo,
                estado_anterior, estado_nuevo, tipo_cambio,
                cambiado_por_usuario_id, motivo)
            VALUES (NEW.calificacion_id, NULL, NEW.valor_calificacion,
                    NULL, NEW.estado, 'ALTA',
                    COALESCE(seguridad.fn_usuario_actual(), NEW.capturada_por_usuario_id),
                    'Captura inicial');
        END IF;
        RETURN NEW;
    END IF;

    v_cambio_valor := OLD.valor_calificacion IS DISTINCT FROM NEW.valor_calificacion
                   OR OLD.estado IS DISTINCT FROM NEW.estado;

    IF OLD.capturada_por_usuario_id IS DISTINCT FROM NEW.capturada_por_usuario_id THEN
        v_metadatos := v_metadatos || jsonb_build_object(
            'capturada_por_usuario_id',
            jsonb_build_object('anterior', OLD.capturada_por_usuario_id,
                               'nuevo', NEW.capturada_por_usuario_id));
    END IF;

    IF OLD.capturada_en IS DISTINCT FROM NEW.capturada_en THEN
        v_metadatos := v_metadatos || jsonb_build_object(
            'capturada_en',
            jsonb_build_object('anterior', OLD.capturada_en,
                               'nuevo', NEW.capturada_en));
    END IF;

    IF OLD.actualizada_por_usuario_id IS DISTINCT FROM NEW.actualizada_por_usuario_id THEN
        v_metadatos := v_metadatos || jsonb_build_object(
            'actualizada_por_usuario_id',
            jsonb_build_object('anterior', OLD.actualizada_por_usuario_id,
                               'nuevo', NEW.actualizada_por_usuario_id));
    END IF;

    v_cambio_metadatos := v_metadatos <> '{}'::jsonb;

    IF NOT v_cambio_valor AND NOT v_cambio_metadatos THEN
        RETURN NEW;
    END IF;

    v_autor := COALESCE(seguridad.fn_usuario_actual(),
                        NEW.actualizada_por_usuario_id,
                        NEW.capturada_por_usuario_id);

    IF v_autor IS NULL THEN
        RAISE EXCEPTION
            'Todo cambio de calificacion debe identificar a su autor: declare app.usuario_id o actualizada_por_usuario_id'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    INSERT INTO academico.historial_calificaciones (
        calificacion_id, valor_anterior, valor_nuevo,
        estado_anterior, estado_nuevo, tipo_cambio, metadatos_cambio,
        cambiado_por_usuario_id)
    VALUES (NEW.calificacion_id, OLD.valor_calificacion, NEW.valor_calificacion,
            OLD.estado, NEW.estado,
            CASE WHEN v_cambio_valor THEN 'VALOR' ELSE 'METADATOS' END,
            CASE WHEN v_cambio_metadatos THEN v_metadatos ELSE NULL END,
            v_autor);

    RETURN NEW;
END;
$$;


--
-- Name: fn_registrar_cambio_inscripcion(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_registrar_cambio_inscripcion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO academico.historial_estado_inscripcion
            (inscripcion_id, estado_anterior, estado_nuevo, cambiado_por_usuario_id, motivo)
        VALUES (NEW.inscripcion_id, NULL, NEW.estado,
                seguridad.fn_usuario_actual(), 'Alta de inscripcion');
    ELSIF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO academico.historial_estado_inscripcion
            (inscripcion_id, estado_anterior, estado_nuevo, cambiado_por_usuario_id)
        VALUES (NEW.inscripcion_id, OLD.estado, NEW.estado, seguridad.fn_usuario_actual());
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_validar_carrera_inscripcion(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_validar_carrera_inscripcion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM academico.alumnos_carreras ac
        WHERE ac.alumno_id  = NEW.alumno_id
          AND ac.carrera_id = NEW.carrera_id
    ) THEN
        RAISE EXCEPTION
            'El alumno % no pertenece a la carrera del grupo %',
            NEW.alumno_id, NEW.grupo_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_validar_carrera_profesor_grupo(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_validar_carrera_profesor_grupo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_carrera_grupo uuid;
BEGIN
    SELECT g.carrera_id INTO v_carrera_grupo
    FROM academico.grupos g
    WHERE g.grupo_id = NEW.grupo_id;

    IF NOT EXISTS (
        SELECT 1
        FROM academico.profesores_carreras pc
        WHERE pc.profesor_id = NEW.profesor_id
          AND pc.carrera_id  = v_carrera_grupo
          AND pc.fecha_fin IS NULL
    ) THEN
        RAISE EXCEPTION
            'El profesor % no esta adscrito vigente a la carrera del grupo %',
            NEW.profesor_id, NEW.grupo_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_validar_disponibilidad_grupo(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_validar_disponibilidad_grupo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_estado_grupo varchar(20);
    v_cupo         integer;
    v_inscritos    integer;
BEGIN
    SELECT g.estado, g.cupo_maximo
      INTO v_estado_grupo, v_cupo
    FROM academico.grupos g
    WHERE g.grupo_id = NEW.grupo_id
    FOR UPDATE;

    IF v_estado_grupo <> 'ABIERTO' THEN
        RAISE EXCEPTION
            'El grupo % no admite inscripciones: su estado es %',
            NEW.grupo_id, v_estado_grupo
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF v_cupo IS NOT NULL THEN
        SELECT count(*) INTO v_inscritos
        FROM academico.inscripciones i
        WHERE i.grupo_id = NEW.grupo_id AND i.estado <> 'CANCELADA';

        IF v_inscritos >= v_cupo THEN
            RAISE EXCEPTION
                'El grupo % alcanzo su cupo maximo de % lugares',
                NEW.grupo_id, v_cupo
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_validar_inscripcion_calificacion(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_validar_inscripcion_calificacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_estado varchar(20);
BEGIN
    SELECT i.estado INTO v_estado
    FROM academico.inscripciones i
    WHERE i.inscripcion_id = NEW.inscripcion_id;

    IF v_estado IS NULL THEN
        RAISE EXCEPTION 'No existe la inscripcion %', NEW.inscripcion_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF v_estado NOT IN ('INSCRITO', 'COMPLETADA') THEN
        RAISE EXCEPTION
            'No se puede registrar calificacion: la inscripcion % esta en estado %',
            NEW.inscripcion_id, v_estado
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_validar_periodo_grupo(); Type: FUNCTION; Schema: academico; Owner: -
--

CREATE FUNCTION academico.fn_validar_periodo_grupo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_estado_periodo varchar(20);
BEGIN
    SELECT pa.estado INTO v_estado_periodo
    FROM academico.periodos_academicos pa
    WHERE pa.periodo_academico_id = NEW.periodo_academico_id;

    IF v_estado_periodo IS NULL THEN
        RAISE EXCEPTION 'No existe el periodo academico %', NEW.periodo_academico_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF v_estado_periodo NOT IN ('PLANEADO', 'ACTIVO') THEN
        RAISE EXCEPTION
            'No se pueden crear grupos en un periodo con estado %', v_estado_periodo
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_rechazar_modificacion(); Type: FUNCTION; Schema: auditoria; Owner: -
--

CREATE FUNCTION auditoria.fn_rechazar_modificacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo insercion y no admite % ',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;


--
-- Name: FUNCTION fn_rechazar_modificacion(); Type: COMMENT; Schema: auditoria; Owner: -
--

COMMENT ON FUNCTION auditoria.fn_rechazar_modificacion() IS 'Bloquea UPDATE y DELETE sobre tablas de bitacora.';


--
-- Name: fn_rechazar_truncado(); Type: FUNCTION; Schema: auditoria; Owner: -
--

CREATE FUNCTION auditoria.fn_rechazar_truncado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo insercion: TRUNCATE esta prohibido',
        TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
END;
$$;


--
-- Name: fn_validar_momento_evento(); Type: FUNCTION; Schema: auditoria; Owner: -
--

CREATE FUNCTION auditoria.fn_validar_momento_evento() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    v_tolerancia integer := 300;
    v_config     text;
BEGIN
    v_config := current_setting('app.tolerancia_reloj_segundos', true);

    IF v_config IS NOT NULL AND v_config ~ '^[0-9]+$' THEN
        v_tolerancia := v_config::integer;
    END IF;

    IF NEW.ocurrido_en > CURRENT_TIMESTAMP + make_interval(secs => v_tolerancia) THEN
        RAISE EXCEPTION
            'ocurrido_en (%) esta en el futuro mas alla de la tolerancia de % segundos',
            NEW.ocurrido_en, v_tolerancia
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$_$;


--
-- Name: fn_validar_propietario_activo(); Type: FUNCTION; Schema: documentos; Owner: -
--

CREATE FUNCTION documentos.fn_validar_propietario_activo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_estado varchar(20);
BEGIN
    SELECT u.estado INTO v_estado
    FROM seguridad.usuarios u
    WHERE u.usuario_id = NEW.propietario_usuario_id;

    IF v_estado <> 'ACTIVO' THEN
        RAISE EXCEPTION
            'No se pueden crear documentos para un usuario en estado %', v_estado
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_actualizar_marca_tiempo(); Type: FUNCTION; Schema: nucleo; Owner: -
--

CREATE FUNCTION nucleo.fn_actualizar_marca_tiempo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION fn_actualizar_marca_tiempo(); Type: COMMENT; Schema: nucleo; Owner: -
--

COMMENT ON FUNCTION nucleo.fn_actualizar_marca_tiempo() IS 'Mantiene actualizado_en en cada UPDATE.';


--
-- Name: fn_proteger_asignacion_rol(); Type: FUNCTION; Schema: seguridad; Owner: -
--

CREATE FUNCTION seguridad.fn_proteger_asignacion_rol() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
       OR NEW.rol_id IS DISTINCT FROM OLD.rol_id
       OR NEW.carrera_id IS DISTINCT FROM OLD.carrera_id
       OR NEW.asignado_en IS DISTINCT FROM OLD.asignado_en
       OR NEW.asignado_por_usuario_id IS DISTINCT FROM OLD.asignado_por_usuario_id THEN
        RAISE EXCEPTION
            'Una asignacion de rol es inmutable: revoquela y cree una nueva'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF OLD.revocado_en IS NOT NULL
       AND (NEW.revocado_en IS DISTINCT FROM OLD.revocado_en
            OR NEW.revocado_por_usuario_id IS DISTINCT FROM OLD.revocado_por_usuario_id) THEN
        RAISE EXCEPTION
            'Una asignacion ya revocada no puede modificarse ni reactivarse'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_proteger_codigo_rol(); Type: FUNCTION; Schema: seguridad; Owner: -
--

CREATE FUNCTION seguridad.fn_proteger_codigo_rol() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
        IF OLD.es_rol_sistema THEN
            RAISE EXCEPTION
                'El codigo del rol de sistema % no puede cambiarse', OLD.codigo
                USING ERRCODE = 'insufficient_privilege';
        END IF;

        IF EXISTS (
            SELECT 1 FROM seguridad.usuarios_roles ur
            WHERE ur.rol_id = OLD.rol_id AND ur.revocado_en IS NULL
        ) THEN
            RAISE EXCEPTION
                'El rol % tiene asignaciones vigentes: revoquelas antes de renombrarlo',
                OLD.codigo
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_usuario_actual(); Type: FUNCTION; Schema: seguridad; Owner: -
--

CREATE FUNCTION seguridad.fn_usuario_actual() RETURNS uuid
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_valor text;
BEGIN
    v_valor := current_setting('app.usuario_id', true);

    IF v_valor IS NULL OR btrim(v_valor) = '' THEN
        RETURN NULL;
    END IF;

    RETURN v_valor::uuid;
EXCEPTION
    WHEN others THEN
        RETURN NULL;
END;
$$;


--
-- Name: FUNCTION fn_usuario_actual(); Type: COMMENT; Schema: seguridad; Owner: -
--

COMMENT ON FUNCTION seguridad.fn_usuario_actual() IS 'Lee app.usuario_id fijado con SET LOCAL. Devuelve NULL si no se declaro o si no es un uuid valido.';


--
-- Name: fn_validar_ambito_rol(); Type: FUNCTION; Schema: seguridad; Owner: -
--

CREATE FUNCTION seguridad.fn_validar_ambito_rol() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_codigo_rol varchar(50);
BEGIN
    SELECT codigo INTO v_codigo_rol
    FROM seguridad.roles
    WHERE rol_id = NEW.rol_id;

    IF v_codigo_rol = 'JEFE_CARRERA' AND NEW.carrera_id IS NULL THEN
        RAISE EXCEPTION 'El rol JEFE_CARRERA debe asignarse con una carrera_id'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF v_codigo_rol <> 'JEFE_CARRERA' AND NEW.carrera_id IS NOT NULL THEN
        RAISE EXCEPTION 'El rol % es global y no admite ambito de carrera', v_codigo_rol
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_registrar_cambio_solicitud(); Type: FUNCTION; Schema: solicitudes; Owner: -
--

CREATE FUNCTION solicitudes.fn_registrar_cambio_solicitud() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO solicitudes.historial_estado_solicitud
            (solicitud_id, estado_anterior, estado_nuevo, cambiado_por_usuario_id, notas)
        VALUES (NEW.solicitud_id, NULL, NEW.estado,
                COALESCE(seguridad.fn_usuario_actual(), NEW.solicitante_usuario_id),
                'Alta de solicitud');
    ELSIF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO solicitudes.historial_estado_solicitud
            (solicitud_id, estado_anterior, estado_nuevo, cambiado_por_usuario_id, notas)
        VALUES (NEW.solicitud_id, OLD.estado, NEW.estado,
                COALESCE(seguridad.fn_usuario_actual(), NEW.resuelta_por_usuario_id),
                NEW.notas_resolucion);
    END IF;

    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alumnos; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.alumnos (
    alumno_id uuid DEFAULT gen_random_uuid() NOT NULL,
    persona_id uuid NOT NULL,
    matricula character varying(50) NOT NULL,
    fecha_ingreso date,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_alumnos_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying, 'EGRESADO'::character varying, 'BAJA'::character varying])::text[]))),
    CONSTRAINT ck_alumnos_matricula_no_vacia CHECK ((btrim((matricula)::text) <> ''::text))
);


--
-- Name: alumnos_carreras; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.alumnos_carreras (
    alumno_carrera_id uuid DEFAULT gen_random_uuid() NOT NULL,
    alumno_id uuid NOT NULL,
    carrera_id uuid NOT NULL,
    fecha_inicio date DEFAULT CURRENT_DATE NOT NULL,
    fecha_fin date,
    CONSTRAINT ck_alumnos_carreras_fechas CHECK (((fecha_fin IS NULL) OR (fecha_fin >= fecha_inicio)))
);


--
-- Name: TABLE alumnos_carreras; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON TABLE academico.alumnos_carreras IS 'Historial alumno-carrera. El indice parcial permite una sola carrera vigente a la vez.';


--
-- Name: asignaciones_profesor_grupo; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.asignaciones_profesor_grupo (
    asignacion_profesor_grupo_id uuid DEFAULT gen_random_uuid() NOT NULL,
    profesor_id uuid NOT NULL,
    grupo_id uuid NOT NULL,
    asignado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    asignado_por_usuario_id uuid,
    revocado_en timestamp with time zone,
    revocado_por_usuario_id uuid,
    CONSTRAINT ck_asignaciones_profesor_fechas CHECK (((revocado_en IS NULL) OR (revocado_en >= asignado_en))),
    CONSTRAINT ck_asignaciones_profesor_revocacion_completa CHECK (((revocado_en IS NULL) OR (revocado_por_usuario_id IS NOT NULL)))
);


--
-- Name: TABLE asignaciones_profesor_grupo; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON TABLE academico.asignaciones_profesor_grupo IS 'Define que grupos puede gestionar un profesor. El servidor debe verificar esta relacion antes de capturar calificaciones o listas.';


--
-- Name: calificaciones; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.calificaciones (
    calificacion_id uuid DEFAULT gen_random_uuid() NOT NULL,
    inscripcion_id uuid NOT NULL,
    valor_calificacion numeric(5,2),
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    capturada_por_usuario_id uuid,
    capturada_en timestamp with time zone,
    actualizada_por_usuario_id uuid,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_calificaciones_coherencia_captura CHECK (((((estado)::text = 'PENDIENTE'::text) AND (valor_calificacion IS NULL) AND (capturada_por_usuario_id IS NULL) AND (capturada_en IS NULL)) OR (((estado)::text = 'CAPTURADA'::text) AND (valor_calificacion IS NOT NULL) AND (capturada_por_usuario_id IS NOT NULL) AND (capturada_en IS NOT NULL)))),
    CONSTRAINT ck_calificaciones_estado CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'CAPTURADA'::character varying])::text[]))),
    CONSTRAINT ck_calificaciones_rango CHECK (((valor_calificacion IS NULL) OR ((valor_calificacion >= (0)::numeric) AND (valor_calificacion <= (100)::numeric))))
);


--
-- Name: TABLE calificaciones; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON TABLE academico.calificaciones IS 'Una calificacion final vigente por inscripcion. La escala se acota a 0-100; ajustar si la institucion usa otra.';


--
-- Name: carreras_materias; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.carreras_materias (
    carrera_materia_id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrera_id uuid NOT NULL,
    materia_id uuid NOT NULL,
    semestre smallint,
    es_obligatoria boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_carreras_materias_semestre CHECK (((semestre IS NULL) OR (semestre > 0)))
);


--
-- Name: grupos; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.grupos (
    grupo_id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrera_materia_id uuid NOT NULL,
    periodo_academico_id uuid NOT NULL,
    carrera_id uuid NOT NULL,
    clave_grupo character varying(30) NOT NULL,
    cupo_maximo integer,
    estado character varying(20) DEFAULT 'PLANEADO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_grupos_clave_no_vacia CHECK ((btrim((clave_grupo)::text) <> ''::text)),
    CONSTRAINT ck_grupos_cupo CHECK (((cupo_maximo IS NULL) OR (cupo_maximo > 0))),
    CONSTRAINT ck_grupos_estado CHECK (((estado)::text = ANY ((ARRAY['PLANEADO'::character varying, 'ABIERTO'::character varying, 'CERRADO'::character varying, 'CANCELADO'::character varying])::text[])))
);


--
-- Name: COLUMN grupos.carrera_id; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON COLUMN academico.grupos.carrera_id IS 'Desnormalizacion controlada: la asigna un trigger y la FK compuesta impide que se desvie del plan de estudios.';


--
-- Name: historial_calificaciones; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.historial_calificaciones (
    historial_calificacion_id uuid DEFAULT gen_random_uuid() NOT NULL,
    calificacion_id uuid NOT NULL,
    valor_anterior numeric(5,2),
    valor_nuevo numeric(5,2),
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    tipo_cambio character varying(20) NOT NULL,
    metadatos_cambio jsonb,
    cambiado_por_usuario_id uuid NOT NULL,
    motivo text,
    cambiado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_historial_calificaciones_estados CHECK ((((estado_nuevo)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'CAPTURADA'::character varying])::text[])) AND ((estado_anterior IS NULL) OR ((estado_anterior)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'CAPTURADA'::character varying])::text[]))))),
    CONSTRAINT ck_historial_calificaciones_tipo CHECK (((tipo_cambio)::text = ANY ((ARRAY['ALTA'::character varying, 'VALOR'::character varying, 'METADATOS'::character varying])::text[]))),
    CONSTRAINT ck_historial_calificaciones_valores CHECK ((((valor_anterior IS NULL) OR ((valor_anterior >= (0)::numeric) AND (valor_anterior <= (100)::numeric))) AND ((valor_nuevo IS NULL) OR ((valor_nuevo >= (0)::numeric) AND (valor_nuevo <= (100)::numeric)))))
);


--
-- Name: TABLE historial_calificaciones; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON TABLE academico.historial_calificaciones IS 'Evidencia de toda alta o cambio de calificacion. Tabla de solo insercion: el autor es obligatorio.';


--
-- Name: COLUMN historial_calificaciones.metadatos_cambio; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON COLUMN academico.historial_calificaciones.metadatos_cambio IS 'Detalle de los campos de trazabilidad que cambiaron, cuando tipo_cambio = METADATOS.';


--
-- Name: historial_estado_inscripcion; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.historial_estado_inscripcion (
    historial_inscripcion_id uuid DEFAULT gen_random_uuid() NOT NULL,
    inscripcion_id uuid NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    cambiado_por_usuario_id uuid,
    motivo text,
    cambiado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_historial_inscripcion_estados CHECK ((((estado_nuevo)::text = ANY ((ARRAY['INSCRITO'::character varying, 'COMPLETADA'::character varying, 'CANCELADA'::character varying])::text[])) AND ((estado_anterior IS NULL) OR ((estado_anterior)::text = ANY ((ARRAY['INSCRITO'::character varying, 'COMPLETADA'::character varying, 'CANCELADA'::character varying])::text[])))))
);


--
-- Name: inscripciones; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.inscripciones (
    inscripcion_id uuid DEFAULT gen_random_uuid() NOT NULL,
    alumno_id uuid NOT NULL,
    grupo_id uuid NOT NULL,
    carrera_id uuid NOT NULL,
    carrera_materia_id uuid NOT NULL,
    periodo_academico_id uuid NOT NULL,
    estado character varying(20) DEFAULT 'INSCRITO'::character varying NOT NULL,
    inscrito_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completado_en timestamp with time zone,
    cancelado_en timestamp with time zone,
    CONSTRAINT ck_inscripciones_coherencia_fechas CHECK (((((estado)::text = 'INSCRITO'::text) AND (completado_en IS NULL) AND (cancelado_en IS NULL)) OR (((estado)::text = 'COMPLETADA'::text) AND (completado_en IS NOT NULL) AND (cancelado_en IS NULL)) OR (((estado)::text = 'CANCELADA'::text) AND (cancelado_en IS NOT NULL) AND (completado_en IS NULL)))),
    CONSTRAINT ck_inscripciones_estado CHECK (((estado)::text = ANY ((ARRAY['INSCRITO'::character varying, 'COMPLETADA'::character varying, 'CANCELADA'::character varying])::text[])))
);


--
-- Name: materias; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.materias (
    materia_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text,
    creditos smallint NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVA'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_materias_codigo_mayusculas CHECK (((codigo)::text = upper((codigo)::text))),
    CONSTRAINT ck_materias_creditos CHECK ((creditos > 0)),
    CONSTRAINT ck_materias_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVA'::character varying, 'INACTIVA'::character varying])::text[]))),
    CONSTRAINT ck_materias_nombre_no_vacio CHECK ((btrim((nombre)::text) <> ''::text))
);


--
-- Name: periodos_academicos; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.periodos_academicos (
    periodo_academico_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(150) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    estado character varying(20) DEFAULT 'PLANEADO'::character varying NOT NULL,
    CONSTRAINT ck_periodos_academicos_estado CHECK (((estado)::text = ANY ((ARRAY['PLANEADO'::character varying, 'ACTIVO'::character varying, 'CERRADO'::character varying, 'CANCELADO'::character varying])::text[]))),
    CONSTRAINT ck_periodos_academicos_fechas CHECK ((fecha_fin >= fecha_inicio)),
    CONSTRAINT ck_periodos_academicos_nombre_no_vacio CHECK ((btrim((nombre)::text) <> ''::text))
);


--
-- Name: profesores; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.profesores (
    profesor_id uuid DEFAULT gen_random_uuid() NOT NULL,
    persona_id uuid NOT NULL,
    numero_empleado character varying(50) NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_profesores_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying])::text[]))),
    CONSTRAINT ck_profesores_numero_no_vacio CHECK ((btrim((numero_empleado)::text) <> ''::text))
);


--
-- Name: profesores_carreras; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.profesores_carreras (
    profesor_carrera_id uuid DEFAULT gen_random_uuid() NOT NULL,
    profesor_id uuid NOT NULL,
    carrera_id uuid NOT NULL,
    fecha_inicio date DEFAULT CURRENT_DATE NOT NULL,
    fecha_fin date,
    CONSTRAINT ck_profesores_carreras_fechas CHECK (((fecha_fin IS NULL) OR (fecha_fin >= fecha_inicio)))
);


--
-- Name: sesiones_grupo; Type: TABLE; Schema: academico; Owner: -
--

CREATE TABLE academico.sesiones_grupo (
    sesion_grupo_id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid NOT NULL,
    periodo_academico_id uuid NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    aula character varying(50),
    CONSTRAINT ck_sesiones_aula_no_vacia CHECK (((aula IS NULL) OR (btrim((aula)::text) <> ''::text))),
    CONSTRAINT ck_sesiones_dia CHECK (((dia_semana >= 1) AND (dia_semana <= 7))),
    CONSTRAINT ck_sesiones_horas CHECK ((hora_fin > hora_inicio))
);


--
-- Name: TABLE sesiones_grupo; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON TABLE academico.sesiones_grupo IS 'Horario del grupo, una fila por sesion semanal. dia_semana sigue ISO: 1 = lunes, 7 = domingo.';


--
-- Name: COLUMN sesiones_grupo.aula; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON COLUMN academico.sesiones_grupo.aula IS 'El aula vive en la sesion y no en el grupo porque un mismo grupo puede sesionar en aulas distintas, por ejemplo teoria y laboratorio.';


--
-- Name: carreras; Type: TABLE; Schema: nucleo; Owner: -
--

CREATE TABLE nucleo.carreras (
    carrera_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text,
    estado character varying(20) DEFAULT 'ACTIVA'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_carreras_codigo_mayusculas CHECK (((codigo)::text = upper((codigo)::text))),
    CONSTRAINT ck_carreras_codigo_no_vacio CHECK ((btrim((codigo)::text) <> ''::text)),
    CONSTRAINT ck_carreras_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVA'::character varying, 'INACTIVA'::character varying])::text[]))),
    CONSTRAINT ck_carreras_nombre_no_vacio CHECK ((btrim((nombre)::text) <> ''::text))
);


--
-- Name: personas; Type: TABLE; Schema: nucleo; Owner: -
--

CREATE TABLE nucleo.personas (
    persona_id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombres character varying(200) NOT NULL,
    apellido_paterno character varying(100) NOT NULL,
    apellido_materno character varying(100),
    nombre_completo character varying(420) GENERATED ALWAYS AS (((((nombres)::text || ' '::text) || (apellido_paterno)::text) || COALESCE((' '::text || (apellido_materno)::text), ''::text))) STORED,
    correo character varying(320) NOT NULL,
    telefono character varying(30),
    fecha_nacimiento date,
    genero character varying(20),
    curp character(18),
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_personas_apellido_no_vacio CHECK ((btrim((apellido_paterno)::text) <> ''::text)),
    CONSTRAINT ck_personas_correo_formato CHECK (((correo)::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)),
    CONSTRAINT ck_personas_curp_formato CHECK (((curp IS NULL) OR (curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$'::text))),
    CONSTRAINT ck_personas_fecha_nacimiento CHECK (((fecha_nacimiento IS NULL) OR (fecha_nacimiento < CURRENT_DATE))),
    CONSTRAINT ck_personas_genero CHECK (((genero IS NULL) OR ((genero)::text = ANY ((ARRAY['MASCULINO'::character varying, 'FEMENINO'::character varying, 'NO_BINARIO'::character varying, 'PREFIERO_NO_DECIR'::character varying, 'OTRO'::character varying])::text[])))),
    CONSTRAINT ck_personas_nombres_espaciado CHECK (((nombres)::text = btrim(regexp_replace((nombres)::text, '\s+'::text, ' '::text, 'g'::text)))),
    CONSTRAINT ck_personas_nombres_no_vacio CHECK ((btrim((nombres)::text) <> ''::text))
);


--
-- Name: TABLE personas; Type: COMMENT; Schema: nucleo; Owner: -
--

COMMENT ON TABLE nucleo.personas IS 'Datos personales. Una persona puede ser alumno, profesor o ambos sin duplicarse.';


--
-- Name: COLUMN personas.nombres; Type: COMMENT; Schema: nucleo; Owner: -
--

COMMENT ON COLUMN nucleo.personas.nombres IS 'Uno o varios nombres de pila separados por espacio. Para buscar por un nombre suelto se usa el indice ix_personas_nombres_palabras.';


--
-- Name: COLUMN personas.nombre_completo; Type: COMMENT; Schema: nucleo; Owner: -
--

COMMENT ON COLUMN nucleo.personas.nombre_completo IS 'Derivada. Evita que la aplicacion arme el nombre de formas distintas en cada pantalla.';


--
-- Name: COLUMN personas.curp; Type: COMMENT; Schema: nucleo; Owner: -
--

COMMENT ON COLUMN nucleo.personas.curp IS 'La CURP codifica sexo y fecha de nacimiento, pero NO se valida contra genero ni fecha_nacimiento: una persona no binaria conserva H o M en su CURP oficial.';


--
-- Name: v_cardex_alumno; Type: VIEW; Schema: academico; Owner: -
--

CREATE VIEW academico.v_cardex_alumno AS
 SELECT a.alumno_id,
    a.matricula,
    pe.nombre_completo,
    c.carrera_id,
    c.codigo AS codigo_carrera,
    c.nombre AS nombre_carrera,
    m.materia_id,
    m.codigo AS codigo_materia,
    m.nombre AS nombre_materia,
    m.creditos,
    pa.periodo_academico_id,
    pa.codigo AS codigo_periodo,
    pa.nombre AS nombre_periodo,
    g.grupo_id,
    g.clave_grupo,
    i.inscripcion_id,
    i.estado AS estado_inscripcion,
    cal.calificacion_id,
    cal.valor_calificacion,
    cal.estado AS estado_calificacion
   FROM ((((((((academico.inscripciones i
     JOIN academico.alumnos a ON ((a.alumno_id = i.alumno_id)))
     JOIN nucleo.personas pe ON ((pe.persona_id = a.persona_id)))
     JOIN academico.grupos g ON ((g.grupo_id = i.grupo_id)))
     JOIN academico.carreras_materias cm ON ((cm.carrera_materia_id = g.carrera_materia_id)))
     JOIN nucleo.carreras c ON ((c.carrera_id = cm.carrera_id)))
     JOIN academico.materias m ON ((m.materia_id = cm.materia_id)))
     JOIN academico.periodos_academicos pa ON ((pa.periodo_academico_id = g.periodo_academico_id)))
     LEFT JOIN academico.calificaciones cal ON ((cal.inscripcion_id = i.inscripcion_id)));


--
-- Name: VIEW v_cardex_alumno; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON VIEW academico.v_cardex_alumno IS 'Cardex derivado. No existe tabla duplicada de cardex: se calcula de inscripcion + grupo + plan + materia + periodo + calificacion.';


--
-- Name: v_grupos_autorizados_profesor; Type: VIEW; Schema: academico; Owner: -
--

CREATE VIEW academico.v_grupos_autorizados_profesor AS
 SELECT apg.profesor_id,
    apg.grupo_id,
    g.carrera_id,
    g.carrera_materia_id,
    g.periodo_academico_id,
    g.clave_grupo
   FROM (academico.asignaciones_profesor_grupo apg
     JOIN academico.grupos g ON ((g.grupo_id = apg.grupo_id)))
  WHERE (apg.revocado_en IS NULL);


--
-- Name: VIEW v_grupos_autorizados_profesor; Type: COMMENT; Schema: academico; Owner: -
--

COMMENT ON VIEW academico.v_grupos_autorizados_profesor IS 'Fuente unica para responder si un profesor puede operar sobre un grupo.';


--
-- Name: v_horario_grupo; Type: VIEW; Schema: academico; Owner: -
--

CREATE VIEW academico.v_horario_grupo AS
 SELECT s.grupo_id,
    g.clave_grupo,
    s.dia_semana,
        CASE s.dia_semana
            WHEN 1 THEN 'Lunes'::text
            WHEN 2 THEN 'Martes'::text
            WHEN 3 THEN 'Miercoles'::text
            WHEN 4 THEN 'Jueves'::text
            WHEN 5 THEN 'Viernes'::text
            WHEN 6 THEN 'Sabado'::text
            ELSE 'Domingo'::text
        END AS nombre_dia,
    s.hora_inicio,
    s.hora_fin,
    s.aula
   FROM (academico.sesiones_grupo s
     JOIN academico.grupos g ON ((g.grupo_id = s.grupo_id)))
  ORDER BY s.grupo_id, s.dia_semana, s.hora_inicio;


--
-- Name: v_ocupacion_grupo; Type: VIEW; Schema: academico; Owner: -
--

CREATE VIEW academico.v_ocupacion_grupo AS
 SELECT g.grupo_id,
    g.clave_grupo,
    g.estado,
    g.cupo_maximo,
    count(i.inscripcion_id) FILTER (WHERE ((i.estado)::text <> 'CANCELADA'::text)) AS inscritos,
        CASE
            WHEN (g.cupo_maximo IS NULL) THEN NULL::bigint
            ELSE (g.cupo_maximo - count(i.inscripcion_id) FILTER (WHERE ((i.estado)::text <> 'CANCELADA'::text)))
        END AS lugares_disponibles
   FROM (academico.grupos g
     LEFT JOIN academico.inscripciones i ON ((i.grupo_id = g.grupo_id)))
  GROUP BY g.grupo_id, g.clave_grupo, g.estado, g.cupo_maximo;


--
-- Name: bitacora; Type: TABLE; Schema: auditoria; Owner: -
--

CREATE TABLE auditoria.bitacora (
    bitacora_id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_usuario_id uuid,
    codigo_accion character varying(100) NOT NULL,
    tipo_recurso character varying(100),
    recurso_id uuid,
    resultado character varying(20) NOT NULL,
    ocurrido_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    direccion_ip inet,
    agente_usuario text,
    metadatos jsonb,
    CONSTRAINT ck_bitacora_accion_no_vacia CHECK ((btrim((codigo_accion)::text) <> ''::text)),
    CONSTRAINT ck_bitacora_resultado CHECK (((resultado)::text = ANY ((ARRAY['EXITO'::character varying, 'DENEGADO'::character varying, 'ERROR'::character varying])::text[])))
);


--
-- Name: TABLE bitacora; Type: COMMENT; Schema: auditoria; Owner: -
--

COMMENT ON TABLE auditoria.bitacora IS 'Eventos de seguridad y negocio. Nunca almacenar contrasenas, tokens ni contenido completo de documentos en metadatos.';


--
-- Name: documentos; Type: TABLE; Schema: documentos; Owner: -
--

CREATE TABLE documentos.documentos (
    documento_id uuid DEFAULT gen_random_uuid() NOT NULL,
    propietario_usuario_id uuid NOT NULL,
    tipo_documento_id uuid NOT NULL,
    titulo character varying(250) NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_documentos_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'EN_CUARENTENA'::character varying, 'RECHAZADO'::character varying, 'ARCHIVADO'::character varying])::text[]))),
    CONSTRAINT ck_documentos_titulo_no_vacio CHECK ((btrim((titulo)::text) <> ''::text))
);


--
-- Name: tipos_documento; Type: TABLE; Schema: documentos; Owner: -
--

CREATE TABLE documentos.tipos_documento (
    tipo_documento_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    esta_activo boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_tipos_documento_codigo_mayusculas CHECK (((codigo)::text = upper((codigo)::text))),
    CONSTRAINT ck_tipos_documento_nombre_no_vacio CHECK ((btrim((nombre)::text) <> ''::text))
);


--
-- Name: versiones_documento; Type: TABLE; Schema: documentos; Owner: -
--

CREATE TABLE documentos.versiones_documento (
    version_documento_id uuid DEFAULT gen_random_uuid() NOT NULL,
    documento_id uuid NOT NULL,
    numero_version integer NOT NULL,
    clave_almacenamiento character varying(500) NOT NULL,
    nombre_archivo_original character varying(255) NOT NULL,
    tipo_mime character varying(150) NOT NULL,
    extension_archivo character varying(20) GENERATED ALWAYS AS (lower("substring"((nombre_archivo_original)::text, '\.([^.\/]+)$'::text))) STORED,
    tamano_bytes bigint NOT NULL,
    sha256_hex character(64) NOT NULL,
    es_vigente boolean DEFAULT true NOT NULL,
    subido_por_usuario_id uuid NOT NULL,
    subido_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_versiones_documento_nombre CHECK ((btrim((nombre_archivo_original)::text) <> ''::text)),
    CONSTRAINT ck_versiones_documento_numero CHECK ((numero_version > 0)),
    CONSTRAINT ck_versiones_documento_sha256 CHECK ((sha256_hex ~ '^[0-9A-Fa-f]{64}$'::text)),
    CONSTRAINT ck_versiones_documento_tamano CHECK ((tamano_bytes >= 0))
);


--
-- Name: TABLE versiones_documento; Type: COMMENT; Schema: documentos; Owner: -
--

COMMENT ON TABLE documentos.versiones_documento IS 'Solo metadatos de almacenamiento de objetos. El contenido binario vive en almacenamiento privado, nunca en esta tabla.';


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: permisos; Type: TABLE; Schema: seguridad; Owner: -
--

CREATE TABLE seguridad.permisos (
    permiso_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(100) NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    CONSTRAINT ck_permisos_codigo_no_vacio CHECK ((btrim((codigo)::text) <> ''::text)),
    CONSTRAINT ck_permisos_nombre_no_vacio CHECK ((btrim((nombre)::text) <> ''::text))
);


--
-- Name: roles; Type: TABLE; Schema: seguridad; Owner: -
--

CREATE TABLE seguridad.roles (
    rol_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    es_rol_sistema boolean DEFAULT false NOT NULL,
    CONSTRAINT ck_roles_codigo_mayusculas CHECK (((codigo)::text = upper((codigo)::text))),
    CONSTRAINT ck_roles_nombre_no_vacio CHECK ((btrim((nombre)::text) <> ''::text))
);


--
-- Name: roles_permisos; Type: TABLE; Schema: seguridad; Owner: -
--

CREATE TABLE seguridad.roles_permisos (
    rol_id uuid NOT NULL,
    permiso_id uuid NOT NULL,
    otorgado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: seguridad; Owner: -
--

CREATE TABLE seguridad.usuarios (
    usuario_id uuid DEFAULT gen_random_uuid() NOT NULL,
    persona_id uuid NOT NULL,
    sujeto_identidad character varying(255) NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_usuarios_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'SUSPENDIDO'::character varying, 'DESHABILITADO'::character varying])::text[]))),
    CONSTRAINT ck_usuarios_sujeto_no_vacio CHECK ((btrim((sujeto_identidad)::text) <> ''::text))
);


--
-- Name: TABLE usuarios; Type: COMMENT; Schema: seguridad; Owner: -
--

COMMENT ON TABLE seguridad.usuarios IS 'Identidad de aplicacion. Las credenciales son externas (OIDC); aqui no se guardan contrasenas.';


--
-- Name: COLUMN usuarios.sujeto_identidad; Type: COMMENT; Schema: seguridad; Owner: -
--

COMMENT ON COLUMN seguridad.usuarios.sujeto_identidad IS 'Identificador externo inmutable (claim sub de OIDC). Nunca contrasenas ni tokens.';


--
-- Name: usuarios_roles; Type: TABLE; Schema: seguridad; Owner: -
--

CREATE TABLE seguridad.usuarios_roles (
    usuario_rol_id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    rol_id uuid NOT NULL,
    carrera_id uuid,
    asignado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    asignado_por_usuario_id uuid,
    revocado_en timestamp with time zone,
    revocado_por_usuario_id uuid,
    CONSTRAINT ck_usuarios_roles_fechas CHECK (((revocado_en IS NULL) OR (revocado_en >= asignado_en))),
    CONSTRAINT ck_usuarios_roles_revocacion_completa CHECK (((revocado_en IS NULL) OR (revocado_por_usuario_id IS NOT NULL))),
    CONSTRAINT ck_usuarios_roles_sin_autoasignacion CHECK (((asignado_por_usuario_id IS NULL) OR (asignado_por_usuario_id <> usuario_id))),
    CONSTRAINT ck_usuarios_roles_sin_autorevocacion CHECK (((revocado_por_usuario_id IS NULL) OR (revocado_por_usuario_id <> usuario_id)))
);


--
-- Name: TABLE usuarios_roles; Type: COMMENT; Schema: seguridad; Owner: -
--

COMMENT ON TABLE seguridad.usuarios_roles IS 'Asignaciones de rol. carrera_id delimita el ambito de roles acotados como JEFE_CARRERA.';


--
-- Name: v_permisos_efectivos_usuario; Type: VIEW; Schema: seguridad; Owner: -
--

CREATE VIEW seguridad.v_permisos_efectivos_usuario AS
 SELECT ur.usuario_id,
    r.rol_id,
    r.codigo AS codigo_rol,
    ur.carrera_id,
    p.permiso_id,
    p.codigo AS codigo_permiso
   FROM ((((seguridad.usuarios_roles ur
     JOIN seguridad.usuarios u ON (((u.usuario_id = ur.usuario_id) AND ((u.estado)::text = 'ACTIVO'::text))))
     JOIN seguridad.roles r ON ((r.rol_id = ur.rol_id)))
     JOIN seguridad.roles_permisos rp ON ((rp.rol_id = r.rol_id)))
     JOIN seguridad.permisos p ON ((p.permiso_id = rp.permiso_id)))
  WHERE (ur.revocado_en IS NULL);


--
-- Name: VIEW v_permisos_efectivos_usuario; Type: COMMENT; Schema: seguridad; Owner: -
--

COMMENT ON VIEW seguridad.v_permisos_efectivos_usuario IS 'Permisos vigentes de cada usuario activo. El servidor debe ademas validar el alcance sobre el recurso concreto.';


--
-- Name: historial_estado_solicitud; Type: TABLE; Schema: solicitudes; Owner: -
--

CREATE TABLE solicitudes.historial_estado_solicitud (
    historial_solicitud_id uuid DEFAULT gen_random_uuid() NOT NULL,
    solicitud_id uuid NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    cambiado_por_usuario_id uuid,
    notas text,
    cambiado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_historial_solicitud_estados CHECK ((((estado_nuevo)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'EN_REVISION'::character varying, 'APROBADA'::character varying, 'RECHAZADA'::character varying, 'CANCELADA'::character varying])::text[])) AND ((estado_anterior IS NULL) OR ((estado_anterior)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'EN_REVISION'::character varying, 'APROBADA'::character varying, 'RECHAZADA'::character varying, 'CANCELADA'::character varying])::text[])))))
);


--
-- Name: solicitudes; Type: TABLE; Schema: solicitudes; Owner: -
--

CREATE TABLE solicitudes.solicitudes (
    solicitud_id uuid DEFAULT gen_random_uuid() NOT NULL,
    solicitante_usuario_id uuid NOT NULL,
    tipo_solicitud_id uuid NOT NULL,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    solicitada_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resuelta_en timestamp with time zone,
    resuelta_por_usuario_id uuid,
    notas_resolucion text,
    CONSTRAINT ck_solicitudes_datos_resolucion CHECK (((((estado)::text = ANY ((ARRAY['APROBADA'::character varying, 'RECHAZADA'::character varying, 'CANCELADA'::character varying])::text[])) AND (resuelta_en IS NOT NULL)) OR (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'EN_REVISION'::character varying])::text[])) AND (resuelta_en IS NULL) AND (resuelta_por_usuario_id IS NULL)))),
    CONSTRAINT ck_solicitudes_estado CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'EN_REVISION'::character varying, 'APROBADA'::character varying, 'RECHAZADA'::character varying, 'CANCELADA'::character varying])::text[]))),
    CONSTRAINT ck_solicitudes_resolutor_obligatorio CHECK ((((estado)::text <> ALL ((ARRAY['APROBADA'::character varying, 'RECHAZADA'::character varying])::text[])) OR (resuelta_por_usuario_id IS NOT NULL))),
    CONSTRAINT ck_solicitudes_sin_autoresolucion CHECK (((resuelta_por_usuario_id IS NULL) OR (resuelta_por_usuario_id <> solicitante_usuario_id))),
    CONSTRAINT ck_solicitudes_tiempo_resolucion CHECK (((resuelta_en IS NULL) OR (resuelta_en >= solicitada_en)))
);


--
-- Name: solicitudes_documentos; Type: TABLE; Schema: solicitudes; Owner: -
--

CREATE TABLE solicitudes.solicitudes_documentos (
    solicitud_id uuid NOT NULL,
    documento_id uuid NOT NULL,
    adjuntado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tipos_solicitud; Type: TABLE; Schema: solicitudes; Owner: -
--

CREATE TABLE solicitudes.tipos_solicitud (
    tipo_solicitud_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    esta_activo boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_tipos_solicitud_codigo_mayusculas CHECK (((codigo)::text = upper((codigo)::text))),
    CONSTRAINT ck_tipos_solicitud_nombre_no_vacio CHECK ((btrim((nombre)::text) <> ''::text))
);


--
-- Name: alumnos_carreras alumnos_carreras_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.alumnos_carreras
    ADD CONSTRAINT alumnos_carreras_pkey PRIMARY KEY (alumno_carrera_id);


--
-- Name: alumnos alumnos_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.alumnos
    ADD CONSTRAINT alumnos_pkey PRIMARY KEY (alumno_id);


--
-- Name: asignaciones_profesor_grupo asignaciones_profesor_grupo_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.asignaciones_profesor_grupo
    ADD CONSTRAINT asignaciones_profesor_grupo_pkey PRIMARY KEY (asignacion_profesor_grupo_id);


--
-- Name: calificaciones calificaciones_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.calificaciones
    ADD CONSTRAINT calificaciones_pkey PRIMARY KEY (calificacion_id);


--
-- Name: carreras_materias carreras_materias_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.carreras_materias
    ADD CONSTRAINT carreras_materias_pkey PRIMARY KEY (carrera_materia_id);


--
-- Name: periodos_academicos ex_periodos_academicos_sin_traslape; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.periodos_academicos
    ADD CONSTRAINT ex_periodos_academicos_sin_traslape EXCLUDE USING gist (daterange(fecha_inicio, fecha_fin, '[]'::text) WITH &&) WHERE (((estado)::text <> 'CANCELADO'::text));


--
-- Name: sesiones_grupo ex_sesiones_aula_sin_traslape; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.sesiones_grupo
    ADD CONSTRAINT ex_sesiones_aula_sin_traslape EXCLUDE USING gist (aula WITH =, periodo_academico_id WITH =, dia_semana WITH =, academico.rango_hora(hora_inicio, hora_fin) WITH &&) WHERE ((aula IS NOT NULL));


--
-- Name: sesiones_grupo ex_sesiones_grupo_sin_traslape; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.sesiones_grupo
    ADD CONSTRAINT ex_sesiones_grupo_sin_traslape EXCLUDE USING gist (grupo_id WITH =, dia_semana WITH =, academico.rango_hora(hora_inicio, hora_fin) WITH &&);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (grupo_id);


--
-- Name: historial_calificaciones historial_calificaciones_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.historial_calificaciones
    ADD CONSTRAINT historial_calificaciones_pkey PRIMARY KEY (historial_calificacion_id);


--
-- Name: historial_estado_inscripcion historial_estado_inscripcion_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.historial_estado_inscripcion
    ADD CONSTRAINT historial_estado_inscripcion_pkey PRIMARY KEY (historial_inscripcion_id);


--
-- Name: inscripciones inscripciones_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.inscripciones
    ADD CONSTRAINT inscripciones_pkey PRIMARY KEY (inscripcion_id);


--
-- Name: materias materias_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.materias
    ADD CONSTRAINT materias_pkey PRIMARY KEY (materia_id);


--
-- Name: periodos_academicos periodos_academicos_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.periodos_academicos
    ADD CONSTRAINT periodos_academicos_pkey PRIMARY KEY (periodo_academico_id);


--
-- Name: profesores_carreras profesores_carreras_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.profesores_carreras
    ADD CONSTRAINT profesores_carreras_pkey PRIMARY KEY (profesor_carrera_id);


--
-- Name: profesores profesores_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.profesores
    ADD CONSTRAINT profesores_pkey PRIMARY KEY (profesor_id);


--
-- Name: sesiones_grupo sesiones_grupo_pkey; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.sesiones_grupo
    ADD CONSTRAINT sesiones_grupo_pkey PRIMARY KEY (sesion_grupo_id);


--
-- Name: alumnos_carreras uq_alumnos_carreras_inicio; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.alumnos_carreras
    ADD CONSTRAINT uq_alumnos_carreras_inicio UNIQUE (alumno_id, carrera_id, fecha_inicio);


--
-- Name: alumnos uq_alumnos_matricula; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.alumnos
    ADD CONSTRAINT uq_alumnos_matricula UNIQUE (matricula);


--
-- Name: alumnos uq_alumnos_persona; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.alumnos
    ADD CONSTRAINT uq_alumnos_persona UNIQUE (persona_id);


--
-- Name: calificaciones uq_calificaciones_inscripcion; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.calificaciones
    ADD CONSTRAINT uq_calificaciones_inscripcion UNIQUE (inscripcion_id);


--
-- Name: carreras_materias uq_carreras_materias; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.carreras_materias
    ADD CONSTRAINT uq_carreras_materias UNIQUE (carrera_id, materia_id);


--
-- Name: carreras_materias uq_carreras_materias_id_carrera; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.carreras_materias
    ADD CONSTRAINT uq_carreras_materias_id_carrera UNIQUE (carrera_materia_id, carrera_id);


--
-- Name: grupos uq_grupos_clave; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.grupos
    ADD CONSTRAINT uq_grupos_clave UNIQUE (carrera_materia_id, periodo_academico_id, clave_grupo);


--
-- Name: grupos uq_grupos_identidad; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.grupos
    ADD CONSTRAINT uq_grupos_identidad UNIQUE (grupo_id, carrera_id, carrera_materia_id, periodo_academico_id);


--
-- Name: inscripciones uq_inscripciones_alumno_grupo; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.inscripciones
    ADD CONSTRAINT uq_inscripciones_alumno_grupo UNIQUE (alumno_id, grupo_id);


--
-- Name: materias uq_materias_codigo; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.materias
    ADD CONSTRAINT uq_materias_codigo UNIQUE (codigo);


--
-- Name: periodos_academicos uq_periodos_academicos_codigo; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.periodos_academicos
    ADD CONSTRAINT uq_periodos_academicos_codigo UNIQUE (codigo);


--
-- Name: profesores_carreras uq_profesores_carreras_inicio; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.profesores_carreras
    ADD CONSTRAINT uq_profesores_carreras_inicio UNIQUE (profesor_id, carrera_id, fecha_inicio);


--
-- Name: profesores uq_profesores_numero_empleado; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.profesores
    ADD CONSTRAINT uq_profesores_numero_empleado UNIQUE (numero_empleado);


--
-- Name: profesores uq_profesores_persona; Type: CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.profesores
    ADD CONSTRAINT uq_profesores_persona UNIQUE (persona_id);


--
-- Name: bitacora bitacora_pkey; Type: CONSTRAINT; Schema: auditoria; Owner: -
--

ALTER TABLE ONLY auditoria.bitacora
    ADD CONSTRAINT bitacora_pkey PRIMARY KEY (bitacora_id);


--
-- Name: documentos documentos_pkey; Type: CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.documentos
    ADD CONSTRAINT documentos_pkey PRIMARY KEY (documento_id);


--
-- Name: tipos_documento tipos_documento_pkey; Type: CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.tipos_documento
    ADD CONSTRAINT tipos_documento_pkey PRIMARY KEY (tipo_documento_id);


--
-- Name: tipos_documento uq_tipos_documento_codigo; Type: CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.tipos_documento
    ADD CONSTRAINT uq_tipos_documento_codigo UNIQUE (codigo);


--
-- Name: versiones_documento uq_versiones_documento_clave; Type: CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.versiones_documento
    ADD CONSTRAINT uq_versiones_documento_clave UNIQUE (clave_almacenamiento);


--
-- Name: versiones_documento uq_versiones_documento_numero; Type: CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.versiones_documento
    ADD CONSTRAINT uq_versiones_documento_numero UNIQUE (documento_id, numero_version);


--
-- Name: versiones_documento versiones_documento_pkey; Type: CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.versiones_documento
    ADD CONSTRAINT versiones_documento_pkey PRIMARY KEY (version_documento_id);


--
-- Name: carreras carreras_pkey; Type: CONSTRAINT; Schema: nucleo; Owner: -
--

ALTER TABLE ONLY nucleo.carreras
    ADD CONSTRAINT carreras_pkey PRIMARY KEY (carrera_id);


--
-- Name: personas personas_pkey; Type: CONSTRAINT; Schema: nucleo; Owner: -
--

ALTER TABLE ONLY nucleo.personas
    ADD CONSTRAINT personas_pkey PRIMARY KEY (persona_id);


--
-- Name: carreras uq_carreras_codigo; Type: CONSTRAINT; Schema: nucleo; Owner: -
--

ALTER TABLE ONLY nucleo.carreras
    ADD CONSTRAINT uq_carreras_codigo UNIQUE (codigo);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (permiso_id);


--
-- Name: roles_permisos pk_roles_permisos; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.roles_permisos
    ADD CONSTRAINT pk_roles_permisos PRIMARY KEY (rol_id, permiso_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (rol_id);


--
-- Name: permisos uq_permisos_codigo; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.permisos
    ADD CONSTRAINT uq_permisos_codigo UNIQUE (codigo);


--
-- Name: roles uq_roles_codigo; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.roles
    ADD CONSTRAINT uq_roles_codigo UNIQUE (codigo);


--
-- Name: usuarios uq_usuarios_persona; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios
    ADD CONSTRAINT uq_usuarios_persona UNIQUE (persona_id);


--
-- Name: usuarios uq_usuarios_sujeto_identidad; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios
    ADD CONSTRAINT uq_usuarios_sujeto_identidad UNIQUE (sujeto_identidad);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (usuario_id);


--
-- Name: usuarios_roles usuarios_roles_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios_roles
    ADD CONSTRAINT usuarios_roles_pkey PRIMARY KEY (usuario_rol_id);


--
-- Name: historial_estado_solicitud historial_estado_solicitud_pkey; Type: CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.historial_estado_solicitud
    ADD CONSTRAINT historial_estado_solicitud_pkey PRIMARY KEY (historial_solicitud_id);


--
-- Name: solicitudes_documentos pk_solicitudes_documentos; Type: CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.solicitudes_documentos
    ADD CONSTRAINT pk_solicitudes_documentos PRIMARY KEY (solicitud_id, documento_id);


--
-- Name: solicitudes solicitudes_pkey; Type: CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.solicitudes
    ADD CONSTRAINT solicitudes_pkey PRIMARY KEY (solicitud_id);


--
-- Name: tipos_solicitud tipos_solicitud_pkey; Type: CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.tipos_solicitud
    ADD CONSTRAINT tipos_solicitud_pkey PRIMARY KEY (tipo_solicitud_id);


--
-- Name: tipos_solicitud uq_tipos_solicitud_codigo; Type: CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.tipos_solicitud
    ADD CONSTRAINT uq_tipos_solicitud_codigo UNIQUE (codigo);


--
-- Name: ix_alumnos_carreras_carrera; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_alumnos_carreras_carrera ON academico.alumnos_carreras USING btree (carrera_id, alumno_id);


--
-- Name: ix_asignaciones_profesor_grupo_vigente; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_asignaciones_profesor_grupo_vigente ON academico.asignaciones_profesor_grupo USING btree (grupo_id) WHERE (revocado_en IS NULL);


--
-- Name: ix_asignaciones_profesor_profesor; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_asignaciones_profesor_profesor ON academico.asignaciones_profesor_grupo USING btree (profesor_id);


--
-- Name: ix_calificaciones_actualizada_por; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_calificaciones_actualizada_por ON academico.calificaciones USING btree (actualizada_por_usuario_id);


--
-- Name: ix_calificaciones_capturada_por; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_calificaciones_capturada_por ON academico.calificaciones USING btree (capturada_por_usuario_id);


--
-- Name: ix_carreras_materias_materia; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_carreras_materias_materia ON academico.carreras_materias USING btree (materia_id);


--
-- Name: ix_grupos_carrera; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_grupos_carrera ON academico.grupos USING btree (carrera_id, periodo_academico_id);


--
-- Name: ix_grupos_carrera_materia; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_grupos_carrera_materia ON academico.grupos USING btree (carrera_materia_id);


--
-- Name: ix_grupos_periodo; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_grupos_periodo ON academico.grupos USING btree (periodo_academico_id, estado);


--
-- Name: ix_historial_calificaciones_calificacion; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_historial_calificaciones_calificacion ON academico.historial_calificaciones USING btree (calificacion_id, cambiado_en DESC);


--
-- Name: ix_historial_calificaciones_tipo; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_historial_calificaciones_tipo ON academico.historial_calificaciones USING btree (tipo_cambio, cambiado_en DESC);


--
-- Name: ix_historial_calificaciones_usuario; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_historial_calificaciones_usuario ON academico.historial_calificaciones USING btree (cambiado_por_usuario_id, cambiado_en DESC);


--
-- Name: ix_historial_inscripcion_inscripcion; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_historial_inscripcion_inscripcion ON academico.historial_estado_inscripcion USING btree (inscripcion_id, cambiado_en DESC);


--
-- Name: ix_historial_inscripcion_usuario; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_historial_inscripcion_usuario ON academico.historial_estado_inscripcion USING btree (cambiado_por_usuario_id);


--
-- Name: ix_inscripciones_alumno; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_inscripciones_alumno ON academico.inscripciones USING btree (alumno_id, estado);


--
-- Name: ix_inscripciones_grupo; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_inscripciones_grupo ON academico.inscripciones USING btree (grupo_id, estado);


--
-- Name: ix_inscripciones_materia_periodo; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_inscripciones_materia_periodo ON academico.inscripciones USING btree (carrera_materia_id, periodo_academico_id);


--
-- Name: ix_periodos_academicos_estado; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_periodos_academicos_estado ON academico.periodos_academicos USING btree (estado);


--
-- Name: ix_periodos_academicos_rango; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_periodos_academicos_rango ON academico.periodos_academicos USING btree (fecha_inicio, fecha_fin);


--
-- Name: ix_profesores_carreras_carrera_vigente; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_profesores_carreras_carrera_vigente ON academico.profesores_carreras USING btree (carrera_id, profesor_id) WHERE (fecha_fin IS NULL);


--
-- Name: ix_sesiones_aula; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_sesiones_aula ON academico.sesiones_grupo USING btree (aula, dia_semana) WHERE (aula IS NOT NULL);


--
-- Name: ix_sesiones_grupo; Type: INDEX; Schema: academico; Owner: -
--

CREATE INDEX ix_sesiones_grupo ON academico.sesiones_grupo USING btree (grupo_id, dia_semana, hora_inicio);


--
-- Name: ux_alumnos_carrera_vigente; Type: INDEX; Schema: academico; Owner: -
--

CREATE UNIQUE INDEX ux_alumnos_carrera_vigente ON academico.alumnos_carreras USING btree (alumno_id) WHERE (fecha_fin IS NULL);


--
-- Name: ux_asignaciones_profesor_grupo_vigente; Type: INDEX; Schema: academico; Owner: -
--

CREATE UNIQUE INDEX ux_asignaciones_profesor_grupo_vigente ON academico.asignaciones_profesor_grupo USING btree (profesor_id, grupo_id) WHERE (revocado_en IS NULL);


--
-- Name: ux_inscripciones_materia_periodo; Type: INDEX; Schema: academico; Owner: -
--

CREATE UNIQUE INDEX ux_inscripciones_materia_periodo ON academico.inscripciones USING btree (alumno_id, carrera_materia_id, periodo_academico_id) WHERE ((estado)::text <> 'CANCELADA'::text);


--
-- Name: ux_profesores_carreras_vigente; Type: INDEX; Schema: academico; Owner: -
--

CREATE UNIQUE INDEX ux_profesores_carreras_vigente ON academico.profesores_carreras USING btree (profesor_id, carrera_id) WHERE (fecha_fin IS NULL);


--
-- Name: ix_bitacora_accion_tiempo; Type: INDEX; Schema: auditoria; Owner: -
--

CREATE INDEX ix_bitacora_accion_tiempo ON auditoria.bitacora USING btree (codigo_accion, ocurrido_en DESC);


--
-- Name: ix_bitacora_actor_tiempo; Type: INDEX; Schema: auditoria; Owner: -
--

CREATE INDEX ix_bitacora_actor_tiempo ON auditoria.bitacora USING btree (actor_usuario_id, ocurrido_en DESC);


--
-- Name: ix_bitacora_metadatos; Type: INDEX; Schema: auditoria; Owner: -
--

CREATE INDEX ix_bitacora_metadatos ON auditoria.bitacora USING gin (metadatos jsonb_path_ops);


--
-- Name: ix_bitacora_recurso; Type: INDEX; Schema: auditoria; Owner: -
--

CREATE INDEX ix_bitacora_recurso ON auditoria.bitacora USING btree (tipo_recurso, recurso_id, ocurrido_en DESC);


--
-- Name: ix_documentos_propietario_estado; Type: INDEX; Schema: documentos; Owner: -
--

CREATE INDEX ix_documentos_propietario_estado ON documentos.documentos USING btree (propietario_usuario_id, estado);


--
-- Name: ix_documentos_tipo; Type: INDEX; Schema: documentos; Owner: -
--

CREATE INDEX ix_documentos_tipo ON documentos.documentos USING btree (tipo_documento_id);


--
-- Name: ix_versiones_documento_documento; Type: INDEX; Schema: documentos; Owner: -
--

CREATE INDEX ix_versiones_documento_documento ON documentos.versiones_documento USING btree (documento_id, numero_version DESC);


--
-- Name: ix_versiones_documento_subido_por; Type: INDEX; Schema: documentos; Owner: -
--

CREATE INDEX ix_versiones_documento_subido_por ON documentos.versiones_documento USING btree (subido_por_usuario_id);


--
-- Name: ux_versiones_documento_vigente; Type: INDEX; Schema: documentos; Owner: -
--

CREATE UNIQUE INDEX ux_versiones_documento_vigente ON documentos.versiones_documento USING btree (documento_id) WHERE es_vigente;


--
-- Name: ix_personas_apellidos; Type: INDEX; Schema: nucleo; Owner: -
--

CREATE INDEX ix_personas_apellidos ON nucleo.personas USING btree (apellido_paterno, apellido_materno, nombres);


--
-- Name: ix_personas_nombres_palabras; Type: INDEX; Schema: nucleo; Owner: -
--

CREATE INDEX ix_personas_nombres_palabras ON nucleo.personas USING gin (to_tsvector('simple'::regconfig, (nombre_completo)::text));


--
-- Name: ux_personas_correo; Type: INDEX; Schema: nucleo; Owner: -
--

CREATE UNIQUE INDEX ux_personas_correo ON nucleo.personas USING btree (lower((correo)::text));


--
-- Name: ux_personas_curp; Type: INDEX; Schema: nucleo; Owner: -
--

CREATE UNIQUE INDEX ux_personas_curp ON nucleo.personas USING btree (curp) WHERE (curp IS NOT NULL);


--
-- Name: ix_roles_permisos_permiso; Type: INDEX; Schema: seguridad; Owner: -
--

CREATE INDEX ix_roles_permisos_permiso ON seguridad.roles_permisos USING btree (permiso_id);


--
-- Name: ix_usuarios_roles_carrera; Type: INDEX; Schema: seguridad; Owner: -
--

CREATE INDEX ix_usuarios_roles_carrera ON seguridad.usuarios_roles USING btree (carrera_id);


--
-- Name: ix_usuarios_roles_rol_ambito_vigente; Type: INDEX; Schema: seguridad; Owner: -
--

CREATE INDEX ix_usuarios_roles_rol_ambito_vigente ON seguridad.usuarios_roles USING btree (rol_id, carrera_id) WHERE (revocado_en IS NULL);


--
-- Name: ix_usuarios_roles_usuario_vigente; Type: INDEX; Schema: seguridad; Owner: -
--

CREATE INDEX ix_usuarios_roles_usuario_vigente ON seguridad.usuarios_roles USING btree (usuario_id) WHERE (revocado_en IS NULL);


--
-- Name: ux_usuarios_roles_acotado_vigente; Type: INDEX; Schema: seguridad; Owner: -
--

CREATE UNIQUE INDEX ux_usuarios_roles_acotado_vigente ON seguridad.usuarios_roles USING btree (usuario_id, rol_id, carrera_id) WHERE ((carrera_id IS NOT NULL) AND (revocado_en IS NULL));


--
-- Name: ux_usuarios_roles_global_vigente; Type: INDEX; Schema: seguridad; Owner: -
--

CREATE UNIQUE INDEX ux_usuarios_roles_global_vigente ON seguridad.usuarios_roles USING btree (usuario_id, rol_id) WHERE ((carrera_id IS NULL) AND (revocado_en IS NULL));


--
-- Name: ix_historial_solicitud_solicitud; Type: INDEX; Schema: solicitudes; Owner: -
--

CREATE INDEX ix_historial_solicitud_solicitud ON solicitudes.historial_estado_solicitud USING btree (solicitud_id, cambiado_en DESC);


--
-- Name: ix_historial_solicitud_usuario; Type: INDEX; Schema: solicitudes; Owner: -
--

CREATE INDEX ix_historial_solicitud_usuario ON solicitudes.historial_estado_solicitud USING btree (cambiado_por_usuario_id);


--
-- Name: ix_solicitudes_documentos_documento; Type: INDEX; Schema: solicitudes; Owner: -
--

CREATE INDEX ix_solicitudes_documentos_documento ON solicitudes.solicitudes_documentos USING btree (documento_id);


--
-- Name: ix_solicitudes_resuelta_por; Type: INDEX; Schema: solicitudes; Owner: -
--

CREATE INDEX ix_solicitudes_resuelta_por ON solicitudes.solicitudes USING btree (resuelta_por_usuario_id);


--
-- Name: ix_solicitudes_solicitante_estado; Type: INDEX; Schema: solicitudes; Owner: -
--

CREATE INDEX ix_solicitudes_solicitante_estado ON solicitudes.solicitudes USING btree (solicitante_usuario_id, estado, solicitada_en DESC);


--
-- Name: ix_solicitudes_tipo_estado; Type: INDEX; Schema: solicitudes; Owner: -
--

CREATE INDEX ix_solicitudes_tipo_estado ON solicitudes.solicitudes USING btree (tipo_solicitud_id, estado);


--
-- Name: alumnos trg_alumnos_actualizado; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_alumnos_actualizado BEFORE UPDATE ON academico.alumnos FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: asignaciones_profesor_grupo trg_asignaciones_profesor_carrera; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_asignaciones_profesor_carrera BEFORE INSERT ON academico.asignaciones_profesor_grupo FOR EACH ROW EXECUTE FUNCTION academico.fn_validar_carrera_profesor_grupo();


--
-- Name: calificaciones trg_calificaciones_actualizado; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_calificaciones_actualizado BEFORE UPDATE ON academico.calificaciones FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: calificaciones trg_calificaciones_historial; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_calificaciones_historial AFTER INSERT OR UPDATE ON academico.calificaciones FOR EACH ROW EXECUTE FUNCTION academico.fn_registrar_cambio_calificacion();


--
-- Name: calificaciones trg_calificaciones_inscripcion_valida; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_calificaciones_inscripcion_valida BEFORE INSERT OR UPDATE ON academico.calificaciones FOR EACH ROW EXECUTE FUNCTION academico.fn_validar_inscripcion_calificacion();


--
-- Name: grupos trg_grupos_a_carrera; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_grupos_a_carrera BEFORE INSERT OR UPDATE OF carrera_materia_id ON academico.grupos FOR EACH ROW EXECUTE FUNCTION academico.fn_asignar_carrera_grupo();


--
-- Name: grupos trg_grupos_actualizado; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_grupos_actualizado BEFORE UPDATE ON academico.grupos FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: grupos trg_grupos_b_periodo; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_grupos_b_periodo BEFORE INSERT OR UPDATE OF periodo_academico_id ON academico.grupos FOR EACH ROW EXECUTE FUNCTION academico.fn_validar_periodo_grupo();


--
-- Name: historial_calificaciones trg_historial_calificaciones_sin_truncate; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_historial_calificaciones_sin_truncate BEFORE TRUNCATE ON academico.historial_calificaciones FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_rechazar_truncado();


--
-- Name: historial_calificaciones trg_historial_calificaciones_solo_insercion; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_historial_calificaciones_solo_insercion BEFORE DELETE OR UPDATE ON academico.historial_calificaciones FOR EACH ROW EXECUTE FUNCTION auditoria.fn_rechazar_modificacion();


--
-- Name: historial_estado_inscripcion trg_historial_inscripcion_sin_truncate; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_historial_inscripcion_sin_truncate BEFORE TRUNCATE ON academico.historial_estado_inscripcion FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_rechazar_truncado();


--
-- Name: historial_estado_inscripcion trg_historial_inscripcion_solo_insercion; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_historial_inscripcion_solo_insercion BEFORE DELETE OR UPDATE ON academico.historial_estado_inscripcion FOR EACH ROW EXECUTE FUNCTION auditoria.fn_rechazar_modificacion();


--
-- Name: inscripciones trg_inscripciones_a_llaves; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_inscripciones_a_llaves BEFORE INSERT OR UPDATE OF grupo_id ON academico.inscripciones FOR EACH ROW EXECUTE FUNCTION academico.fn_asignar_llaves_inscripcion();


--
-- Name: inscripciones trg_inscripciones_b_carrera; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_inscripciones_b_carrera BEFORE INSERT OR UPDATE OF alumno_id, grupo_id ON academico.inscripciones FOR EACH ROW EXECUTE FUNCTION academico.fn_validar_carrera_inscripcion();


--
-- Name: inscripciones trg_inscripciones_c_grupo; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_inscripciones_c_grupo BEFORE INSERT ON academico.inscripciones FOR EACH ROW EXECUTE FUNCTION academico.fn_validar_disponibilidad_grupo();


--
-- Name: inscripciones trg_inscripciones_historial; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_inscripciones_historial AFTER INSERT OR UPDATE OF estado ON academico.inscripciones FOR EACH ROW EXECUTE FUNCTION academico.fn_registrar_cambio_inscripcion();


--
-- Name: materias trg_materias_actualizado; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_materias_actualizado BEFORE UPDATE ON academico.materias FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: profesores trg_profesores_actualizado; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_profesores_actualizado BEFORE UPDATE ON academico.profesores FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: sesiones_grupo trg_sesiones_periodo; Type: TRIGGER; Schema: academico; Owner: -
--

CREATE TRIGGER trg_sesiones_periodo BEFORE INSERT OR UPDATE OF grupo_id ON academico.sesiones_grupo FOR EACH ROW EXECUTE FUNCTION academico.fn_asignar_periodo_sesion();


--
-- Name: bitacora trg_bitacora_momento_valido; Type: TRIGGER; Schema: auditoria; Owner: -
--

CREATE TRIGGER trg_bitacora_momento_valido BEFORE INSERT ON auditoria.bitacora FOR EACH ROW EXECUTE FUNCTION auditoria.fn_validar_momento_evento();


--
-- Name: bitacora trg_bitacora_sin_truncate; Type: TRIGGER; Schema: auditoria; Owner: -
--

CREATE TRIGGER trg_bitacora_sin_truncate BEFORE TRUNCATE ON auditoria.bitacora FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_rechazar_truncado();


--
-- Name: bitacora trg_bitacora_solo_insercion; Type: TRIGGER; Schema: auditoria; Owner: -
--

CREATE TRIGGER trg_bitacora_solo_insercion BEFORE DELETE OR UPDATE ON auditoria.bitacora FOR EACH ROW EXECUTE FUNCTION auditoria.fn_rechazar_modificacion();


--
-- Name: documentos trg_documentos_actualizado; Type: TRIGGER; Schema: documentos; Owner: -
--

CREATE TRIGGER trg_documentos_actualizado BEFORE UPDATE ON documentos.documentos FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: documentos trg_documentos_propietario_activo; Type: TRIGGER; Schema: documentos; Owner: -
--

CREATE TRIGGER trg_documentos_propietario_activo BEFORE INSERT ON documentos.documentos FOR EACH ROW EXECUTE FUNCTION documentos.fn_validar_propietario_activo();


--
-- Name: carreras trg_carreras_actualizado; Type: TRIGGER; Schema: nucleo; Owner: -
--

CREATE TRIGGER trg_carreras_actualizado BEFORE UPDATE ON nucleo.carreras FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: personas trg_personas_actualizado; Type: TRIGGER; Schema: nucleo; Owner: -
--

CREATE TRIGGER trg_personas_actualizado BEFORE UPDATE ON nucleo.personas FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: roles trg_roles_codigo_protegido; Type: TRIGGER; Schema: seguridad; Owner: -
--

CREATE TRIGGER trg_roles_codigo_protegido BEFORE UPDATE OF codigo ON seguridad.roles FOR EACH ROW EXECUTE FUNCTION seguridad.fn_proteger_codigo_rol();


--
-- Name: usuarios trg_usuarios_actualizado; Type: TRIGGER; Schema: seguridad; Owner: -
--

CREATE TRIGGER trg_usuarios_actualizado BEFORE UPDATE ON seguridad.usuarios FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();


--
-- Name: usuarios_roles trg_usuarios_roles_ambito; Type: TRIGGER; Schema: seguridad; Owner: -
--

CREATE TRIGGER trg_usuarios_roles_ambito BEFORE INSERT OR UPDATE OF rol_id, carrera_id ON seguridad.usuarios_roles FOR EACH ROW EXECUTE FUNCTION seguridad.fn_validar_ambito_rol();


--
-- Name: usuarios_roles trg_usuarios_roles_inmutable; Type: TRIGGER; Schema: seguridad; Owner: -
--

CREATE TRIGGER trg_usuarios_roles_inmutable BEFORE UPDATE ON seguridad.usuarios_roles FOR EACH ROW EXECUTE FUNCTION seguridad.fn_proteger_asignacion_rol();


--
-- Name: historial_estado_solicitud trg_historial_solicitud_sin_truncate; Type: TRIGGER; Schema: solicitudes; Owner: -
--

CREATE TRIGGER trg_historial_solicitud_sin_truncate BEFORE TRUNCATE ON solicitudes.historial_estado_solicitud FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_rechazar_truncado();


--
-- Name: historial_estado_solicitud trg_historial_solicitud_solo_insercion; Type: TRIGGER; Schema: solicitudes; Owner: -
--

CREATE TRIGGER trg_historial_solicitud_solo_insercion BEFORE DELETE OR UPDATE ON solicitudes.historial_estado_solicitud FOR EACH ROW EXECUTE FUNCTION auditoria.fn_rechazar_modificacion();


--
-- Name: solicitudes trg_solicitudes_historial; Type: TRIGGER; Schema: solicitudes; Owner: -
--

CREATE TRIGGER trg_solicitudes_historial AFTER INSERT OR UPDATE OF estado ON solicitudes.solicitudes FOR EACH ROW EXECUTE FUNCTION solicitudes.fn_registrar_cambio_solicitud();


--
-- Name: alumnos_carreras fk_alumnos_carreras_alumno; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.alumnos_carreras
    ADD CONSTRAINT fk_alumnos_carreras_alumno FOREIGN KEY (alumno_id) REFERENCES academico.alumnos(alumno_id) ON DELETE RESTRICT;


--
-- Name: alumnos_carreras fk_alumnos_carreras_carrera; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.alumnos_carreras
    ADD CONSTRAINT fk_alumnos_carreras_carrera FOREIGN KEY (carrera_id) REFERENCES nucleo.carreras(carrera_id) ON DELETE RESTRICT;


--
-- Name: alumnos fk_alumnos_persona; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.alumnos
    ADD CONSTRAINT fk_alumnos_persona FOREIGN KEY (persona_id) REFERENCES nucleo.personas(persona_id) ON DELETE RESTRICT;


--
-- Name: asignaciones_profesor_grupo fk_asignaciones_profesor_asignado_por; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.asignaciones_profesor_grupo
    ADD CONSTRAINT fk_asignaciones_profesor_asignado_por FOREIGN KEY (asignado_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE SET NULL;


--
-- Name: asignaciones_profesor_grupo fk_asignaciones_profesor_grupo; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.asignaciones_profesor_grupo
    ADD CONSTRAINT fk_asignaciones_profesor_grupo FOREIGN KEY (grupo_id) REFERENCES academico.grupos(grupo_id) ON DELETE RESTRICT;


--
-- Name: asignaciones_profesor_grupo fk_asignaciones_profesor_profesor; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.asignaciones_profesor_grupo
    ADD CONSTRAINT fk_asignaciones_profesor_profesor FOREIGN KEY (profesor_id) REFERENCES academico.profesores(profesor_id) ON DELETE RESTRICT;


--
-- Name: asignaciones_profesor_grupo fk_asignaciones_profesor_revocado_por; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.asignaciones_profesor_grupo
    ADD CONSTRAINT fk_asignaciones_profesor_revocado_por FOREIGN KEY (revocado_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE SET NULL;


--
-- Name: calificaciones fk_calificaciones_actualizada_por; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.calificaciones
    ADD CONSTRAINT fk_calificaciones_actualizada_por FOREIGN KEY (actualizada_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE RESTRICT;


--
-- Name: calificaciones fk_calificaciones_capturada_por; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.calificaciones
    ADD CONSTRAINT fk_calificaciones_capturada_por FOREIGN KEY (capturada_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE RESTRICT;


--
-- Name: calificaciones fk_calificaciones_inscripcion; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.calificaciones
    ADD CONSTRAINT fk_calificaciones_inscripcion FOREIGN KEY (inscripcion_id) REFERENCES academico.inscripciones(inscripcion_id) ON DELETE RESTRICT;


--
-- Name: carreras_materias fk_carreras_materias_carrera; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.carreras_materias
    ADD CONSTRAINT fk_carreras_materias_carrera FOREIGN KEY (carrera_id) REFERENCES nucleo.carreras(carrera_id) ON DELETE RESTRICT;


--
-- Name: carreras_materias fk_carreras_materias_materia; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.carreras_materias
    ADD CONSTRAINT fk_carreras_materias_materia FOREIGN KEY (materia_id) REFERENCES academico.materias(materia_id) ON DELETE RESTRICT;


--
-- Name: grupos fk_grupos_carrera_materia; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.grupos
    ADD CONSTRAINT fk_grupos_carrera_materia FOREIGN KEY (carrera_materia_id, carrera_id) REFERENCES academico.carreras_materias(carrera_materia_id, carrera_id) ON DELETE RESTRICT;


--
-- Name: grupos fk_grupos_periodo; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.grupos
    ADD CONSTRAINT fk_grupos_periodo FOREIGN KEY (periodo_academico_id) REFERENCES academico.periodos_academicos(periodo_academico_id) ON DELETE RESTRICT;


--
-- Name: historial_calificaciones fk_historial_calificaciones_calificacion; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.historial_calificaciones
    ADD CONSTRAINT fk_historial_calificaciones_calificacion FOREIGN KEY (calificacion_id) REFERENCES academico.calificaciones(calificacion_id) ON DELETE RESTRICT;


--
-- Name: historial_calificaciones fk_historial_calificaciones_usuario; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.historial_calificaciones
    ADD CONSTRAINT fk_historial_calificaciones_usuario FOREIGN KEY (cambiado_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE RESTRICT;


--
-- Name: historial_estado_inscripcion fk_historial_inscripcion_inscripcion; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.historial_estado_inscripcion
    ADD CONSTRAINT fk_historial_inscripcion_inscripcion FOREIGN KEY (inscripcion_id) REFERENCES academico.inscripciones(inscripcion_id) ON DELETE RESTRICT;


--
-- Name: historial_estado_inscripcion fk_historial_inscripcion_usuario; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.historial_estado_inscripcion
    ADD CONSTRAINT fk_historial_inscripcion_usuario FOREIGN KEY (cambiado_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE SET NULL;


--
-- Name: inscripciones fk_inscripciones_alumno; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.inscripciones
    ADD CONSTRAINT fk_inscripciones_alumno FOREIGN KEY (alumno_id) REFERENCES academico.alumnos(alumno_id) ON DELETE RESTRICT;


--
-- Name: inscripciones fk_inscripciones_grupo; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.inscripciones
    ADD CONSTRAINT fk_inscripciones_grupo FOREIGN KEY (grupo_id, carrera_id, carrera_materia_id, periodo_academico_id) REFERENCES academico.grupos(grupo_id, carrera_id, carrera_materia_id, periodo_academico_id) ON DELETE RESTRICT;


--
-- Name: profesores_carreras fk_profesores_carreras_carrera; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.profesores_carreras
    ADD CONSTRAINT fk_profesores_carreras_carrera FOREIGN KEY (carrera_id) REFERENCES nucleo.carreras(carrera_id) ON DELETE RESTRICT;


--
-- Name: profesores_carreras fk_profesores_carreras_profesor; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.profesores_carreras
    ADD CONSTRAINT fk_profesores_carreras_profesor FOREIGN KEY (profesor_id) REFERENCES academico.profesores(profesor_id) ON DELETE RESTRICT;


--
-- Name: profesores fk_profesores_persona; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.profesores
    ADD CONSTRAINT fk_profesores_persona FOREIGN KEY (persona_id) REFERENCES nucleo.personas(persona_id) ON DELETE RESTRICT;


--
-- Name: sesiones_grupo fk_sesiones_grupo; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.sesiones_grupo
    ADD CONSTRAINT fk_sesiones_grupo FOREIGN KEY (grupo_id) REFERENCES academico.grupos(grupo_id) ON DELETE RESTRICT;


--
-- Name: sesiones_grupo fk_sesiones_periodo; Type: FK CONSTRAINT; Schema: academico; Owner: -
--

ALTER TABLE ONLY academico.sesiones_grupo
    ADD CONSTRAINT fk_sesiones_periodo FOREIGN KEY (periodo_academico_id) REFERENCES academico.periodos_academicos(periodo_academico_id) ON DELETE RESTRICT;


--
-- Name: bitacora fk_bitacora_actor; Type: FK CONSTRAINT; Schema: auditoria; Owner: -
--

ALTER TABLE ONLY auditoria.bitacora
    ADD CONSTRAINT fk_bitacora_actor FOREIGN KEY (actor_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE SET NULL;


--
-- Name: documentos fk_documentos_propietario; Type: FK CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.documentos
    ADD CONSTRAINT fk_documentos_propietario FOREIGN KEY (propietario_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE RESTRICT;


--
-- Name: documentos fk_documentos_tipo; Type: FK CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.documentos
    ADD CONSTRAINT fk_documentos_tipo FOREIGN KEY (tipo_documento_id) REFERENCES documentos.tipos_documento(tipo_documento_id) ON DELETE RESTRICT;


--
-- Name: versiones_documento fk_versiones_documento_documento; Type: FK CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.versiones_documento
    ADD CONSTRAINT fk_versiones_documento_documento FOREIGN KEY (documento_id) REFERENCES documentos.documentos(documento_id) ON DELETE RESTRICT;


--
-- Name: versiones_documento fk_versiones_documento_subido_por; Type: FK CONSTRAINT; Schema: documentos; Owner: -
--

ALTER TABLE ONLY documentos.versiones_documento
    ADD CONSTRAINT fk_versiones_documento_subido_por FOREIGN KEY (subido_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE RESTRICT;


--
-- Name: roles_permisos fk_roles_permisos_permiso; Type: FK CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.roles_permisos
    ADD CONSTRAINT fk_roles_permisos_permiso FOREIGN KEY (permiso_id) REFERENCES seguridad.permisos(permiso_id) ON DELETE CASCADE;


--
-- Name: roles_permisos fk_roles_permisos_rol; Type: FK CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.roles_permisos
    ADD CONSTRAINT fk_roles_permisos_rol FOREIGN KEY (rol_id) REFERENCES seguridad.roles(rol_id) ON DELETE CASCADE;


--
-- Name: usuarios fk_usuarios_persona; Type: FK CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios
    ADD CONSTRAINT fk_usuarios_persona FOREIGN KEY (persona_id) REFERENCES nucleo.personas(persona_id) ON DELETE RESTRICT;


--
-- Name: usuarios_roles fk_usuarios_roles_asignado_por; Type: FK CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios_roles
    ADD CONSTRAINT fk_usuarios_roles_asignado_por FOREIGN KEY (asignado_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE SET NULL;


--
-- Name: usuarios_roles fk_usuarios_roles_carrera; Type: FK CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios_roles
    ADD CONSTRAINT fk_usuarios_roles_carrera FOREIGN KEY (carrera_id) REFERENCES nucleo.carreras(carrera_id) ON DELETE RESTRICT;


--
-- Name: usuarios_roles fk_usuarios_roles_revocado_por; Type: FK CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios_roles
    ADD CONSTRAINT fk_usuarios_roles_revocado_por FOREIGN KEY (revocado_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE SET NULL;


--
-- Name: usuarios_roles fk_usuarios_roles_rol; Type: FK CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios_roles
    ADD CONSTRAINT fk_usuarios_roles_rol FOREIGN KEY (rol_id) REFERENCES seguridad.roles(rol_id) ON DELETE RESTRICT;


--
-- Name: usuarios_roles fk_usuarios_roles_usuario; Type: FK CONSTRAINT; Schema: seguridad; Owner: -
--

ALTER TABLE ONLY seguridad.usuarios_roles
    ADD CONSTRAINT fk_usuarios_roles_usuario FOREIGN KEY (usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE RESTRICT;


--
-- Name: historial_estado_solicitud fk_historial_solicitud_solicitud; Type: FK CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.historial_estado_solicitud
    ADD CONSTRAINT fk_historial_solicitud_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes.solicitudes(solicitud_id) ON DELETE RESTRICT;


--
-- Name: historial_estado_solicitud fk_historial_solicitud_usuario; Type: FK CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.historial_estado_solicitud
    ADD CONSTRAINT fk_historial_solicitud_usuario FOREIGN KEY (cambiado_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE SET NULL;


--
-- Name: solicitudes_documentos fk_solicitudes_documentos_documento; Type: FK CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.solicitudes_documentos
    ADD CONSTRAINT fk_solicitudes_documentos_documento FOREIGN KEY (documento_id) REFERENCES documentos.documentos(documento_id) ON DELETE RESTRICT;


--
-- Name: solicitudes_documentos fk_solicitudes_documentos_solicitud; Type: FK CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.solicitudes_documentos
    ADD CONSTRAINT fk_solicitudes_documentos_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes.solicitudes(solicitud_id) ON DELETE RESTRICT;


--
-- Name: solicitudes fk_solicitudes_resuelta_por; Type: FK CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.solicitudes
    ADD CONSTRAINT fk_solicitudes_resuelta_por FOREIGN KEY (resuelta_por_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE RESTRICT;


--
-- Name: solicitudes fk_solicitudes_solicitante; Type: FK CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.solicitudes
    ADD CONSTRAINT fk_solicitudes_solicitante FOREIGN KEY (solicitante_usuario_id) REFERENCES seguridad.usuarios(usuario_id) ON DELETE RESTRICT;


--
-- Name: solicitudes fk_solicitudes_tipo; Type: FK CONSTRAINT; Schema: solicitudes; Owner: -
--

ALTER TABLE ONLY solicitudes.solicitudes
    ADD CONSTRAINT fk_solicitudes_tipo FOREIGN KEY (tipo_solicitud_id) REFERENCES solicitudes.tipos_solicitud(tipo_solicitud_id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20261007000000');
