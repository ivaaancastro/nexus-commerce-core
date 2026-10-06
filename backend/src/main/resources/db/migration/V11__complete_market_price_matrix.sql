-- V11 — Tarea 3.2: cobertura completa de precios por mercado
--
-- La semilla de V1 solo preció la talla M en ES, UK y CH: quedaban 4 celdas
-- vacías (US×2, UK×L, CH×L). Elegir US o la talla L en UK/CH devolvía 404 en
-- /pricing y un 400 en el checkout («Precio no configurado para el SKU …»).
--
-- Esto es SEMILLA DE PRUEBA, no lógica de negocio: las cifras se ajustarán
-- cuando haya catálogo real. La degradación defensiva de la spec (R4/R6) se
-- implementa igualmente y no depende de que esta matriz esté completa.
--
-- ON CONFLICT es obligatorio: el entorno de desarrollo puede tener filas que no
-- vienen de las migraciones, y una migración debe poder ejecutarse sobre una BD
-- parcialmente poblada sin duplicar la restricción uk_sku_market.

INSERT INTO market_prices (sku_id, market_id, base_price, discount_price)
SELECT s.id,
       m.id,
       v.base_price,
       NULL
FROM (VALUES
          (1, 'US',  84.95),   -- talla M en USD
          (2, 'UK',  79.99),   -- talla L en GBP
          (2, 'CH', 119.00),   -- talla L en CHF
          (2, 'US',  84.95)    -- talla L en USD
     ) AS v(sku_id, market_code, base_price)
         JOIN skus s ON s.id = v.sku_id
         JOIN markets m ON m.code = v.market_code
ON CONFLICT (sku_id, market_id) DO NOTHING;
