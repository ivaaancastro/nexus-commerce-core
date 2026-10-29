#!/usr/bin/env bash
# cleanup-sessions.sh — Limpieza de sesiones expiradas (Fase 8, R3.3)
# Uso: ./scripts/cleanup-sessions.sh
# Requiere: PGPASSWORD en entorno, psql en PATH
# No toca sesiones de admin@nexus.dev ni e2e@nexus.dev

set -euo pipefail

# Configuración
DB_NAME="${PGDATABASE:-commerce_db}"
DB_USER="${PGUSER:-dev_user}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
RETENTION_DAYS="${SESSION_RETENTION_DAYS:-30}"

# Emails protegidos (no se borran nunca)
PROTECTED_EMAILS=("admin@nexus.dev" "e2e@nexus.dev")

# Validaciones
if [[ -z "${PGPASSWORD:-}" ]]; then
    echo "ERROR: Variable PGPASSWORD no definida en el entorno" >&2
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "ERROR: psql no encontrado en PATH" >&2
    exit 1
fi

echo "Limpiando sesiones expiradas (más de $RETENTION_DAYS días) en $DB_NAME..."

# Construir cláusula WHERE para excluir emails protegidos
PROTECTED_CLAUSE=""
for email in "${PROTECTED_EMAILS[@]}"; do
    if [[ -z "$PROTECTED_CLAUSE" ]]; then
        PROTECTED_CLAUSE="u.email != '$email'"
    else
        PROTECTED_CLAUSE="$PROTECTED_CLAUSE AND u.email != '$email'"
    fi
done

# Verificar qué tabla de sesiones existe (oauth_access_tokens, refresh_tokens, etc.)
# En este proyecto usamos JWT stateless, pero puede haber tabla de refresh tokens
# Intentamos limpiar refresh_tokens si existe
TABLE_EXISTS=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens')" 2>/dev/null | tr -d ' ')

DELETED=0

if [[ "$TABLE_EXISTS" == "t" ]]; then
    # Limpiar refresh_tokens expirados antiguos, excluyendo usuarios protegidos
    DELETED=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c \
        "DELETE FROM refresh_tokens rt
         USING users u
         WHERE rt.user_id = u.id
           AND rt.expires_at < now() - interval '$RETENTION_DAYS days'
           AND $PROTECTED_CLAUSE" 2>/dev/null | tr -d ' ')
    
    echo "Cleaned $DELETED expired refresh tokens"
else
    echo "Tabla refresh_tokens no existe, saltando..."
fi

# También verificar tabla oauth_access_tokens si existe (legacy)
TABLE_EXISTS2=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oauth_access_tokens')" 2>/dev/null | tr -d ' ')

if [[ "$TABLE_EXISTS2" == "t" ]]; then
    DELETED2=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c \
        "DELETE FROM oauth_access_tokens oat
         USING users u
         WHERE oat.user_id = u.id
           AND oat.expired_at < now() - interval '$RETENTION_DAYS days'
           AND $PROTECTED_CLAUSE" 2>/dev/null | tr -d ' ')
    
    echo "Cleaned $DELETED2 expired oauth access tokens"
    DELETED=$((DELETED + DELETED2))
fi

echo "Cleaned $DELETED expired sessions total"
exit 0