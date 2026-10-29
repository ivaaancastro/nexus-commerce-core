-- Fase 9: Pagos (Stripe) - campos de pago en orders
-- payment_intent_id: ID del PaymentIntent de Stripe
-- client_secret: Client secret para confirmar el pago en el frontend
-- refund_status: Estado del reembolso (NULL = sin reembolso, REFUNDED = reembolsado parcial/total)
-- amount_refunded: Importe total reembolsado

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS client_secret VARCHAR(256),
    ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS amount_refunded NUMERIC(12, 2);

-- Índice para búsquedas por payment_intent_id
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id ON orders(payment_intent_id);