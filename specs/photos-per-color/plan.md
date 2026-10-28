# Plan — V6: Fotos por color (`photos-per-color`)

> **Feature**: V6 del bloque «Mejoras de vitrina» — galería que cambia con el color seleccionado.
> **Rama**: `feat/photos-per-color` (desde `main`).
> **Fecha**: 2026-10-28.
> **Depende de**: `color-and-care` (V3.x, mergeada) — el selector de color ya existe en la PDP y deriva de `product.skus`.

## Objetivo

Que al cambiar de color en la ficha de producto, la galería muestre las fotos de ese color (si existen) y, si no, las fotos genéricas del producto. Más un **producto demo multicolor** para que el comportamiento sea visible en el catálogo.

## Decisiones (aprobadas por el usuario 2026-10-28)

- **D1 — Naming de ficheros**: `{reference}-{COLOR}-{n}.webp` (ej. `0432-021-MARINO-1.webp`), color en mayúsculas sin espacios. Coherente con el patrón actual `0432-021-1.webp`.
- **D2 — Fallback**: si un color no tiene fotos propias, la galería muestra las fotos genéricas del producto (nunca queda vacía).
- **D3 — Comportamiento**: el selector de color de la PDP mueve la galería (`ProductGallery` recibe el color activo).
- **D4 — Demo multicolor**: se añaden variantes de color a un producto existente (sin migración de producto nuevo): se añaden SKUs de 2 colores adicionales a un producto ya sembrado, vía migración `V22`, para que el selector y la galería por color sean visibles.
- **D5 — Manifiesto**: se mantiene la estructura plana `{ reference: string[] }` para las fotos genéricas y se añaden entradas con clave compuesta `{reference}::{COLOR}` para las fotos por color. `getProductImages(reference, color?)` resuelve ambas. Sin cambio de shape en los consumidores que no pasan color (tarjetas, buscador).
- **D6 — Sin backend**: cero cambios en Spring/BD más allá de la migración de SKUs de demo. Las imágenes siguen siendo assets estáticos (Tarea 3.3).
- **D7 — Sin ADR**: no cambia stack ni arquitectura; sigue el patrón de assets de la 3.3.
- **D8 — Sin PR de documentación de cierre** (convención D11).

## Alcance

- `frontend/src/lib/product-images.ts`: `getProductImages(reference, color?)`.
- `frontend/src/components/ProductGallery.tsx`: prop `color?`.
- `frontend/src/app/products/[reference]/page.tsx`: pasar el color activo a la galería.
- `frontend/scripts/generate-product-images.mjs`: categorizar por color.
- `backend/src/main/resources/db/migration/V22__multicolor_demo.sql`: variantes de color para el producto demo.
- `npm run images` regenera el manifiesto con las entradas por color.

## Fuera de alcance

- Fotos por talla.
- Cambio de galería en tarjetas del catálogo (siguen con las fotos genéricas).
- Generación real de imágenes con IA (el script ya lo hace; aquí sólo se añaden las variantes de color al producto demo).