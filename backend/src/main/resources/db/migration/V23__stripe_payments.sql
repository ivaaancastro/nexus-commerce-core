-- Fase 9 · Pagos con Stripe (test mode). Solo AÑADE: reejecutable y sin UPDATE de filas.
-- Los pedidos existentes quedan con payment_status = 'NONE' (sin cobro online) por el DEFAULT.
--   payment_status    NONE | REQUIRES_PAYMENT | PAID | PARTIALLY_REFUNDED | REFUNDED
--   payment_intent_id id del PaymentIntent de Stripe (el clientSecret NO se guarda nunca)
--   amount_refunded   importe reembolsado en unidades mayores (lo fija el webhook / el reembolso)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status    VARCHAR(24)   NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS amount_refunded   NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id ON orders (payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created ON orders (payment_status, created_at);

-- Idempotencia del webhook: un evento de Stripe se procesa una sola vez.
CREATE TABLE IF NOT EXISTS stripe_events (
    event_id     VARCHAR(128) PRIMARY KEY,
    type         VARCHAR(64)  NOT NULL,
    processed_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
