#!/usr/bin/env bash
# verify-consistency.sh — Verificación de consistencia de datos (Fase 8, R3.2)
# Uso: ./scripts/verify-consistency.sh
# Requiere: PGPASSWORD en entorno, psql en PATH
# Sale con 0 si OK, 1 si hay problemas

set -euo pipefail

# Configuración
DB_NAME="${PGDATABASE:-commerce_db}"
DB_USER="${PGUSER:-dev_user}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

# Validaciones
if [[ -z "${PGPASSWORD:-}" ]]; then
    echo "ERROR: Variable PGPASSWORD no definida en el entorno" >&2
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "ERROR: psql no encontrado en PATH" >&2
    exit 1
fi

echo "Verificando consistencia de datos en $DB_NAME..."

# 1. Productos con stock negativo (stock_items.quantity_available < 0)
NEGATIVE_STOCK=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c \
    "SELECT count(*) FROM stock_items WHERE quantity_available < 0" 2>/dev/null | tr -d ' ')

if [[ "$NEGATIVE_STOCK" -gt 0 ]]; then
    echo "ALERT: $NEGATIVE_STOCK productos con stock negativo" >&2
    # Mostrar cuáles para diagnóstico
    psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c \
        "SELECT si.sku_id, si.warehouse_code, si.quantity_available, p.reference_code 
         FROM stock_items si 
         JOIN skus s ON si.sku_id = s.id 
         JOIN products p ON s.product_id = p.id 
         WHERE si.quantity_available < 0" >&2
    exit 1
fi

# 2. Precios con descuento mayor que precio base (market_prices.discount_price > base_price)
INVALID_PRICES=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c \
    "SELECT count(*) FROM market_prices WHERE discount_price IS NOT NULL AND discount_price > base_price" 2>/dev/null | tr -d ' ')

if [[ "$INVALID_PRICES" -gt 0 ]]; then
    echo "ALERT: $INVALID_PRICES precios con descuento mayor que base" >&2
    exit 1
fi

# 3. Pedidos sin usuario (orders.user_id IS NULL)
ORDERS_NO_USER=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c \
    "SELECT count(*) FROM orders WHERE user_id IS NULL" 2>/dev/null | tr -d ' ')

if [[ "$ORDERS_NO_USER" -gt 0 ]]; then
    echo "ALERT: $ORDERS_NO_USER pedidos sin usuario asignado" >&2
    exit 1
fi

# 4. SKUs sin stock en ningún almacén (productos que deberían tener stock)
SKUS_NO_STOCK=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c \
    "SELECT count(*) FROM skus s WHERE NOT EXISTS (SELECT 1 FROM stock_items si WHERE si.sku_id = s.id)" 2>/dev/null | tr -d ' ')

if [[ "$SKUS_NO_STOCK" -gt 0 ]]; then
    echo "WARNING: $SKUS_NO_STOCK SKUs sin filas en stock_items (puede ser intencional)" >&2
    # No es error, solo warning
fi

echo "OK: todos los stocks son válidos"
exit 0