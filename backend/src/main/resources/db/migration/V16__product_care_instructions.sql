-- V16 — Tarea C de la hoja de ruta (spec specs/color-and-care/): cuidados de lavado
--
-- El producto no tenía NINGÚN sitio donde registrar los cuidados: la ficha
-- los inventaba (un párrafo hardcodeado de acabados en la PDP) y el panel no
-- podía editarlos. Con la sección «Cuidados» de la vitrina hace falta un dato
-- de verdad (spec R4/R5).
--
-- 1) Una única columna NULLABLE, **sin backfill**: `NULL` = el producto no
--    tiene cuidados registrados y la vitrina **no pinta la sección** (R5) —
--    los 3.000 productos existentes quedan así sin un solo UPDATE. El texto
--    es una lista corta escrita por el operador, no un dato de identidad.
--    `IF NOT EXISTS` hace inocuo reejecutar el fichero (patrón V13/V14/V15).
--
-- 2) Sin índice y sin DEFAULT: nadie filtra ni ordena por cuidados, y un
--    DEFAULT de texto inventado sería peor que el `NULL` honesto.
--
-- Precedente estructural: `products.description` (V1, TEXT) — mismo recorrido
-- entidad → DTO → `@Size(max = 2000)` → normalización blank → NULL en servicio.

ALTER TABLE products ADD COLUMN IF NOT EXISTS care_instructions TEXT NULL;
