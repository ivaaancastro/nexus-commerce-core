-- V14 — Tarea 7.4 (Fase 7 · Panel de administración): tracking de pedidos
--
-- La tabla `orders` no tenía NINGÚN campo de envío: el panel no podía registrar
-- quién lleva el paquete ni con qué número de seguimiento, y el comprador
-- tampoco podía verlo (spec specs/admin-orders/, R5 y plan D5).
--
-- 1) Dos columnas NULLABLE y sin DEFAULT: el dato sólo existe si alguien lo
--    registra. Las órdenes previas (y las que se envíen sin tracking) devuelven
--    NULL y el frontend no pinta el bloque — mismo criterio que
--    `shipping_address`/`payment_method` pre-V10.
--    `IF NOT EXISTS` hace inocuo reejecutar el fichero (patrón V13).
--
-- 2) Índices para el listado admin (R1): `GET /api/v1/admin/orders` filtra por
--    `status` y ordena por `created_at DESC` (los tres primeros valores de la
--    máquina de transiciones son los más consultados).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
