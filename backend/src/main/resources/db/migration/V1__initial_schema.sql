-- 1. Mercados de venta
CREATE TABLE markets (
                         id BIGSERIAL PRIMARY KEY,
                         code VARCHAR(5) NOT NULL UNIQUE,          -- 'ES', 'UK', 'US', 'CH'
                         name VARCHAR(50) NOT NULL,
                         currency VARCHAR(3) NOT NULL,              -- 'EUR', 'GBP', 'USD', 'CHF'
                         tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
                         created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Entidad Producto (Agrupación comercial)
CREATE TABLE products (
                          id BIGSERIAL PRIMARY KEY,
                          reference_code VARCHAR(20) NOT NULL UNIQUE, -- ej: '0432/021'
                          name VARCHAR(100) NOT NULL,
                          description TEXT,
                          family VARCHAR(50) NOT NULL,               -- 'OUTERWEAR', 'KNITWEAR', 'FOOTWEAR'
                          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Variantes físicas (SKUs)
CREATE TABLE skus (
                      id BIGSERIAL PRIMARY KEY,
                      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                      barcode VARCHAR(20) NOT NULL UNIQUE,
                      color VARCHAR(30) NOT NULL,
                      size VARCHAR(10) NOT NULL,                  -- 'XS', 'S', 'M', 'L', 'XL'
                      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Matriz de tarificación por mercado
CREATE TABLE market_prices (
                               id BIGSERIAL PRIMARY KEY,
                               sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
                               market_id BIGINT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
                               base_price NUMERIC(10, 2) NOT NULL,
                               discount_price NUMERIC(10, 2),
                               is_active BOOLEAN DEFAULT TRUE,
                               created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                               CONSTRAINT uk_sku_market UNIQUE (sku_id, market_id)
);

-- 5. Almacenes y logística (code ampliado a VARCHAR(20))
CREATE TABLE warehouses (
                            id BIGSERIAL PRIMARY KEY,
                            code VARCHAR(20) NOT NULL UNIQUE,          -- 'CENTRAL_ES', 'WH_ZARAGOZA'
                            name VARCHAR(100) NOT NULL,
                            country_code VARCHAR(5) NOT NULL,
                            warehouse_type VARCHAR(20) NOT NULL        -- 'CENTRAL', 'STORE_STOCK'
);

-- 6. Stock físico por almacén
CREATE TABLE stock_items (
                             id BIGSERIAL PRIMARY KEY,
                             sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
                             warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
                             quantity_available INT NOT NULL DEFAULT 0,
                             quantity_reserved INT NOT NULL DEFAULT 0,
                             updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                             CONSTRAINT uk_sku_warehouse UNIQUE (sku_id, warehouse_id)
);

-- Índices de consulta rápida
CREATE INDEX idx_products_reference ON products(reference_code);
CREATE INDEX idx_skus_product ON skus(product_id);
CREATE INDEX idx_prices_sku_market ON market_prices(sku_id, market_id);
CREATE INDEX idx_stock_sku ON stock_items(sku_id);

-- Semilla inicial de datos para pruebas
INSERT INTO markets (code, name, currency, tax_rate) VALUES
                                                         ('ES', 'España', 'EUR', 21.00),
                                                         ('UK', 'United Kingdom', 'GBP', 20.00),
                                                         ('US', 'United States', 'USD', 7.25),
                                                         ('CH', 'Switzerland', 'CHF', 8.10);

INSERT INTO warehouses (code, name, country_code, warehouse_type) VALUES
                                                                      ('WH_ARTEIXO', 'Centro Logístico Sabón', 'ES', 'CENTRAL'),
                                                                      ('WH_ZARAGOZA', 'Hub Europa Plataforma', 'ES', 'CENTRAL');

INSERT INTO products (reference_code, name, description, family) VALUES
    ('0432/021', 'Blazer Cruzada Estructura', 'Blazer de cuello solapa con manga larga y hombreras.', 'OUTERWEAR');

INSERT INTO skus (product_id, barcode, color, size) VALUES
                                                        (1, '843321900101', 'Marino', 'M'),
                                                        (1, '843321900102', 'Marino', 'L');

INSERT INTO market_prices (sku_id, market_id, base_price, discount_price) VALUES
                                                                              (1, 1, 79.95, NULL),     -- España 79.95 EUR
                                                                              (1, 2, 79.99, NULL),     -- UK 79.99 GBP
                                                                              (1, 4, 119.00, NULL);    -- Suiza 119.00 CHF

INSERT INTO stock_items (sku_id, warehouse_id, quantity_available, quantity_reserved) VALUES
                                                                                          (1, 1, 150, 5),
                                                                                          (1, 2, 80, 0);