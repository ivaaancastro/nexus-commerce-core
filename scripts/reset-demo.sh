#!/usr/bin/env bash
# Restaura la DEMO PÚBLICA a su estado de fábrica (Fase 10, R8).
#
# Borra el esquema `public` entero; al reiniciar el backend, Flyway lo
# reconstruye desde las migraciones (catálogo, stock, precios, admin) y
# `db/demo/R__demo_data.sql` (usuario demo y pedidos de ejemplo). Es el único
# reset EXACTO: los visitantes del panel pueden crear y editar productos,
# stock, precios y cupones, así que restaurar solo parte dejaría restos.
#
# Usa las MISMAS variables que el backend (la URL JDBC se traduce sola):
#   DATABASE_URL=jdbc:postgresql://<host>/<db>?sslmode=require
#   DATABASE_USERNAME=…  DATABASE_PASSWORD=…
#
# Después: reinicia el servicio del backend (Render → Manual Deploy → Restart).
# Requiere `psql` (brew install libpq).
set -euo pipefail

: "${DATABASE_URL:?Define DATABASE_URL (la misma URL JDBC del backend)}"
: "${DATABASE_USERNAME:?Define DATABASE_USERNAME}"
: "${DATABASE_PASSWORD:?Define DATABASE_PASSWORD}"

URL="${DATABASE_URL#jdbc:}"
HOST="$(printf '%s' "$URL" | sed -E 's#^[a-z]+://([^/:?]+).*#\1#')"

echo "Esto BORRA todos los datos de la base en: $HOST"
echo "(pedidos reales de Stripe test incluidos). Flyway la reconstruye al reiniciar el backend."
read -r -p "Escribe el host para confirmar: " CONFIRM
if [[ "$CONFIRM" != "$HOST" ]]; then
  echo "Cancelado: el host no coincide." >&2
  exit 1
fi

PGUSER="$DATABASE_USERNAME" PGPASSWORD="$DATABASE_PASSWORD" psql "$URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
SQL

echo "Esquema vaciado. Reinicia el backend: Flyway reconstruirá la demo al arrancar."
