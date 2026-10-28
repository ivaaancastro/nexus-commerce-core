-- V22: demo multicolor para `photos-per-color` (V6).
--
-- El producto 1 (referencia 0432/021, "Blazer Cruzada Estructura") nació con un
-- único color (Marino). Para que el selector de color de la PDP y la galería
-- por color sean observables en el catálogo, se añaden dos colores más (Negro,
-- Crudo) con tallas M y L, espejando precios y stock del color original.
--
-- Idempotente: ON CONFLICT DO NOTHING en barcode (único) y en las FKs.
-- Formato VALUES para que `generate-product-images.mjs` descubra los colores
-- (D3b: COLOR_PATTERN + SKU_ID_STATEMENT).

-- 1. Nuevos SKUs (formato V12: referencia + join para que el generador
--    de imágenes descubra los colores; D3b).
INSERT INTO skus (product_id, barcode, color, size)
SELECT p.id, v.barcode, v.color, v.size
FROM (VALUES ('0432/021', '843321900103', 'Negro', 'M'),
             ('0432/021', '843321900104', 'Negro', 'L'),
             ('0432/021', '843321900105', 'Crudo', 'M'),
             ('0432/021', '843321900106', 'Crudo', 'L')) AS v(reference_code, barcode, color, size)
         JOIN products p ON p.reference_code = v.reference_code
ON CONFLICT (barcode) DO NOTHING;

-- 2. Precios: espejo de los SKUs originales (M <- sku 1, L <- sku 2)
INSERT INTO market_prices (sku_id, market_id, base_price, discount_price, is_active)
SELECT ns.id, mp.market_id, mp.base_price, mp.discount_price, mp.is_active
FROM skus ns
JOIN skus orig ON orig.barcode = CASE ns.barcode
    WHEN '843321900103' THEN '843321900101'
    WHEN '843321900104' THEN '843321900102'
    WHEN '843321900105' THEN '843321900101'
    WHEN '843321900106' THEN '843321900102'
END
JOIN market_prices mp ON mp.sku_id = orig.id
WHERE ns.barcode IN ('843321900103','843321900104','843321900105','843321900106')
  AND NOT EXISTS (SELECT 1 FROM market_prices x WHERE x.sku_id = ns.id AND x.market_id = mp.market_id);

-- 3. Stock: espejo de los SKUs originales
INSERT INTO stock_items (sku_id, warehouse_id, quantity_available, quantity_reserved)
SELECT ns.id, si.warehouse_id, si.quantity_available, si.quantity_reserved
FROM skus ns
JOIN skus orig ON orig.barcode = CASE ns.barcode
    WHEN '843321900103' THEN '843321900101'
    WHEN '843321900104' THEN '843321900102'
    WHEN '843321900105' THEN '843321900101'
    WHEN '843321900106' THEN '843321900102'
END
JOIN stock_items si ON si.sku_id = orig.id
WHERE ns.barcode IN ('843321900103','843321900104','843321900105','843321900106')
  AND NOT EXISTS (SELECT 1 FROM stock_items x WHERE x.sku_id = ns.id AND x.warehouse_id = si.warehouse_id);