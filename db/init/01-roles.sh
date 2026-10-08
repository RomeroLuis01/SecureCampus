#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE securecampus_app     LOGIN PASSWORD '${APP_DB_PASSWORD}';
  CREATE ROLE securecampus_lectura LOGIN PASSWORD '${LECTURA_DB_PASSWORD}';
EOSQL
