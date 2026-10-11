-- migrate:up
-- ---------------------------------------------------------------------------
-- SecureCampus - Autenticacion local, credenciales y sesiones (PostgreSQL 16)
-- dbmate envuelve la migracion en una transaccion: no usar BEGIN/COMMIT.
-- ---------------------------------------------------------------------------

-- 1. Permitir cuentas locales puras sin proveedor OIDC externo
ALTER TABLE seguridad.usuarios
    ALTER COLUMN sujeto_identidad DROP NOT NULL;

COMMENT ON COLUMN seguridad.usuarios.sujeto_identidad IS
'Identificador externo inmutable (claim sub de OIDC). NULL para cuentas locales sin federacion activa.';

-- 2. Tabla de credenciales locales (Argon2id)
CREATE TABLE seguridad.credenciales (
    usuario_id              uuid PRIMARY KEY,
    password_hash           varchar(255) NOT NULL,
    estado                  varchar(20)  NOT NULL DEFAULT 'ACTIVO',
    intentos_fallidos       integer      NOT NULL DEFAULT 0,
    bloqueado_hasta         timestamptz,
    password_actualizado_en timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creado_en               timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en          timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_credenciales_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_credenciales_estado
        CHECK (estado IN ('ACTIVO', 'BLOQUEADO', 'REQUIERE_CAMBIO')),
    CONSTRAINT ck_credenciales_intentos
        CHECK (intentos_fallidos >= 0),
    CONSTRAINT ck_credenciales_hash_no_vacio
        CHECK (btrim(password_hash) <> '')
);

COMMENT ON TABLE seguridad.credenciales IS
'Credenciales locales de aplicacion. Almacena exclusivamente el hash formateado PHC de Argon2id.';

CREATE TRIGGER trg_credenciales_actualizado
BEFORE UPDATE ON seguridad.credenciales
FOR EACH ROW EXECUTE FUNCTION nucleo.fn_actualizar_marca_tiempo();

-- 3. Tabla simplificada de sesiones en servidor (SHA-256)
CREATE TABLE seguridad.sesiones (
    sesion_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       uuid NOT NULL,
    token_hash       varchar(64) NOT NULL,
    creado_en        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en        timestamptz NOT NULL,
    revocado_en      timestamptz,
    direccion_ip     inet,
    agente_usuario   text,

    CONSTRAINT fk_sesiones_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES seguridad.usuarios (usuario_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_sesiones_token_hash
        UNIQUE (token_hash),
    CONSTRAINT ck_sesiones_fechas
        CHECK (expira_en > creado_en),
    CONSTRAINT ck_sesiones_token_hash_formato
        CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE seguridad.sesiones IS
'Sesiones activas e historicas. token_hash almacena unicamente el hash SHA-256 en formato hex.';

CREATE INDEX ix_sesiones_usuario_vigente
    ON seguridad.sesiones (usuario_id)
    WHERE revocado_en IS NULL;

-- 4. Privilegios explicitos para el rol de aplicacion
GRANT SELECT, INSERT, UPDATE ON seguridad.credenciales TO securecampus_app;
GRANT SELECT, INSERT, UPDATE ON seguridad.sesiones TO securecampus_app;

-- migrate:down
DROP TABLE IF EXISTS seguridad.sesiones;
DROP TABLE IF EXISTS seguridad.credenciales;
ALTER TABLE seguridad.usuarios ALTER COLUMN sujeto_identidad SET NOT NULL;
