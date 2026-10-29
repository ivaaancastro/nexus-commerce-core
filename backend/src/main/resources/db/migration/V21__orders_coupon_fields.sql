-- V21__orders_coupon_fields.sql --
-- Migración para añadir campos de cupón a la tabla orders (V5)
-- Ejecutar después de V20

-- Añadir columnas de cupón a orders (permitir NULL para órdenes existentes sin cupón)
ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(20);
ALTER TABLE orders ADD COLUMN coupon_id BIGINT;
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2);

-- Añadir restricción de FK opcional (solo si la tabla coupons ya existe y queremos integridad)
-- Nota: Se hace opcional para no romper migraciones previas en entornos con datos antiguos
ALTER TABLE orders ADD CONSTRAINT fk_orders_coupon_id FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL;