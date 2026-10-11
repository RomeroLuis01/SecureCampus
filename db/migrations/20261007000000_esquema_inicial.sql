-- migrate:up
-- ---------------------------------------------------------------------------
-- SecureCampus - esquema inicial (PostgreSQL 16)
--
-- Esta migracion ya incluye las correcciones de logica de negocio y los
-- permisos de los roles. Requisito: los roles securecampus_app y
-- securecampus_lectura los crea db/init/01-roles.sh (con contrasena desde .env)
-- al inicializar el volumen; aqui solo se les otorgan permisos.
-- dbmate ya envuelve la migracion en una transaccion: no usar BEGIN/COMMIT.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 0. Extensiones requeridas
--    btree_gist: necesaria para la restriccion EXCLUDE de periodos academicos.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ---------------------------------------------------------------------------
-- 1. Esquemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS nucleo;
CREATE SCHEMA IF NOT EXISTS seguridad;
CREATE SCHEMA IF NOT EXISTS academico;
CREATE SCHEMA IF NOT EXISTS documentos;
CREATE SCHEMA IF NOT EXISTS solicitudes;
CREATE SCHEMA IF NOT EXISTS auditoria;

COMMENT ON SCHEMA nucleo      IS 'Entidades transversales: personas y carreras.';
COMMENT ON SCHEMA seguridad   IS 'Identidad de aplicacion, roles y permisos.';
COMMENT ON SCHEMA academico   IS 'Alumnos, profesores, materias, grupos y calificaciones.';
COMMENT ON SCHEMA documentos  IS 'Metadatos de documentos; los binarios viven fuera de la BD.';
COMMENT ON SCHEMA solicitudes IS 'Solicitudes de tramites y su historial.';
COMMENT ON SCHEMA auditoria   IS 'Bitacora de eventos de seguridad y negocio.';

-- ---------------------------------------------------------------------------
-- 2. Tipos y funciones de apoyo
-- ---------------------------------------------------------------------------

-- Rango de horas, necesario para detectar traslapes de aula.
DO $bloque$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'rango_hora' AND n.nspname = 'academico'
    ) THEN
        CREATE TYPE academico.rango_hora AS RANGE (subtype = time);
    END IF;
END;
$bloque$;

CREATE OR REPLACE FUNCTION nucleo.fn_actualizar_marca_tiempo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION nucleo.fn_actualizar_marca_tiempo() IS
'Mantiene actualizado_en en cada UPDATE.';

-- Usuario que opera la transaccion actual, declarado por el backend.
CREATE OR REPLACE FUNCTION seguridad.fn_usuario_actual()
RETURNS uuid
LANGUAGE plpgsql
STABLE
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

COMMENT ON FUNCTION seguridad.fn_usuario_actual() IS
'Lee app.usuario_id fijado con SET LOCAL. Devuelve NULL si no se declaro o si no es un uuid valido.';

CREATE OR REPLACE FUNCTION auditoria.fn_rechazar_modificacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo insercion y no admite % ',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION auditoria.fn_rechazar_modificacion() IS
'Bloquea UPDATE y DELETE sobre tablas de bitacora.';

CREATE OR REPLACE FUNCTION auditoria.fn_rechazar_truncado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo insercion: TRUNCATE esta prohibido',
        TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Nucleo: carreras y personas
-- ---------------------------------------------------------------------------
CREATE TABLE nucleo.carreras (
    carrera_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          varchar(30)  NOT NULL,
    nombre          varchar(200) NOT NULL,
    descripcion     text,
    estado          varchar(20)  NOT NULL DEFAULT 'ACTIVA',
    creado_en       timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_carreras_codigo UNIQUE (codigo),
    CONSTRAINT ck_carreras_codigo_mayusculas CHECK (codigo = upper(codigo)),
    CONSTRAINT ck_carreras_codigo_no_vacio CHECK (btrim(codigo) <> ''),
    CONSTRAINT ck_carreras_nombre_no_vacio CHECK (btrim(nombre) <> ''),
    CONSTRAINT ck_carreras_estado CHECK (estado IN ('ACTIVA', 'INACTIVA'))
);

CREATE TABLE nucleo.personas (
    persona_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres           varchar(200) NOT NULL,
    apellido_paterno  varchar(100) NOT NULL,
    apellido_materno  varchar(100),
    nombre_completo   varchar(420)
        GENERATED ALWAYS AS (
            nombres || ' ' || apellido_paterno ||
            COALESCE(' ' || apellido_materno, '')
        ) STORED,
    correo            varchar(320) NOT NULL,
    telefono          varchar(30),
    fecha_nacimiento  date,
    genero            varchar(20),
    curp              char(18),
    creado_en         timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_personas_nombres_no_vacio CHECK (btrim(nombres) <> ''),
    CONSTRAINT ck_personas_nombres_espaciado
        CHECK (nombres = btrim(regexp_replace(nombres, '\s+', ' ', 'g'))),
    CONSTRAINT ck_personas_apellido_no_vacio CHECK (btrim(apellido_paterno) <> ''),
    CONSTRAINT ck_personas_correo_formato
        CHECK (correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    CONSTRAINT ck_personas_fecha_nacimiento
        CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento < CURRENT_DATE),
    CONSTRAINT ck_personas_genero CHECK (
        genero IS NULL OR genero IN
        ('MASCULINO', 'FEMENINO', 'NO_BINARIO', 'PREFIERO_NO_DECIR', 'OTRO')
    ),
    CONSTRAINT ck_personas_curp_formato CHECK (
        curp IS NULL OR curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$'
    )
);

COMMENT ON TABLE nucleo.personas IS
'Datos personales. Una persona puede ser alumno, profesor o ambos sin duplicarse.';

COMMENT ON COLUMN nucleo.personas.nombres IS
'Uno o varios nombres de pila separados por espacio. Para buscar por un nombre suelto se usa el indice ix_personas_nombres_palabras.';

COMMENT ON COLUMN nucleo.personas.nombre_completo IS
'Derivada. Evita que la aplicacion arme el nombre de formas distintas en cada pantalla.';

COMMENT ON COLUMN nucleo.personas.curp IS
'La CURP codifica sexo y fecha de nacimiento, pero NO se valida contra genero ni fecha_nacimiento: una persona no binaria conserva H o M en su CURP oficial.';

CREATE UNIQUE INDEX ux_personas_correo
    ON nucleo.personas (lower(correo));

CREATE UNIQUE INDEX ux_personas_curp
    ON nucleo.personas (curp)
    WHERE curp IS NOT NULL;

CREATE INDEX ix_personas_apellidos
    ON nucleo.personas (apellido_paterno, apellido_materno, nombres);

CREATE INDEX ix_personas_nombres_palabras
    ON nucleo.personas USING gin (to_tsvector('simple', nombre_completo));

-- ---------------------------------------------------------------------------
-- 4. Seguridad: usuarios, roles y permisos
-- ---------------------------------------------------------------------------
CREATE TABLE seguridad.usuarios (
    usuario_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id        uuid NOT NULL,
    sujeto_identidad  varchar(255) NOT NULL,
    estado            varchar(20) NOT NULL DEFAULT 'ACTIVO',
    creado_en         timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_usuarios_persona UNIQUE (persona_id),
    CONSTRAINT uq_usuarios_sujeto_identidad UNIQUE (sujeto_identidad),
    CONSTRAINT ck_usuarios_sujeto_no_vacio CHECK (btrim(sujeto_identidad) <> ''),
    CONSTRAINT ck_usuarios_estado CHECK (estado IN ('ACTIVO', 'SUSPENDIDO', 'DESHABILITADO')),
    CONSTRAINT fk_usuarios_persona
        FOREIGN KEY (persona_id)
        REFERENCES nucleo.personas (persona_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE seguridad.usuarios IS
'Identidad de aplicacion. Las credenciales son externas (OIDC); aqui no se guardan contrasenas.';

COMMENT ON COLUMN seguridad.usuarios.sujeto_identidad IS
'Identificador externo inmutable (claim sub de OIDC). Nunca contrasenas ni tokens.';

CREATE TABLE seguridad.roles (
    rol_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          varchar(50) NOT NULL,
    nombre          varchar(100) NOT NULL,
    descripcion     text,
    es_rol_sistema  boolean NOT NULL DEFAULT false,

    CONSTRAINT uq_roles_codigo UNIQUE (codigo),
    CONSTRAINT ck_roles_codigo_mayusculas CHECK (codigo = upper(codigo)),
    CONSTRAINT ck_roles_nombre_no_vacio CHECK (btrim(nombre) <> '')
);

CREATE TABLE seguridad.permisos (
    permiso_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo        varchar(100) NOT NULL,
    nombre        varchar(150) NOT NULL,
    descripcion   text,

    CONSTRAINT uq_permisos_codigo UNIQUE (codigo),
    CONSTRAINT ck_permisos_codigo_no_vacio CHECK (btrim(codigo) <> ''),
    CONSTRAINT ck_permisos_nombre_no_vacio CHECK (btrim(nombre) <> '')
);

CREATE TABLE seguridad.roles_permisos (
    rol_id       uuid NOT NULL,
    permiso_id   uuid NOT NULL,
    otorgado_en  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_roles_permisos PRIMARY KEY (rol_id, permiso_id),
    CONSTRAINT fk_roles_permisos_rol
        FOREIGN KEY (rol_id)
        REFERENCES seguridad.roles (rol_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_roles_permisos_permiso
        FOREIGN KEY (permiso_id)
        REFERENCES seguridad.permisos (permiso_id)
        ON DELETE CASCADE
);

CREATE INDEX ix_roles_permisos_permiso
    ON seguridad.roles_permisos (permiso_id);

CREATE TABLE seguridad.usuarios_roles (
    usuario_rol_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id                uuid NOT NULL,
    rol_id                    uuid NOT NULL,
    carrera_id                uuid,
    asignado_en               timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asignado_por_usuario_id   uuid,
    revocado_en               timestamptz,
    revocado_por_usuario_id   uuid,

    CONSTRAINT ck_usuarios_roles_fechas
        CHECK (revocado_en IS NULL OR revocado_en >= asignado_en),
    CONSTRAINT ck_usuarios_roles_revocacion_completa
        CHECK (revocado_en IS NULL OR revocado_por_usuario_id IS NOT NULL),
    -- CORRECCION 2. Separacion de funciones: nadie se otorga ni se quita
    -- privilegios a si mismo. El alta inicial del sistema deja el campo en NULL.
    CONSTRAINT ck_usuarios_roles_sin_autoasignacion
        CHECK (asignado_por_usuario_id IS NULL OR asignado_por_usuario_id <> usuario_id),
    CONSTRAINT ck_usuarios_roles_sin_autorevocacion
        CHECK (revocado_por_usuario_id IS NULL OR revocado_por_usuario_id <> usuario_id),
    CONSTRAINT fk_usuarios_roles_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_usuarios_roles_rol
        FOREIGN KEY (rol_id)
        REFERENCES seguridad.roles (rol_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_usuarios_roles_carrera
        FOREIGN KEY (carrera_id)
        REFERENCES nucleo.carreras (carrera_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_usuarios_roles_asignado_por
        FOREIGN KEY (asignado_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_usuarios_roles_revocado_por
        FOREIGN KEY (revocado_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE SET NULL
);

COMMENT ON TABLE seguridad.usuarios_roles IS
'Asignaciones de rol. carrera_id delimita el ambito de roles acotados como JEFE_CARRERA.';

-- Un mismo rol global no puede estar asignado dos veces vigente.
CREATE UNIQUE INDEX ux_usuarios_roles_global_vigente
    ON seguridad.usuarios_roles (usuario_id, rol_id)
    WHERE carrera_id IS NULL AND revocado_en IS NULL;

-- Un mismo rol acotado no puede repetirse vigente en la misma carrera.
CREATE UNIQUE INDEX ux_usuarios_roles_acotado_vigente
    ON seguridad.usuarios_roles (usuario_id, rol_id, carrera_id)
    WHERE carrera_id IS NOT NULL AND revocado_en IS NULL;

CREATE INDEX ix_usuarios_roles_usuario_vigente
    ON seguridad.usuarios_roles (usuario_id)
    WHERE revocado_en IS NULL;

CREATE INDEX ix_usuarios_roles_rol_ambito_vigente
    ON seguridad.usuarios_roles (rol_id, carrera_id)
    WHERE revocado_en IS NULL;

CREATE INDEX ix_usuarios_roles_carrera
    ON seguridad.usuarios_roles (carrera_id);

-- El rol JEFE_CARRERA obliga a declarar el ambito de carrera.
CREATE OR REPLACE FUNCTION seguridad.fn_validar_ambito_rol()
RETURNS trigger
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

CREATE TRIGGER trg_usuarios_roles_ambito
BEFORE INSERT OR UPDATE OF rol_id, carrera_id
ON seguridad.usuarios_roles
FOR EACH ROW
EXECUTE FUNCTION seguridad.fn_validar_ambito_rol();

CREATE OR REPLACE FUNCTION seguridad.fn_proteger_asignacion_rol()
RETURNS trigger
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

CREATE TRIGGER trg_usuarios_roles_inmutable
BEFORE UPDATE ON seguridad.usuarios_roles
FOR EACH ROW EXECUTE FUNCTION seguridad.fn_proteger_asignacion_rol();

CREATE OR REPLACE FUNCTION seguridad.fn_proteger_codigo_rol()
RETURNS trigger
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

CREATE TRIGGER trg_roles_codigo_protegido
BEFORE UPDATE OF codigo ON seguridad.roles
FOR EACH ROW EXECUTE FUNCTION seguridad.fn_proteger_codigo_rol();

-- ---------------------------------------------------------------------------
-- 5. Academico: alumnos y profesores
-- ---------------------------------------------------------------------------
CREATE TABLE academico.alumnos (
    alumno_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id      uuid NOT NULL,
    matricula       varchar(50) NOT NULL,
    fecha_ingreso   date,
    estado          varchar(20) NOT NULL DEFAULT 'ACTIVO',
    creado_en       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_alumnos_persona UNIQUE (persona_id),
    CONSTRAINT uq_alumnos_matricula UNIQUE (matricula),
    CONSTRAINT ck_alumnos_matricula_no_vacia CHECK (btrim(matricula) <> ''),
    CONSTRAINT ck_alumnos_estado CHECK (
        estado IN ('ACTIVO', 'INACTIVO', 'EGRESADO', 'BAJA')
    ),
    CONSTRAINT fk_alumnos_persona
        FOREIGN KEY (persona_id)
        REFERENCES nucleo.personas (persona_id)
        ON DELETE RESTRICT
);

CREATE TABLE academico.alumnos_carreras (
    alumno_carrera_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id         uuid NOT NULL,
    carrera_id        uuid NOT NULL,
    fecha_inicio      date NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin         date,

    CONSTRAINT uq_alumnos_carreras_inicio UNIQUE (alumno_id, carrera_id, fecha_inicio),
    CONSTRAINT ck_alumnos_carreras_fechas
        CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT fk_alumnos_carreras_alumno
        FOREIGN KEY (alumno_id)
        REFERENCES academico.alumnos (alumno_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_alumnos_carreras_carrera
        FOREIGN KEY (carrera_id)
        REFERENCES nucleo.carreras (carrera_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE academico.alumnos_carreras IS
'Historial alumno-carrera. El indice parcial permite una sola carrera vigente a la vez.';

CREATE UNIQUE INDEX ux_alumnos_carrera_vigente
    ON academico.alumnos_carreras (alumno_id)
    WHERE fecha_fin IS NULL;

CREATE INDEX ix_alumnos_carreras_carrera
    ON academico.alumnos_carreras (carrera_id, alumno_id);

CREATE TABLE academico.profesores (
    profesor_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id       uuid NOT NULL,
    numero_empleado  varchar(50) NOT NULL,
    estado           varchar(20) NOT NULL DEFAULT 'ACTIVO',
    creado_en        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_profesores_persona UNIQUE (persona_id),
    CONSTRAINT uq_profesores_numero_empleado UNIQUE (numero_empleado),
    CONSTRAINT ck_profesores_numero_no_vacio CHECK (btrim(numero_empleado) <> ''),
    CONSTRAINT ck_profesores_estado CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT fk_profesores_persona
        FOREIGN KEY (persona_id)
        REFERENCES nucleo.personas (persona_id)
        ON DELETE RESTRICT
);

CREATE TABLE academico.profesores_carreras (
    profesor_carrera_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profesor_id         uuid NOT NULL,
    carrera_id          uuid NOT NULL,
    fecha_inicio        date NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin           date,

    CONSTRAINT uq_profesores_carreras_inicio UNIQUE (profesor_id, carrera_id, fecha_inicio),
    CONSTRAINT ck_profesores_carreras_fechas
        CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT fk_profesores_carreras_profesor
        FOREIGN KEY (profesor_id)
        REFERENCES academico.profesores (profesor_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_profesores_carreras_carrera
        FOREIGN KEY (carrera_id)
        REFERENCES nucleo.carreras (carrera_id)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX ux_profesores_carreras_vigente
    ON academico.profesores_carreras (profesor_id, carrera_id)
    WHERE fecha_fin IS NULL;

CREATE INDEX ix_profesores_carreras_carrera_vigente
    ON academico.profesores_carreras (carrera_id, profesor_id)
    WHERE fecha_fin IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Academico: materias, plan de estudios, periodos y grupos
-- ---------------------------------------------------------------------------
CREATE TABLE academico.materias (
    materia_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          varchar(30) NOT NULL,
    nombre          varchar(200) NOT NULL,
    descripcion     text,
    creditos        smallint NOT NULL,   -- CORRECCION 15
    estado          varchar(20) NOT NULL DEFAULT 'ACTIVA',
    creado_en       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_materias_codigo UNIQUE (codigo),
    CONSTRAINT ck_materias_codigo_mayusculas CHECK (codigo = upper(codigo)),
    CONSTRAINT ck_materias_nombre_no_vacio CHECK (btrim(nombre) <> ''),
    CONSTRAINT ck_materias_creditos CHECK (creditos > 0),
    CONSTRAINT ck_materias_estado CHECK (estado IN ('ACTIVA', 'INACTIVA'))
);

CREATE TABLE academico.carreras_materias (
    carrera_materia_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    carrera_id         uuid NOT NULL,
    materia_id         uuid NOT NULL,
    semestre           smallint,
    es_obligatoria     boolean NOT NULL DEFAULT true,

    CONSTRAINT uq_carreras_materias UNIQUE (carrera_id, materia_id),
    -- Clave candidata necesaria para las FK compuestas de coherencia.
    CONSTRAINT uq_carreras_materias_id_carrera UNIQUE (carrera_materia_id, carrera_id),
    CONSTRAINT ck_carreras_materias_semestre CHECK (semestre IS NULL OR semestre > 0),
    CONSTRAINT fk_carreras_materias_carrera
        FOREIGN KEY (carrera_id)
        REFERENCES nucleo.carreras (carrera_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_carreras_materias_materia
        FOREIGN KEY (materia_id)
        REFERENCES academico.materias (materia_id)
        ON DELETE RESTRICT
);

CREATE INDEX ix_carreras_materias_materia
    ON academico.carreras_materias (materia_id);

CREATE TABLE academico.periodos_academicos (
    periodo_academico_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo               varchar(30) NOT NULL,
    nombre               varchar(150) NOT NULL,
    fecha_inicio         date NOT NULL,
    fecha_fin            date NOT NULL,
    estado               varchar(20) NOT NULL DEFAULT 'PLANEADO',

    CONSTRAINT uq_periodos_academicos_codigo UNIQUE (codigo),
    CONSTRAINT ck_periodos_academicos_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT ck_periodos_academicos_nombre_no_vacio CHECK (btrim(nombre) <> ''),
    CONSTRAINT ck_periodos_academicos_estado CHECK (
        estado IN ('PLANEADO', 'ACTIVO', 'CERRADO', 'CANCELADO')
    ),
    -- Dos periodos vigentes no pueden traslaparse en el calendario.
    CONSTRAINT ex_periodos_academicos_sin_traslape
        EXCLUDE USING gist (daterange(fecha_inicio, fecha_fin, '[]') WITH &&)
        WHERE (estado <> 'CANCELADO')
);

CREATE INDEX ix_periodos_academicos_rango
    ON academico.periodos_academicos (fecha_inicio, fecha_fin);

CREATE INDEX ix_periodos_academicos_estado
    ON academico.periodos_academicos (estado);

CREATE TABLE academico.grupos (
    grupo_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    carrera_materia_id   uuid NOT NULL,
    periodo_academico_id uuid NOT NULL,
    carrera_id           uuid NOT NULL,   -- derivada, la llena un trigger
    clave_grupo          varchar(30) NOT NULL,
    cupo_maximo          integer,
    estado               varchar(20) NOT NULL DEFAULT 'PLANEADO',
    creado_en            timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_grupos_clave
        UNIQUE (carrera_materia_id, periodo_academico_id, clave_grupo),
    -- Clave candidata que permite a inscripciones heredar el contexto completo.
    CONSTRAINT uq_grupos_identidad
        UNIQUE (grupo_id, carrera_id, carrera_materia_id, periodo_academico_id),
    CONSTRAINT ck_grupos_clave_no_vacia CHECK (btrim(clave_grupo) <> ''),
    CONSTRAINT ck_grupos_cupo CHECK (cupo_maximo IS NULL OR cupo_maximo > 0),
    CONSTRAINT ck_grupos_estado CHECK (
        estado IN ('PLANEADO', 'ABIERTO', 'CERRADO', 'CANCELADO')
    ),
    -- Garantiza que carrera_id corresponde realmente al plan de estudios.
    CONSTRAINT fk_grupos_carrera_materia
        FOREIGN KEY (carrera_materia_id, carrera_id)
        REFERENCES academico.carreras_materias (carrera_materia_id, carrera_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_grupos_periodo
        FOREIGN KEY (periodo_academico_id)
        REFERENCES academico.periodos_academicos (periodo_academico_id)
        ON DELETE RESTRICT
);

COMMENT ON COLUMN academico.grupos.carrera_id IS
'Desnormalizacion controlada: la asigna un trigger y la FK compuesta impide que se desvie del plan de estudios.';

CREATE INDEX ix_grupos_periodo
    ON academico.grupos (periodo_academico_id, estado);

CREATE INDEX ix_grupos_carrera_materia
    ON academico.grupos (carrera_materia_id);

CREATE INDEX ix_grupos_carrera
    ON academico.grupos (carrera_id, periodo_academico_id);

CREATE OR REPLACE FUNCTION academico.fn_asignar_carrera_grupo()
RETURNS trigger
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

CREATE TRIGGER trg_grupos_a_carrera
BEFORE INSERT OR UPDATE OF carrera_materia_id
ON academico.grupos
FOR EACH ROW
EXECUTE FUNCTION academico.fn_asignar_carrera_grupo();

-- CORRECCION 7. Solo se crean grupos en periodos PLANEADO o ACTIVO.
-- Se valida en INSERT y cuando cambia el periodo, pero NO en cualquier UPDATE:
-- de otro modo seria imposible cerrar o cancelar un grupo una vez que su
-- periodo pasa a CERRADO, que es justo la operacion de fin de semestre.
CREATE OR REPLACE FUNCTION academico.fn_validar_periodo_grupo()
RETURNS trigger
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

CREATE TRIGGER trg_grupos_b_periodo
BEFORE INSERT OR UPDATE OF periodo_academico_id
ON academico.grupos
FOR EACH ROW
EXECUTE FUNCTION academico.fn_validar_periodo_grupo();

-- El periodo de las sesiones siempre sigue al periodo de su grupo.
CREATE OR REPLACE FUNCTION academico.fn_propagar_periodo_a_sesiones()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE academico.sesiones_grupo
       SET periodo_academico_id = NEW.periodo_academico_id
     WHERE grupo_id = NEW.grupo_id;

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION academico.fn_propagar_periodo_a_sesiones() IS
'Mantiene sesiones_grupo.periodo_academico_id igual al del grupo. Si el cambio provoca un traslape de aula en el periodo nuevo, la restriccion de exclusion aborta la operacion completa.';

CREATE TRIGGER trg_grupos_c_propagar_periodo
AFTER UPDATE OF periodo_academico_id
ON academico.grupos
FOR EACH ROW
WHEN (OLD.periodo_academico_id IS DISTINCT FROM NEW.periodo_academico_id)
EXECUTE FUNCTION academico.fn_propagar_periodo_a_sesiones();

CREATE TABLE academico.sesiones_grupo (
    sesion_grupo_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id             uuid NOT NULL,
    periodo_academico_id uuid NOT NULL,   -- derivada del grupo (trigger)
    dia_semana           smallint NOT NULL,
    hora_inicio          time NOT NULL,
    hora_fin             time NOT NULL,
    aula                 varchar(50),

    CONSTRAINT ck_sesiones_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_sesiones_horas CHECK (hora_fin > hora_inicio),
    CONSTRAINT ck_sesiones_aula_no_vacia CHECK (aula IS NULL OR btrim(aula) <> ''),
    CONSTRAINT fk_sesiones_grupo
        FOREIGN KEY (grupo_id) REFERENCES academico.grupos (grupo_id) ON DELETE RESTRICT,
    CONSTRAINT fk_sesiones_periodo
        FOREIGN KEY (periodo_academico_id)
        REFERENCES academico.periodos_academicos (periodo_academico_id) ON DELETE RESTRICT,
    -- Una misma aula no admite dos sesiones traslapadas el mismo dia dentro
    -- del mismo periodo.
    CONSTRAINT ex_sesiones_aula_sin_traslape
        EXCLUDE USING gist (
            aula WITH =,
            periodo_academico_id WITH =,
            dia_semana WITH =,
            academico.rango_hora(hora_inicio, hora_fin) WITH &&
        ) WHERE (aula IS NOT NULL),
    -- Un mismo grupo tampoco puede tener dos sesiones encimadas.
    CONSTRAINT ex_sesiones_grupo_sin_traslape
        EXCLUDE USING gist (
            grupo_id WITH =,
            dia_semana WITH =,
            academico.rango_hora(hora_inicio, hora_fin) WITH &&
        )
);

COMMENT ON TABLE academico.sesiones_grupo IS
'Horario del grupo, una fila por sesion semanal. dia_semana sigue ISO: 1 = lunes, 7 = domingo.';

COMMENT ON COLUMN academico.sesiones_grupo.aula IS
'El aula vive en la sesion y no en el grupo porque un mismo grupo puede sesionar en aulas distintas, por ejemplo teoria y laboratorio.';

CREATE INDEX ix_sesiones_grupo
    ON academico.sesiones_grupo (grupo_id, dia_semana, hora_inicio);

CREATE INDEX ix_sesiones_aula
    ON academico.sesiones_grupo (aula, dia_semana) WHERE aula IS NOT NULL;

CREATE OR REPLACE FUNCTION academico.fn_asignar_periodo_sesion()
RETURNS trigger
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

CREATE TRIGGER trg_sesiones_periodo
BEFORE INSERT OR UPDATE OF grupo_id
ON academico.sesiones_grupo
FOR EACH ROW
EXECUTE FUNCTION academico.fn_asignar_periodo_sesion();

-- ---------------------------------------------------------------------------
-- 7. Academico: asignacion docente
-- ---------------------------------------------------------------------------
CREATE TABLE academico.asignaciones_profesor_grupo (
    asignacion_profesor_grupo_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profesor_id                  uuid NOT NULL,
    grupo_id                     uuid NOT NULL,
    asignado_en                  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asignado_por_usuario_id      uuid,
    revocado_en                  timestamptz,
    revocado_por_usuario_id      uuid,

    CONSTRAINT ck_asignaciones_profesor_fechas
        CHECK (revocado_en IS NULL OR revocado_en >= asignado_en),
    CONSTRAINT ck_asignaciones_profesor_revocacion_completa
        CHECK (revocado_en IS NULL OR revocado_por_usuario_id IS NOT NULL),
    CONSTRAINT fk_asignaciones_profesor_profesor
        FOREIGN KEY (profesor_id)
        REFERENCES academico.profesores (profesor_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_asignaciones_profesor_grupo
        FOREIGN KEY (grupo_id)
        REFERENCES academico.grupos (grupo_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_asignaciones_profesor_asignado_por
        FOREIGN KEY (asignado_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_asignaciones_profesor_revocado_por
        FOREIGN KEY (revocado_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE SET NULL
);

COMMENT ON TABLE academico.asignaciones_profesor_grupo IS
'Define que grupos puede gestionar un profesor. El servidor debe verificar esta relacion antes de capturar calificaciones o listas.';

CREATE UNIQUE INDEX ux_asignaciones_profesor_grupo_vigente
    ON academico.asignaciones_profesor_grupo (profesor_id, grupo_id)
    WHERE revocado_en IS NULL;

CREATE INDEX ix_asignaciones_profesor_grupo_vigente
    ON academico.asignaciones_profesor_grupo (grupo_id)
    WHERE revocado_en IS NULL;

CREATE INDEX ix_asignaciones_profesor_profesor
    ON academico.asignaciones_profesor_grupo (profesor_id);

-- Un profesor ACTIVO solo recibe grupos de carreras donde este adscrito y vigente.
CREATE OR REPLACE FUNCTION academico.fn_validar_carrera_profesor_grupo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_carrera_grupo   uuid;
    v_estado_profesor varchar(20);
BEGIN
    SELECT p.estado INTO v_estado_profesor
    FROM academico.profesores p
    WHERE p.profesor_id = NEW.profesor_id;

    IF v_estado_profesor IS DISTINCT FROM 'ACTIVO' THEN
        RAISE EXCEPTION
            'El profesor % no puede recibir grupos: su estado es %',
            NEW.profesor_id, COALESCE(v_estado_profesor, 'inexistente')
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

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

CREATE TRIGGER trg_asignaciones_profesor_carrera
BEFORE INSERT ON academico.asignaciones_profesor_grupo
FOR EACH ROW
EXECUTE FUNCTION academico.fn_validar_carrera_profesor_grupo();

-- ---------------------------------------------------------------------------
-- 8. Academico: inscripciones
-- ---------------------------------------------------------------------------
CREATE TABLE academico.inscripciones (
    inscripcion_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id            uuid NOT NULL,
    grupo_id             uuid NOT NULL,
    carrera_id           uuid NOT NULL,   -- derivadas del grupo (trigger)
    carrera_materia_id   uuid NOT NULL,
    periodo_academico_id uuid NOT NULL,
    estado               varchar(20) NOT NULL DEFAULT 'INSCRITO',
    inscrito_en          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completado_en        timestamptz,
    cancelado_en         timestamptz,

    -- La unicidad por (alumno, materia, periodo) en filas no canceladas la da
    -- ux_inscripciones_materia_periodo; tras cancelar, el alumno se reinscribe
    -- con una fila nueva (que vuelve a pasar por cupo y estado del grupo).
    CONSTRAINT ck_inscripciones_estado CHECK (
        estado IN ('INSCRITO', 'COMPLETADA', 'CANCELADA')
    ),
    CONSTRAINT ck_inscripciones_coherencia_fechas CHECK (
        (estado = 'INSCRITO'   AND completado_en IS NULL     AND cancelado_en IS NULL)
     OR (estado = 'COMPLETADA' AND completado_en IS NOT NULL AND cancelado_en IS NULL)
     OR (estado = 'CANCELADA'  AND cancelado_en  IS NOT NULL AND completado_en IS NULL)
    ),
    CONSTRAINT fk_inscripciones_alumno
        FOREIGN KEY (alumno_id)
        REFERENCES academico.alumnos (alumno_id)
        ON DELETE RESTRICT,
    -- Impide que las columnas derivadas se desvien del grupo real.
    CONSTRAINT fk_inscripciones_grupo
        FOREIGN KEY (grupo_id, carrera_id, carrera_materia_id, periodo_academico_id)
        REFERENCES academico.grupos (grupo_id, carrera_id, carrera_materia_id, periodo_academico_id)
        ON DELETE RESTRICT
);

-- Un alumno no puede cursar dos grupos de la misma materia en el mismo periodo.
CREATE UNIQUE INDEX ux_inscripciones_materia_periodo
    ON academico.inscripciones (alumno_id, carrera_materia_id, periodo_academico_id)
    WHERE estado <> 'CANCELADA';

CREATE INDEX ix_inscripciones_alumno
    ON academico.inscripciones (alumno_id, estado);

CREATE INDEX ix_inscripciones_grupo
    ON academico.inscripciones (grupo_id, estado);

CREATE INDEX ix_inscripciones_materia_periodo
    ON academico.inscripciones (carrera_materia_id, periodo_academico_id);

CREATE OR REPLACE FUNCTION academico.fn_asignar_llaves_inscripcion()
RETURNS trigger
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

CREATE TRIGGER trg_inscripciones_a_llaves
BEFORE INSERT OR UPDATE OF grupo_id
ON academico.inscripciones
FOR EACH ROW
EXECUTE FUNCTION academico.fn_asignar_llaves_inscripcion();

-- Solo alumnos ACTIVOS con la carrera del grupo VIGENTE (fecha_fin IS NULL) pueden inscribirse.
CREATE OR REPLACE FUNCTION academico.fn_validar_carrera_inscripcion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_alumno varchar(20);
BEGIN
    SELECT a.estado INTO v_estado_alumno
    FROM academico.alumnos a
    WHERE a.alumno_id = NEW.alumno_id;

    IF v_estado_alumno IS DISTINCT FROM 'ACTIVO' THEN
        RAISE EXCEPTION
            'El alumno % no puede inscribirse: su estado es %',
            NEW.alumno_id, COALESCE(v_estado_alumno, 'inexistente')
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM academico.alumnos_carreras ac
        WHERE ac.alumno_id  = NEW.alumno_id
          AND ac.carrera_id = NEW.carrera_id
          AND ac.fecha_fin IS NULL
    ) THEN
        RAISE EXCEPTION
            'El alumno % no tiene vigente la carrera del grupo %',
            NEW.alumno_id, NEW.grupo_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inscripciones_b_carrera
BEFORE INSERT OR UPDATE OF alumno_id, grupo_id
ON academico.inscripciones
FOR EACH ROW
EXECUTE FUNCTION academico.fn_validar_carrera_inscripcion();

CREATE OR REPLACE FUNCTION academico.fn_validar_disponibilidad_grupo()
RETURNS trigger
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

CREATE TRIGGER trg_inscripciones_c_grupo
BEFORE INSERT ON academico.inscripciones
FOR EACH ROW
EXECUTE FUNCTION academico.fn_validar_disponibilidad_grupo();

CREATE TABLE academico.historial_estado_inscripcion (
    historial_inscripcion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id           uuid NOT NULL,
    estado_anterior          varchar(20),
    estado_nuevo             varchar(20) NOT NULL,
    cambiado_por_usuario_id  uuid,
    motivo                   text,
    cambiado_en              timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_historial_inscripcion_estados CHECK (
        estado_nuevo IN ('INSCRITO', 'COMPLETADA', 'CANCELADA')
        AND (estado_anterior IS NULL OR estado_anterior IN ('INSCRITO', 'COMPLETADA', 'CANCELADA'))
    ),
    CONSTRAINT fk_historial_inscripcion_inscripcion
        FOREIGN KEY (inscripcion_id)
        REFERENCES academico.inscripciones (inscripcion_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_historial_inscripcion_usuario
        FOREIGN KEY (cambiado_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE SET NULL
);

CREATE INDEX ix_historial_inscripcion_inscripcion
    ON academico.historial_estado_inscripcion (inscripcion_id, cambiado_en DESC);

CREATE INDEX ix_historial_inscripcion_usuario
    ON academico.historial_estado_inscripcion (cambiado_por_usuario_id);

CREATE OR REPLACE FUNCTION academico.fn_registrar_cambio_inscripcion()
RETURNS trigger
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

-- Transiciones validas: INSCRITO -> COMPLETADA | CANCELADA, ambos estados finales.
-- Para reinscribirse tras cancelar se crea una inscripcion nueva.
CREATE OR REPLACE FUNCTION academico.fn_validar_transicion_inscripcion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.estado = NEW.estado THEN
        RETURN NEW;
    END IF;

    IF OLD.estado <> 'INSCRITO' THEN
        RAISE EXCEPTION
            'La inscripcion % esta en estado final (%) y no puede pasar a %',
            NEW.inscripcion_id, OLD.estado, NEW.estado
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION academico.fn_validar_transicion_inscripcion() IS
'INSCRITO -> COMPLETADA | CANCELADA. Ambos destinos son estados finales.';

CREATE TRIGGER trg_inscripciones_transicion
BEFORE UPDATE OF estado
ON academico.inscripciones
FOR EACH ROW
EXECUTE FUNCTION academico.fn_validar_transicion_inscripcion();

CREATE TRIGGER trg_inscripciones_historial
AFTER INSERT OR UPDATE OF estado
ON academico.inscripciones
FOR EACH ROW
EXECUTE FUNCTION academico.fn_registrar_cambio_inscripcion();

CREATE TRIGGER trg_historial_inscripcion_solo_insercion
BEFORE UPDATE OR DELETE ON academico.historial_estado_inscripcion
FOR EACH ROW EXECUTE FUNCTION auditoria.fn_rechazar_modificacion();

CREATE TRIGGER trg_historial_inscripcion_sin_truncate
BEFORE TRUNCATE ON academico.historial_estado_inscripcion
FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_rechazar_truncado();

-- ---------------------------------------------------------------------------
-- 9. Academico: calificaciones e historial de cambios
-- ---------------------------------------------------------------------------
CREATE TABLE academico.calificaciones (
    calificacion_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id             uuid NOT NULL,
    valor_calificacion         numeric(5,2),
    estado                     varchar(20) NOT NULL DEFAULT 'PENDIENTE',
    capturada_por_usuario_id   uuid,
    capturada_en               timestamptz,
    actualizada_por_usuario_id uuid,
    creado_en                  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en             timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_calificaciones_inscripcion UNIQUE (inscripcion_id),
    CONSTRAINT ck_calificaciones_estado CHECK (estado IN ('PENDIENTE', 'CAPTURADA')),
    CONSTRAINT ck_calificaciones_rango CHECK (
        valor_calificacion IS NULL
        OR (valor_calificacion >= 0 AND valor_calificacion <= 100)
    ),
    CONSTRAINT ck_calificaciones_coherencia_captura CHECK (
        (estado = 'PENDIENTE'
            AND valor_calificacion IS NULL
            AND capturada_por_usuario_id IS NULL
            AND capturada_en IS NULL)
     OR (estado = 'CAPTURADA'
            AND valor_calificacion IS NOT NULL
            AND capturada_por_usuario_id IS NOT NULL
            AND capturada_en IS NOT NULL)
    ),
    CONSTRAINT fk_calificaciones_inscripcion
        FOREIGN KEY (inscripcion_id)
        REFERENCES academico.inscripciones (inscripcion_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_calificaciones_capturada_por
        FOREIGN KEY (capturada_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_calificaciones_actualizada_por
        FOREIGN KEY (actualizada_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE academico.calificaciones IS
'Una calificacion final vigente por inscripcion. La escala se acota a 0-100; ajustar si la institucion usa otra.';

CREATE INDEX ix_calificaciones_capturada_por
    ON academico.calificaciones (capturada_por_usuario_id);

CREATE INDEX ix_calificaciones_actualizada_por
    ON academico.calificaciones (actualizada_por_usuario_id);

CREATE OR REPLACE FUNCTION academico.fn_validar_inscripcion_calificacion()
RETURNS trigger
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

CREATE TRIGGER trg_calificaciones_inscripcion_valida
BEFORE INSERT OR UPDATE ON academico.calificaciones
FOR EACH ROW
EXECUTE FUNCTION academico.fn_validar_inscripcion_calificacion();

CREATE TABLE academico.historial_calificaciones (
    historial_calificacion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    calificacion_id           uuid NOT NULL,
    valor_anterior            numeric(5,2),
    valor_nuevo               numeric(5,2),
    estado_anterior           varchar(20),
    estado_nuevo              varchar(20) NOT NULL,
    tipo_cambio               varchar(20) NOT NULL,
    metadatos_cambio          jsonb,
    cambiado_por_usuario_id   uuid NOT NULL,
    motivo                    text,
    cambiado_en               timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_historial_calificaciones_valores CHECK (
        (valor_anterior IS NULL OR (valor_anterior >= 0 AND valor_anterior <= 100))
        AND (valor_nuevo IS NULL OR (valor_nuevo >= 0 AND valor_nuevo <= 100))
    ),
    CONSTRAINT ck_historial_calificaciones_estados CHECK (
        estado_nuevo IN ('PENDIENTE', 'CAPTURADA')
        AND (estado_anterior IS NULL OR estado_anterior IN ('PENDIENTE', 'CAPTURADA'))
    ),
    CONSTRAINT ck_historial_calificaciones_tipo CHECK (
        tipo_cambio IN ('ALTA', 'VALOR', 'METADATOS')
    ),
    CONSTRAINT fk_historial_calificaciones_calificacion
        FOREIGN KEY (calificacion_id)
        REFERENCES academico.calificaciones (calificacion_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_historial_calificaciones_usuario
        FOREIGN KEY (cambiado_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE academico.historial_calificaciones IS
'Evidencia de toda alta o cambio de calificacion. Tabla de solo insercion: el autor es obligatorio.';

CREATE INDEX ix_historial_calificaciones_calificacion
    ON academico.historial_calificaciones (calificacion_id, cambiado_en DESC);

CREATE INDEX ix_historial_calificaciones_usuario
    ON academico.historial_calificaciones (cambiado_por_usuario_id, cambiado_en DESC);

CREATE INDEX ix_historial_calificaciones_tipo
    ON academico.historial_calificaciones (tipo_cambio, cambiado_en DESC);

COMMENT ON COLUMN academico.historial_calificaciones.metadatos_cambio IS
'Detalle de los campos de trazabilidad que cambiaron, cuando tipo_cambio = METADATOS.';

CREATE OR REPLACE FUNCTION academico.fn_registrar_cambio_calificacion()
RETURNS trigger
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

CREATE TRIGGER trg_calificaciones_historial
AFTER INSERT OR UPDATE ON academico.calificaciones
FOR EACH ROW
EXECUTE FUNCTION academico.fn_registrar_cambio_calificacion();

CREATE TRIGGER trg_historial_calificaciones_solo_insercion
BEFORE UPDATE OR DELETE ON academico.historial_calificaciones
FOR EACH ROW EXECUTE FUNCTION auditoria.fn_rechazar_modificacion();

CREATE TRIGGER trg_historial_calificaciones_sin_truncate
BEFORE TRUNCATE ON academico.historial_calificaciones
FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_rechazar_truncado();

-- ---------------------------------------------------------------------------
-- 10. Documentos (solo metadatos; los binarios van en almacenamiento externo)
-- ---------------------------------------------------------------------------
CREATE TABLE documentos.tipos_documento (
    tipo_documento_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo            varchar(50) NOT NULL,
    nombre            varchar(150) NOT NULL,
    descripcion       text,
    esta_activo       boolean NOT NULL DEFAULT true,

    CONSTRAINT uq_tipos_documento_codigo UNIQUE (codigo),
    CONSTRAINT ck_tipos_documento_codigo_mayusculas CHECK (codigo = upper(codigo)),
    CONSTRAINT ck_tipos_documento_nombre_no_vacio CHECK (btrim(nombre) <> '')
);

CREATE TABLE documentos.documentos (
    documento_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    propietario_usuario_id uuid NOT NULL,
    tipo_documento_id     uuid NOT NULL,
    titulo                varchar(250) NOT NULL,
    estado                varchar(20) NOT NULL DEFAULT 'ACTIVO',
    creado_en             timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_documentos_titulo_no_vacio CHECK (btrim(titulo) <> ''),
    CONSTRAINT ck_documentos_estado CHECK (
        estado IN ('ACTIVO', 'EN_CUARENTENA', 'RECHAZADO', 'ARCHIVADO')
    ),
    CONSTRAINT fk_documentos_propietario
        FOREIGN KEY (propietario_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_documentos_tipo
        FOREIGN KEY (tipo_documento_id)
        REFERENCES documentos.tipos_documento (tipo_documento_id)
        ON DELETE RESTRICT
);

CREATE INDEX ix_documentos_propietario_estado
    ON documentos.documentos (propietario_usuario_id, estado);

CREATE INDEX ix_documentos_tipo
    ON documentos.documentos (tipo_documento_id);

CREATE OR REPLACE FUNCTION documentos.fn_validar_propietario_activo()
RETURNS trigger
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

CREATE TRIGGER trg_documentos_propietario_activo
BEFORE INSERT ON documentos.documentos
FOR EACH ROW
EXECUTE FUNCTION documentos.fn_validar_propietario_activo();

CREATE TABLE documentos.versiones_documento (
    version_documento_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id           uuid NOT NULL,
    numero_version         integer NOT NULL,
    clave_almacenamiento   varchar(500) NOT NULL,
    nombre_archivo_original varchar(255) NOT NULL,
    tipo_mime              varchar(150) NOT NULL,
    -- Derivada del nombre original: evita que ambas columnas se contradigan.
    extension_archivo      varchar(20)
        GENERATED ALWAYS AS (lower(substring(nombre_archivo_original from '\.([^.\/]+)$'))) STORED,
    tamano_bytes           bigint NOT NULL,
    sha256_hex             char(64) NOT NULL,
    es_vigente             boolean NOT NULL DEFAULT true,
    subido_por_usuario_id  uuid NOT NULL,
    subido_en              timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_versiones_documento_numero UNIQUE (documento_id, numero_version),
    CONSTRAINT uq_versiones_documento_clave UNIQUE (clave_almacenamiento),
    CONSTRAINT ck_versiones_documento_numero CHECK (numero_version > 0),
    CONSTRAINT ck_versiones_documento_tamano CHECK (tamano_bytes >= 0),
    CONSTRAINT ck_versiones_documento_sha256 CHECK (sha256_hex ~ '^[0-9A-Fa-f]{64}$'),
    CONSTRAINT ck_versiones_documento_nombre CHECK (btrim(nombre_archivo_original) <> ''),
    CONSTRAINT fk_versiones_documento_documento
        FOREIGN KEY (documento_id)
        REFERENCES documentos.documentos (documento_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_versiones_documento_subido_por
        FOREIGN KEY (subido_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE documentos.versiones_documento IS
'Solo metadatos de almacenamiento de objetos. El contenido binario vive en almacenamiento privado, nunca en esta tabla.';

CREATE UNIQUE INDEX ux_versiones_documento_vigente
    ON documentos.versiones_documento (documento_id)
    WHERE es_vigente;

CREATE INDEX ix_versiones_documento_documento
    ON documentos.versiones_documento (documento_id, numero_version DESC);

CREATE INDEX ix_versiones_documento_subido_por
    ON documentos.versiones_documento (subido_por_usuario_id);

-- ---------------------------------------------------------------------------
-- 11. Solicitudes
-- ---------------------------------------------------------------------------
CREATE TABLE solicitudes.tipos_solicitud (
    tipo_solicitud_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo            varchar(50) NOT NULL,
    nombre            varchar(150) NOT NULL,
    descripcion       text,
    esta_activo       boolean NOT NULL DEFAULT true,

    CONSTRAINT uq_tipos_solicitud_codigo UNIQUE (codigo),
    CONSTRAINT ck_tipos_solicitud_codigo_mayusculas CHECK (codigo = upper(codigo)),
    CONSTRAINT ck_tipos_solicitud_nombre_no_vacio CHECK (btrim(nombre) <> '')
);

CREATE TABLE solicitudes.solicitudes (
    solicitud_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitante_usuario_id   uuid NOT NULL,
    tipo_solicitud_id        uuid NOT NULL,
    estado                   varchar(20) NOT NULL DEFAULT 'PENDIENTE',
    solicitada_en            timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resuelta_en              timestamptz,
    resuelta_por_usuario_id  uuid,
    notas_resolucion         text,

    CONSTRAINT ck_solicitudes_estado CHECK (
        estado IN ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CANCELADA')
    ),
    CONSTRAINT ck_solicitudes_tiempo_resolucion CHECK (
        resuelta_en IS NULL OR resuelta_en >= solicitada_en
    ),
    CONSTRAINT ck_solicitudes_datos_resolucion CHECK (
        (estado IN ('APROBADA', 'RECHAZADA', 'CANCELADA') AND resuelta_en IS NOT NULL)
     OR (estado IN ('PENDIENTE', 'EN_REVISION') AND resuelta_en IS NULL
         AND resuelta_por_usuario_id IS NULL)
    ),
    -- CORRECCION 6. APROBADA y RECHAZADA exigen un resolutor distinto del
    -- solicitante. CANCELADA se exceptua porque cancelar la propia solicitud
    -- es legitimo, y por eso ahi resuelta_por_usuario_id puede quedar en NULL.
    CONSTRAINT ck_solicitudes_sin_autoresolucion CHECK (
        resuelta_por_usuario_id IS NULL
        OR resuelta_por_usuario_id <> solicitante_usuario_id
    ),
    CONSTRAINT ck_solicitudes_resolutor_obligatorio CHECK (
        estado NOT IN ('APROBADA', 'RECHAZADA') OR resuelta_por_usuario_id IS NOT NULL
    ),
    CONSTRAINT fk_solicitudes_solicitante
        FOREIGN KEY (solicitante_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_tipo
        FOREIGN KEY (tipo_solicitud_id)
        REFERENCES solicitudes.tipos_solicitud (tipo_solicitud_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_resuelta_por
        FOREIGN KEY (resuelta_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT
);

CREATE INDEX ix_solicitudes_solicitante_estado
    ON solicitudes.solicitudes (solicitante_usuario_id, estado, solicitada_en DESC);

CREATE INDEX ix_solicitudes_tipo_estado
    ON solicitudes.solicitudes (tipo_solicitud_id, estado);

CREATE INDEX ix_solicitudes_resuelta_por
    ON solicitudes.solicitudes (resuelta_por_usuario_id);

CREATE TABLE solicitudes.historial_estado_solicitud (
    historial_solicitud_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id            uuid NOT NULL,
    estado_anterior         varchar(20),
    estado_nuevo            varchar(20) NOT NULL,
    cambiado_por_usuario_id uuid,
    notas                   text,
    cambiado_en             timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_historial_solicitud_estados CHECK (
        estado_nuevo IN ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CANCELADA')
        AND (estado_anterior IS NULL OR estado_anterior IN
             ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CANCELADA'))
    ),
    CONSTRAINT fk_historial_solicitud_solicitud
        FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes.solicitudes (solicitud_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_historial_solicitud_usuario
        FOREIGN KEY (cambiado_por_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE SET NULL
);

CREATE INDEX ix_historial_solicitud_solicitud
    ON solicitudes.historial_estado_solicitud (solicitud_id, cambiado_en DESC);

CREATE INDEX ix_historial_solicitud_usuario
    ON solicitudes.historial_estado_solicitud (cambiado_por_usuario_id);

-- CORRECCION 12. Autor real del cambio de estado.
-- No se agrega una columna cambiado_por_usuario_id a solicitudes: seria un dato
-- volatil que solo refleja el ultimo cambio y que ademas la aplicacion podria
-- falsear al escribirlo. Se usa app.usuario_id, que el backend fija por
-- transaccion, y solo si no esta declarado se cae a resuelta_por_usuario_id o
-- al solicitante.
CREATE OR REPLACE FUNCTION solicitudes.fn_registrar_cambio_solicitud()
RETURNS trigger
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

CREATE TRIGGER trg_solicitudes_historial
AFTER INSERT OR UPDATE OF estado
ON solicitudes.solicitudes
FOR EACH ROW
EXECUTE FUNCTION solicitudes.fn_registrar_cambio_solicitud();

-- Una solicitud resuelta (APROBADA, RECHAZADA, CANCELADA) queda congelada.
CREATE OR REPLACE FUNCTION solicitudes.fn_proteger_solicitud_resuelta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.estado IN ('APROBADA', 'RECHAZADA', 'CANCELADA') THEN
        RAISE EXCEPTION
            'La solicitud % ya esta % y no puede modificarse',
            OLD.solicitud_id, OLD.estado
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION solicitudes.fn_proteger_solicitud_resuelta() IS
'APROBADA, RECHAZADA y CANCELADA son estados finales: la fila queda congelada.';

CREATE TRIGGER trg_solicitudes_resuelta_inmutable
BEFORE UPDATE ON solicitudes.solicitudes
FOR EACH ROW
EXECUTE FUNCTION solicitudes.fn_proteger_solicitud_resuelta();

CREATE TRIGGER trg_historial_solicitud_solo_insercion
BEFORE UPDATE OR DELETE ON solicitudes.historial_estado_solicitud
FOR EACH ROW EXECUTE FUNCTION auditoria.fn_rechazar_modificacion();

CREATE TRIGGER trg_historial_solicitud_sin_truncate
BEFORE TRUNCATE ON solicitudes.historial_estado_solicitud
FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_rechazar_truncado();

CREATE TABLE solicitudes.solicitudes_documentos (
    solicitud_id  uuid NOT NULL,
    documento_id  uuid NOT NULL,
    adjuntado_en  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_solicitudes_documentos PRIMARY KEY (solicitud_id, documento_id),
    CONSTRAINT fk_solicitudes_documentos_solicitud
        FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes.solicitudes (solicitud_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_documentos_documento
        FOREIGN KEY (documento_id)
        REFERENCES documentos.documentos (documento_id)
        ON DELETE RESTRICT
);

CREATE INDEX ix_solicitudes_documentos_documento
    ON solicitudes.solicitudes_documentos (documento_id);

-- ---------------------------------------------------------------------------
-- 12. Auditoria
-- ---------------------------------------------------------------------------
CREATE TABLE auditoria.bitacora (
    bitacora_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_usuario_id  uuid,
    codigo_accion     varchar(100) NOT NULL,
    tipo_recurso      varchar(100),
    recurso_id        uuid,
    resultado         varchar(20) NOT NULL,
    ocurrido_en       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    direccion_ip      inet,
    agente_usuario    text,
    metadatos         jsonb,

    CONSTRAINT ck_bitacora_resultado CHECK (resultado IN ('EXITO', 'DENEGADO', 'ERROR')),
    CONSTRAINT ck_bitacora_accion_no_vacia CHECK (btrim(codigo_accion) <> ''),
    CONSTRAINT fk_bitacora_actor
        FOREIGN KEY (actor_usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE SET NULL
);

COMMENT ON TABLE auditoria.bitacora IS
'Eventos de seguridad y negocio. Nunca almacenar contrasenas, tokens ni contenido completo de documentos en metadatos.';

CREATE INDEX ix_bitacora_actor_tiempo
    ON auditoria.bitacora (actor_usuario_id, ocurrido_en DESC);

CREATE INDEX ix_bitacora_accion_tiempo
    ON auditoria.bitacora (codigo_accion, ocurrido_en DESC);

CREATE INDEX ix_bitacora_recurso
    ON auditoria.bitacora (tipo_recurso, recurso_id, ocurrido_en DESC);

CREATE INDEX ix_bitacora_metadatos
    ON auditoria.bitacora USING gin (metadatos jsonb_path_ops);

-- CORRECCION 5. ocurrido_en no puede venir del futuro.
-- Se implementa con un trigger y no con un CHECK porque depende del reloj
-- (CURRENT_TIMESTAMP no es inmutable) y de una tolerancia configurable que se
-- lee de app.tolerancia_reloj_segundos; por omision, 300 s.
CREATE OR REPLACE FUNCTION auditoria.fn_validar_momento_evento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

CREATE TRIGGER trg_bitacora_momento_valido
BEFORE INSERT ON auditoria.bitacora
FOR EACH ROW
EXECUTE FUNCTION auditoria.fn_validar_momento_evento();

CREATE TRIGGER trg_bitacora_solo_insercion
BEFORE UPDATE OR DELETE ON auditoria.bitacora
FOR EACH ROW EXECUTE FUNCTION auditoria.fn_rechazar_modificacion();

CREATE TRIGGER trg_bitacora_sin_truncate
BEFORE TRUNCATE ON auditoria.bitacora
FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_rechazar_truncado();

-- ---------------------------------------------------------------------------
-- 13. Triggers de actualizado_en
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_carreras_actualizado
BEFORE UPDATE ON nucleo.carreras
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

CREATE TRIGGER trg_personas_actualizado
BEFORE UPDATE ON nucleo.personas
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

CREATE TRIGGER trg_usuarios_actualizado
BEFORE UPDATE ON seguridad.usuarios
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

CREATE TRIGGER trg_alumnos_actualizado
BEFORE UPDATE ON academico.alumnos
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

CREATE TRIGGER trg_profesores_actualizado
BEFORE UPDATE ON academico.profesores
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

CREATE TRIGGER trg_materias_actualizado
BEFORE UPDATE ON academico.materias
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

CREATE TRIGGER trg_grupos_actualizado
BEFORE UPDATE ON academico.grupos
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

CREATE TRIGGER trg_calificaciones_actualizado
BEFORE UPDATE ON academico.calificaciones
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

CREATE TRIGGER trg_documentos_actualizado
BEFORE UPDATE ON documentos.documentos
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

-- ---------------------------------------------------------------------------
-- 14. Vistas derivadas
-- ---------------------------------------------------------------------------

-- Permisos efectivos. Excluye usuarios no activos y asignaciones revocadas.
CREATE VIEW seguridad.v_permisos_efectivos_usuario AS
SELECT
    ur.usuario_id,
    r.rol_id,
    r.codigo AS codigo_rol,
    ur.carrera_id,
    p.permiso_id,
    p.codigo AS codigo_permiso
FROM seguridad.usuarios_roles ur
JOIN seguridad.usuarios u
  ON u.usuario_id = ur.usuario_id
 AND u.estado = 'ACTIVO'
JOIN seguridad.roles r
  ON r.rol_id = ur.rol_id
JOIN seguridad.roles_permisos rp
  ON rp.rol_id = r.rol_id
JOIN seguridad.permisos p
  ON p.permiso_id = rp.permiso_id
WHERE ur.revocado_en IS NULL;

COMMENT ON VIEW seguridad.v_permisos_efectivos_usuario IS
'Permisos vigentes de cada usuario activo. El servidor debe ademas validar el alcance sobre el recurso concreto.';

-- Cardex: se deriva de la inscripcion, no del catalogo de carreras del alumno,
-- para no perder materias cuando el alumno cambia de carrera.
CREATE VIEW academico.v_cardex_alumno AS
SELECT
    a.alumno_id,
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
FROM academico.inscripciones i
JOIN academico.alumnos a             ON a.alumno_id = i.alumno_id
JOIN nucleo.personas pe              ON pe.persona_id = a.persona_id
JOIN academico.grupos g              ON g.grupo_id = i.grupo_id
JOIN academico.carreras_materias cm  ON cm.carrera_materia_id = g.carrera_materia_id
JOIN nucleo.carreras c               ON c.carrera_id = cm.carrera_id
JOIN academico.materias m            ON m.materia_id = cm.materia_id
JOIN academico.periodos_academicos pa ON pa.periodo_academico_id = g.periodo_academico_id
LEFT JOIN academico.calificaciones cal ON cal.inscripcion_id = i.inscripcion_id;

COMMENT ON VIEW academico.v_cardex_alumno IS
'Cardex derivado. No existe tabla duplicada de cardex: se calcula de inscripcion + grupo + plan + materia + periodo + calificacion.';

-- Vista de apoyo: grupos que un profesor tiene autorizados en este momento.
CREATE VIEW academico.v_grupos_autorizados_profesor AS
SELECT
    apg.profesor_id,
    apg.grupo_id,
    g.carrera_id,
    g.carrera_materia_id,
    g.periodo_academico_id,
    g.clave_grupo
FROM academico.asignaciones_profesor_grupo apg
JOIN academico.grupos g ON g.grupo_id = apg.grupo_id
WHERE apg.revocado_en IS NULL;

COMMENT ON VIEW academico.v_grupos_autorizados_profesor IS
'Fuente unica para responder si un profesor puede operar sobre un grupo.';

-- Ocupacion de cada grupo, para la pantalla de inscripciones.
CREATE VIEW academico.v_ocupacion_grupo AS
SELECT
    g.grupo_id,
    g.clave_grupo,
    g.estado,
    g.cupo_maximo,
    count(i.inscripcion_id) FILTER (WHERE i.estado <> 'CANCELADA') AS inscritos,
    CASE
        WHEN g.cupo_maximo IS NULL THEN NULL
        ELSE g.cupo_maximo - count(i.inscripcion_id) FILTER (WHERE i.estado <> 'CANCELADA')
    END AS lugares_disponibles
FROM academico.grupos g
LEFT JOIN academico.inscripciones i ON i.grupo_id = g.grupo_id
GROUP BY g.grupo_id, g.clave_grupo, g.estado, g.cupo_maximo;

-- Horario legible del grupo.
CREATE VIEW academico.v_horario_grupo AS
SELECT
    s.grupo_id,
    g.clave_grupo,
    s.dia_semana,
    CASE s.dia_semana
        WHEN 1 THEN 'Lunes'   WHEN 2 THEN 'Martes'  WHEN 3 THEN 'Miercoles'
        WHEN 4 THEN 'Jueves'  WHEN 5 THEN 'Viernes' WHEN 6 THEN 'Sabado'
        ELSE 'Domingo'
    END AS nombre_dia,
    s.hora_inicio,
    s.hora_fin,
    s.aula
FROM academico.sesiones_grupo s
JOIN academico.grupos g ON g.grupo_id = s.grupo_id
ORDER BY s.grupo_id, s.dia_semana, s.hora_inicio;

-- ---------------------------------------------------------------------------
-- 15. Catalogo inicial de roles
-- ---------------------------------------------------------------------------
INSERT INTO seguridad.roles (codigo, nombre, descripcion, es_rol_sistema)
VALUES
    ('ALUMNO', 'Estudiante', 'Acceso unicamente a sus propios recursos.', true),
    ('PROFESOR', 'Profesor', 'Acceso a grupos y calificaciones que tiene asignados.', true),
    ('ADMINISTRADOR', 'Administrador', 'Administracion de usuarios, roles, seguridad y auditoria.', true),
    ('JEFE_CARRERA', 'Jefe de carrera', 'Gestion de profesores, grupos e inscripciones dentro de su carrera.', true)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    es_rol_sistema = EXCLUDED.es_rol_sistema;

-- ---------------------------------------------------------------------------
-- 16. Catalogo inicial de permisos
-- ---------------------------------------------------------------------------
INSERT INTO seguridad.permisos (codigo, nombre, descripcion)
VALUES
    ('perfil.leer.propio',            'Consultar perfil propio',              'Consultar el perfil del usuario autenticado.'),
    ('perfil.actualizar.propio',      'Actualizar perfil propio',             'Actualizar los datos permitidos del perfil propio.'),
    ('calificaciones.leer.propias',   'Consultar calificaciones propias',     'Consultar las calificaciones del alumno autenticado.'),
    ('calificaciones.leer.asignadas', 'Consultar calificaciones asignadas',   'Consultar calificaciones de grupos autorizados.'),
    ('calificaciones.escribir.asignadas','Capturar calificaciones asignadas', 'Capturar o modificar calificaciones solo de grupos autorizados.'),
    ('documentos.leer.propios',       'Consultar documentos propios',         'Consultar documentos cuyo propietario sea el usuario.'),
    ('documentos.cargar.propios',     'Cargar documentos propios',            'Cargar documentos asociados al propio usuario.'),
    ('solicitudes.crear.propias',     'Crear solicitudes propias',            'Crear solicitudes en nombre propio.'),
    ('solicitudes.leer.propias',      'Consultar solicitudes propias',        'Consultar solicitudes creadas por el usuario.'),
    ('solicitudes.resolver',          'Resolver solicitudes',                 'Aprobar o rechazar solicitudes dentro del ambito autorizado.'),
    ('listas.leer.asignadas',         'Consultar listas autorizadas',         'Consultar listas de grupos donde el profesor este autorizado.'),
    ('horarios.leer',                 'Consultar horarios',                   'Consultar horarios y aulas de los grupos.'),
    ('horarios.administrar',          'Administrar horarios',                 'Definir sesiones, horarios y aulas dentro del ambito autorizado.'),
    ('usuarios.leer',                 'Consultar usuarios',                   'Consultar usuarios del sistema.'),
    ('usuarios.crear',                'Crear usuarios',                       'Crear usuarios del sistema.'),
    ('usuarios.actualizar',           'Actualizar usuarios',                  'Actualizar datos administrativos de usuarios.'),
    ('usuarios.deshabilitar',         'Deshabilitar usuarios',                'Deshabilitar cuentas sin eliminar su historial.'),
    ('roles.leer',                    'Consultar roles',                      'Consultar roles y permisos.'),
    ('roles.asignar',                 'Asignar o revocar roles',              'Gestionar asignaciones de roles.'),
    ('auditoria.leer',                'Consultar auditoria',                  'Consultar la bitacora de auditoria.'),
    ('profesores.crear',              'Dar de alta profesores',               'Crear registros de profesores.'),
    ('profesores.desactivar',         'Dar de baja profesores',               'Desactivar profesores dentro del ambito autorizado.'),
    ('materias.crear',                'Dar de alta materias',                 'Crear materias.'),
    ('materias.actualizar',           'Actualizar materias',                  'Actualizar materias.'),
    ('grupos.crear',                  'Crear grupos',                         'Crear grupos dentro del ambito autorizado.'),
    ('grupos.actualizar',             'Actualizar grupos',                    'Actualizar grupos dentro del ambito autorizado.'),
    ('grupos.leer',                   'Consultar grupos',                     'Consultar grupos dentro del ambito autorizado.'),
    ('inscripciones.crear',           'Inscribir alumnos',                    'Inscribir alumnos en grupos dentro del ambito autorizado.'),
    ('inscripciones.eliminar',        'Retirar alumnos',                      'Retirar alumnos de grupos dentro del ambito autorizado.')
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

-- ---------------------------------------------------------------------------
-- 17. Asignacion rol -> permisos
-- ---------------------------------------------------------------------------
WITH mapa_roles_permisos(codigo_rol, codigo_permiso) AS (
    VALUES
        ('ALUMNO', 'perfil.leer.propio'),
        ('ALUMNO', 'perfil.actualizar.propio'),
        ('ALUMNO', 'calificaciones.leer.propias'),
        ('ALUMNO', 'documentos.leer.propios'),
        ('ALUMNO', 'documentos.cargar.propios'),
        ('ALUMNO', 'solicitudes.crear.propias'),
        ('ALUMNO', 'solicitudes.leer.propias'),
        ('ALUMNO', 'horarios.leer'),

        ('PROFESOR', 'perfil.leer.propio'),
        ('PROFESOR', 'perfil.actualizar.propio'),
        ('PROFESOR', 'calificaciones.leer.asignadas'),
        ('PROFESOR', 'calificaciones.escribir.asignadas'),
        ('PROFESOR', 'listas.leer.asignadas'),
        ('PROFESOR', 'grupos.leer'),
        ('PROFESOR', 'horarios.leer'),

        ('ADMINISTRADOR', 'perfil.leer.propio'),
        ('ADMINISTRADOR', 'perfil.actualizar.propio'),
        ('ADMINISTRADOR', 'usuarios.leer'),
        ('ADMINISTRADOR', 'usuarios.crear'),
        ('ADMINISTRADOR', 'usuarios.actualizar'),
        ('ADMINISTRADOR', 'usuarios.deshabilitar'),
        ('ADMINISTRADOR', 'roles.leer'),
        ('ADMINISTRADOR', 'roles.asignar'),
        ('ADMINISTRADOR', 'auditoria.leer'),
        ('ADMINISTRADOR', 'materias.crear'),
        ('ADMINISTRADOR', 'materias.actualizar'),
        ('ADMINISTRADOR', 'grupos.leer'),
        ('ADMINISTRADOR', 'grupos.actualizar'),
        ('ADMINISTRADOR', 'horarios.leer'),

        ('JEFE_CARRERA', 'perfil.leer.propio'),
        ('JEFE_CARRERA', 'perfil.actualizar.propio'),
        ('JEFE_CARRERA', 'profesores.crear'),
        ('JEFE_CARRERA', 'profesores.desactivar'),
        ('JEFE_CARRERA', 'materias.crear'),
        ('JEFE_CARRERA', 'grupos.crear'),
        ('JEFE_CARRERA', 'grupos.actualizar'),
        ('JEFE_CARRERA', 'grupos.leer'),
        ('JEFE_CARRERA', 'horarios.leer'),
        ('JEFE_CARRERA', 'horarios.administrar'),
        ('JEFE_CARRERA', 'inscripciones.crear'),
        ('JEFE_CARRERA', 'inscripciones.eliminar'),
        ('JEFE_CARRERA', 'solicitudes.resolver')
)
INSERT INTO seguridad.roles_permisos (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM mapa_roles_permisos mrp
JOIN seguridad.roles r    ON r.codigo = mrp.codigo_rol
JOIN seguridad.permisos p ON p.codigo = mrp.codigo_permiso
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 18. Catalogos iniciales de tramites y documentos
-- ---------------------------------------------------------------------------
INSERT INTO solicitudes.tipos_solicitud (codigo, nombre, descripcion)
VALUES
    ('CONSTANCIA', 'Constancia', 'Solicitud de emision de una constancia academica.'),
    ('CARDEX', 'Cardex', 'Solicitud de emision del cardex academico.')
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

INSERT INTO documentos.tipos_documento (codigo, nombre, descripcion)
VALUES
    ('CONSTANCIA', 'Constancia', 'Documento de constancia academica.'),
    ('CARDEX', 'Cardex', 'Documento con el historial academico del alumno.'),
    ('IDENTIFICACION', 'Identificacion oficial', 'Documento de identidad cargado por el usuario.'),
    ('COMPROBANTE', 'Comprobante', 'Comprobante de pago o tramite.')
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;


REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA nucleo, seguridad, academico, documentos, solicitudes, auditoria
    TO securecampus_app, securecampus_lectura;

-- La aplicacion lee y escribe datos de negocio, pero nunca borra.
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA
    nucleo, seguridad, academico, documentos, solicitudes
    TO securecampus_app;

-- La bitacora se escribe, jamas se altera ni se borra.
GRANT SELECT, INSERT ON auditoria.bitacora TO securecampus_app;
REVOKE UPDATE, DELETE ON auditoria.bitacora FROM securecampus_app;

REVOKE DELETE ON ALL TABLES IN SCHEMA
    nucleo, seguridad, academico, documentos, solicitudes, auditoria
    FROM securecampus_app;

-- Rol de solo lectura para reportes, sin acceso a identidad externa.
GRANT SELECT ON ALL TABLES IN SCHEMA academico, solicitudes, documentos
    TO securecampus_lectura;

-- Que las tablas futuras hereden la misma politica.
ALTER DEFAULT PRIVILEGES IN SCHEMA nucleo, seguridad, academico, documentos, solicitudes
    GRANT SELECT, INSERT, UPDATE ON TABLES TO securecampus_app;

-- migrate:down
-- Sin reversion: en desarrollo se recrea la base con `docker compose down -v`.
SELECT 1;