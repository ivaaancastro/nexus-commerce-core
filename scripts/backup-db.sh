#!/usr/bin/env bash
# backup-db.sh — Script de backup de base de datos (Fase 8, R3.1)
# Uso: ./scripts/backup-db.sh
# Requiere: PGPASSWORD en entorno, psql/pg_dump en PATH

set -euo pipefail

# Configuración
DB_NAME="${PGDATABASE:-commerce_db}"
DB_USER="${PGUSER:-dev_user}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Validaciones
if [[ -z "${PGPASSWORD:-}" ]]; then
    echo "ERROR: Variable PGPASSWORD no definida en el entorno" >&2
    exit 1
fi

if ! command -v pg_dump &> /dev/null; then
    echo "ERROR: pg_dump no encontrado en PATH" >&2
    exit 1
fi

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Nombre del archivo con timestamp
TIMESTAMP=$(date +%Y%m%d)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.backup"

echo "Iniciando backup de $DB_NAME a $BACKUP_FILE..."

# Ejecutar pg_dump
pg_dump -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" \
    --no-owner --no-acl -Fc -f "$BACKUP_FILE"

if [[ $? -eq 0 ]]; then
    echo "Backup completado: $BACKUP_FILE"
else
    echo "ERROR: pg_dump falló" >&2
    exit 1
fi

# Rotación: eliminar backups más antiguos de RETENTION_DAYS
echo "Aplicando rotación (mantener últimos $RETENTION_DAYS días)..."
find "$BACKUP_DIR" -name "backup-*.backup" -mtime +"$RETENTION_DAYS" -delete

REMAINING=$(find "$BACKUP_DIR" -name "backup-*.backup" | wc -l)
echo "Backups restantes: $REMAINING"

exit 0