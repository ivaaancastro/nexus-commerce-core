-- V15 — Tarea 7.5 (Fase 7 · Panel de administración): suspensión de cuentas
--
-- El modelo de usuario no tenía NINGÚN estado de cuenta: el panel no podía
-- bloquear una cuenta abusiva y un operador malicioso seguía pudiendo entrar
-- (spec specs/admin-users/, R3 y plan D2).
--
-- 1) Una única columna NULLABLE: `NULL` = cuenta activa (todas las existentes
--    lo quedan sin un UPDATE), con valor = instante exacto en que se suspendió
--    — así la tabla del panel puede mostrar «Suspendido desde…» sin columna
--    extra ni función de fecha. Un `boolean` no sirve: perderíamos el cuándo
--    y no distinguiría «recién suspendido» de «lleva años» (plan D2).
--    `IF NOT EXISTS` hace inocuo reejecutar el fichero (patrón V13/V14).
--
-- 2) Sin índice a propósito: `users` tiene cardinalidad mínima y el listado
--    admin pagina por `created_at`; los índices de la V14 iban a `orders`, que
--    sí crece con cada venta (plan D2).

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL;
