-- Datos de la DEMO PÚBLICA (Fase 10, R7 · D7 · ajuste A1)
--
-- Migración REPETIBLE de Flyway: solo se carga con el perfil `demo`
-- (spring.flyway.locations=classpath:db/migration,classpath:db/demo) y corre
-- SIEMPRE después de las versionadas, así que nunca bloquea una V24 futura.
-- Flyway la reaplica solo si cambia su checksum. Todo es idempotente
-- (ON CONFLICT DO NOTHING / IF NOT EXISTS): reejecutarla no duplica nada.
-- `scripts/reset-demo.sh` la ejecuta también con psql (sin placeholders).
--
-- · Usuario demo `demo@nexus.dev` / `Demo1234!` (BCrypt coste 12), nace
--   VERIFICADO: en la demo no hay SMTP y el login exige la verificación.
-- · Una dirección por defecto para que el checkout funcione a la primera.
-- · 7 pedidos de ejemplo (DEMO-0001 … DEMO-0007) en estados distintos y
--   repartidos en los últimos 30 días, para que el panel y el dashboard no
--   salgan vacíos. Importes derivados de market_prices del propio mercado
--   (precio final con impuestos incluidos; neto = total × 100 / (100 + tasa)).
--   No llevan PaymentIntent: el panel no intenta reembolsar contra Stripe un
--   cobro que nunca existió. No reservan stock: cancelar o enviar desde el
--   panel es seguro porque la liberación está acotada a 0 (InventoryService).
-- · Nunca toca el catálogo, el stock ni los precios.

INSERT INTO users (email, password_hash, first_name, last_name, birth_date,
                   gender, email_verified, role)
VALUES ('demo@nexus.dev',
        '$2a$12$ZswqvTz7I6Dluw7skU6V.ucEylRrbCQ5OLUDok.Ukf5N8O3wJKgQG',
        'Demo', 'Nexus', DATE '1995-06-15', 'OTHER', TRUE, 'USER')
ON CONFLICT (email) DO NOTHING;

INSERT INTO addresses (user_id, full_name, street, city, postal_code, country_code, default_address)
SELECT u.id, 'Demo Nexus', 'Calle Gran Vía 1', 'Madrid', '28013', 'ES', TRUE
FROM users u
WHERE u.email = 'demo@nexus.dev'
  AND NOT EXISTS (SELECT 1 FROM addresses a WHERE a.user_id = u.id);

DO $$
DECLARE
    v_user_id  BIGINT;
    v_order_id BIGINT;
    v_sku_id   BIGINT;
    v_price    NUMERIC(12, 2);
    v_rate     NUMERIC(5, 2);
    v_currency VARCHAR(3);
    v_total    NUMERIC(12, 2);
    v_tax      NUMERIC(12, 2);
    v_idx      INT := 0;
    r          RECORD;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'demo@nexus.dev';

    FOR r IN
        SELECT * FROM (VALUES
            ('DEMO-0001', 'ES', 'DELIVERED', 'NONE',               0.00, 27, 2, 'Correos Express', 'DEMO-CX-0001'),
            ('DEMO-0002', 'ES', 'DELIVERED', 'PARTIALLY_REFUNDED', 0.50, 22, 1, 'Correos Express', 'DEMO-CX-0002'),
            ('DEMO-0003', 'UK', 'DELIVERED', 'NONE',               0.00, 18, 1, 'Royal Mail',      'DEMO-RM-0003'),
            ('DEMO-0004', 'ES', 'CANCELLED', 'NONE',               0.00, 12, 1, NULL,              NULL),
            ('DEMO-0005', 'US', 'SHIPPED',   'NONE',               0.00,  6, 1, 'UPS',             'DEMO-UPS-0005'),
            ('DEMO-0006', 'ES', 'CONFIRMED', 'NONE',               0.00,  3, 1, NULL,              NULL),
            ('DEMO-0007', 'ES', 'CONFIRMED', 'NONE',               0.00,  1, 2, NULL,              NULL)
        ) AS t(order_number, market, status, payment_status, refunded_share, days_ago, qty, carrier, tracking)
    LOOP
        v_idx := v_idx + 1;
        CONTINUE WHEN EXISTS (SELECT 1 FROM orders WHERE order_number = r.order_number);

        -- Un SKU distinto por pedido entre los que tienen precio activo en ese mercado.
        SELECT mp.sku_id, COALESCE(mp.discount_price, mp.base_price), m.tax_rate, m.currency
          INTO v_sku_id, v_price, v_rate, v_currency
          FROM market_prices mp
          JOIN markets m ON m.id = mp.market_id
         WHERE m.code = r.market AND COALESCE(mp.is_active, TRUE)
         ORDER BY mp.sku_id
         OFFSET (v_idx - 1) LIMIT 1;

        CONTINUE WHEN v_sku_id IS NULL;

        v_total := ROUND(v_price * r.qty, 2);
        v_tax   := ROUND(v_total * v_rate / (100 + v_rate), 2);

        INSERT INTO orders (order_number, idempotency_key, market_code, currency, status,
                            subtotal_amount, tax_amount, total_amount, created_at, updated_at,
                            user_id, shipping_full_name, shipping_street, shipping_city,
                            shipping_postal_code, shipping_country_code, payment_method,
                            carrier, tracking_number, discount_amount,
                            payment_status, amount_refunded)
        VALUES (r.order_number, 'demo-' || lower(r.order_number), r.market, v_currency, r.status,
                v_total - v_tax, v_tax, v_total,
                now() - make_interval(days => r.days_ago), now() - make_interval(days => r.days_ago),
                v_user_id, 'Demo Nexus', 'Calle Gran Vía 1', 'Madrid', '28013', 'ES', 'CARD',
                r.carrier, r.tracking, 0.00,
                r.payment_status, ROUND(v_total * r.refunded_share, 2))
        RETURNING id INTO v_order_id;

        INSERT INTO order_items (order_id, sku_id, warehouse_code, quantity,
                                 unit_price, tax_rate, tax_amount, total_amount)
        VALUES (v_order_id, v_sku_id, 'WH_ARTEIXO', r.qty, v_price, v_rate, v_tax, v_total);
    END LOOP;
END $$;
