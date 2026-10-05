-- Devoluciones de producto (Tarea 5.4)
-- Registro contable: no mueve dinero (el proyecto no tiene pasarela de pago).
CREATE TABLE product_returns (
    id            BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id),
    user_id       BIGINT REFERENCES users(id),
    status        VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    reason        VARCHAR(500) NOT NULL,
    currency      VARCHAR(3) NOT NULL,
    refund_amount NUMERIC(12, 2) NOT NULL,
    requested_at  TIMESTAMP NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMP,
    CONSTRAINT uq_return_per_item UNIQUE (order_item_id)
);

CREATE INDEX idx_returns_user ON product_returns(user_id);
