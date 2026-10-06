-- V12 — Tarea 3.1: semilla de catálogo para navegación por familias y filtros
--
-- El catálogo tenía UN solo producto en UNA sola familia ('0432/021', OUTERWEAR),
-- declaradas en V1:17 las tres familias del dominio ('OUTERWEAR', 'KNITWEAR',
-- 'FOOTWEAR'). Con un único producto el menú de familias tendría una entrada y
-- los filtros serían indistinguibles de un listado sin filtrar.
--
-- Se añaden 3 productos (1 por familia) diseñados para que CADA filtro acorte la
-- lista de forma observable:
--   · OUTERWEAR → 2 de 4 productos   (familia acorta)
--   · size=M    → 3 de 4             (talla acorta)
--   · size=L    → 3 de 4
--   · color=Camel → 1 de 4           (color acorta)
-- Es por eso que el Abrigo es talla M única y el Jersey talla L única: si todos
-- tuvieran M y L, filtrar por talla no cambiaría nada.
--
-- Cada SKU recibe precios en LOS CUATRO mercados. V11 ya corrigió el hueco
-- equivalente de V1 (5 celdas vacías que devolvían 404/400 en producción de
-- datos); esta matriz nace completa desde la migración, no desde filas residuales.
--
-- Idempotencia y claves naturales, nunca ids: V1 usaba ids fijos (1, 2, 4) porque
-- corría sobre una BD recién creada, pero una migración debe poder ejecutarse
-- sobre una BD parcialmente poblada — el entorno de desarrollo tiene filas que no
-- vienen de las migraciones. Por eso TODO se resuelve con INSERT ... SELECT sobre
-- reference_code / barcode / code, y cada tabla usa su restricción única:
--   products      → reference_code        (V1:14)
--   skus          → barcode               (V1:25)
--   market_prices → uk_sku_market         (V1:40)
--   stock_items   → uk_sku_warehouse      (V1:60)

-- 1. Productos: 1 por familia (los 3 nombres que V1 ya anticipaba)
INSERT INTO products (reference_code, name, description, family)
VALUES ('0611/018', 'Abrigo Lana Oversize', 'Abrigo de lana con cuello alto y corte oversize.', 'OUTERWEAR'),
       ('0815/004', 'Jersey Punto Lana', 'Jersey de punto fino con cuello redondo y manga larga.', 'KNITWEAR'),
       ('1240/007', 'Zapatilla Piel Minimal', 'Zapatilla de piel con suela de goma y perfil limpio.', 'FOOTWEAR')
ON CONFLICT (reference_code) DO NOTHING;

-- 2. SKUs: 4 variantes. Tallas deliberadamente asimétricas (ver cabecera).
INSERT INTO skus (product_id, barcode, color, size)
SELECT p.id,
       v.barcode,
       v.color,
       v.size
FROM (VALUES ('0611/018', '843321900201', 'Camel', 'M'),   -- Abrigo: sólo M
             ('0815/004', '843321900301', 'Crudo', 'L'),   -- Jersey: sólo L
             ('1240/007', '843321900401', 'Negro', 'M'),   -- Zapatilla: M y L
             ('1240/007', '843321900402', 'Negro', 'L')) AS v(reference_code, barcode, color, size)
         JOIN products p ON p.reference_code = v.reference_code
ON CONFLICT (barcode) DO NOTHING;

-- 3. Matriz de precios completa: 4 SKUs nuevos × 4 mercados = 16 celdas.
--    Misma cifra para las tallas de un mismo producto (como en V1).
INSERT INTO market_prices (sku_id, market_id, base_price, discount_price)
SELECT s.id,
       m.id,
       v.base_price,
       NULL
FROM (VALUES -- Abrigo Lana Oversize
             ('843321900201', 'ES', 149.95),
             ('843321900201', 'UK', 149.99),
             ('843321900201', 'US', 179.95),
             ('843321900201', 'CH', 169.00),
             -- Jersey Punto Lana
             ('843321900301', 'ES', 69.95),
             ('843321900301', 'UK', 69.99),
             ('843321900301', 'US', 84.95),
             ('843321900301', 'CH', 79.00),
             -- Zapatilla Piel Minimal (M)
             ('843321900401', 'ES', 99.95),
             ('843321900401', 'UK', 99.99),
             ('843321900401', 'US', 119.95),
             ('843321900401', 'CH', 109.00),
             -- Zapatilla Piel Minimal (L)
             ('843321900402', 'ES', 99.95),
             ('843321900402', 'UK', 99.99),
             ('843321900402', 'US', 119.95),
             ('843321900402', 'CH', 109.00)) AS v(barcode, market_code, base_price)
         JOIN skus s ON s.barcode = v.barcode
         JOIN markets m ON m.code = v.market_code
ON CONFLICT (sku_id, market_id) DO NOTHING;

-- 4. Stock en los 2 almacenes: 4 SKUs × 2 = 8 filas.
INSERT INTO stock_items (sku_id, warehouse_id, quantity_available, quantity_reserved)
SELECT s.id,
       w.id,
       v.quantity_available,
       v.quantity_reserved
FROM (VALUES ('843321900201', 'WH_ARTEIXO', 80, 0),
             ('843321900201', 'WH_ZARAGOZA', 40, 0),
             ('843321900301', 'WH_ARTEIXO', 80, 0),
             ('843321900301', 'WH_ZARAGOZA', 40, 0),
             ('843321900401', 'WH_ARTEIXO', 80, 0),
             ('843321900401', 'WH_ZARAGOZA', 40, 0),
             ('843321900402', 'WH_ARTEIXO', 80, 0),
             ('843321900402', 'WH_ZARAGOZA', 40, 0)) AS v(barcode, warehouse_code, quantity_available, quantity_reserved)
         JOIN skus s ON s.barcode = v.barcode
         JOIN warehouses w ON w.code = v.warehouse_code
ON CONFLICT (sku_id, warehouse_id) DO NOTHING;

-- 5. Índice sobre la familia: los dos accesos nuevos la usan de forma constante
--    (SELECT f, COUNT(*) ... GROUP BY f  y  WHERE family = ?). Sin este índice
--    ambas consultas escanean la tabla entera.
CREATE INDEX IF NOT EXISTS idx_products_family ON products (family);
