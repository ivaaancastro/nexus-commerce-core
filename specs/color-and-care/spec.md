# Spec — Colores visibles en la PDP y cuidados de lavado

> **Feature `color-and-care`** (Tarea C de la hoja de ruta) · selector de
> color que agrupa tallas + sección «Cuidados» editable desde el panel ·
> **⏳ pendiente de aprobación** · Basado en `plan.md` (D1–D10).
> **Migración única `V16`** · catálogo de tarjetas **intocado**.

---

## 1. Contexto

La PDP no muestra el color en ningún sitio: el selector de tallas pinta
`product.skus` **plano**, así que con dos colores aparecen dos botones «M» sin
distinguir de qué color son (el dato sí existe y sí viaja: `Sku.color`). Por
otra parte, los **cuidados de lavado** no existen en el producto en ningún
punto de la cadena — ni en BD ni en la vitrina ni en el panel. Esta feature
hace visibles los primeros y da un sitio de verdad editables a los segundos.

## 2. Requisitos funcionales

- **R1 · Selector de color en la PDP**: se muestran los colores del producto
  (derivados de `product.skus`, orden de primera aparición) con la etiqueta
  editorial correspondiente. **Se muestra también con un solo color** — hoy el
  color no se ve en la ficha y es información.
- **R2 · Agrupación de tallas**: el grid de tallas sólo pinta los SKUs **del
  color elegido**. Con el selector, nunca se ven dos botones «M» idénticos sin
  contexto de color.
- **R3 · Cambiar de color conserva la talla cuando existe**: al elegir otro
  color se selecciona el primer SKU de ese color **prefiriendo la misma
  `size`**; se cambia de talla sólo si esa talla no existe en el color nuevo.
  Precio y stock se recargan con el flujo ya existente (`selectedSku`).
- **R4 · Cuidados editables desde el panel**: el formulario de crear/editar
  producto gana un campo **«Cuidados»** (texto largo con saltos de línea,
  hasta 2000 caracteres, **opcional**) que guarda `products.care_instructions`
  con la misma normalización que `description` (**en blanco → `NULL`**).
- **R5 · Cuidados visibles en la PDP**: sección «Cuidados» pintada **sólo si
  tiene contenido**, **después** de la descripción, respetando los saltos de
  línea escritos en el panel. Con el campo vacío **no se pinta nada**.
- **R6 · Catálogo intacto**: `ProductCard` y `/search` **no cambian**; la
  facet de color del catálogo sigue funcionando igual.
- **R7 · Cero sorpresas en lo existente**: `/receipt`, devoluciones, precios,
  stock y la búsqueda vectorial **sin cambios**; los productos existentes
  quedan **sin cuidados** (migración sin backfill) y eso es visible como tal.
- **R8 · La galería es por referencia, y así se dice** (decisión del usuario
  2026-10-22, D10 del plan): **cambiar de color no cambia las fotos** — cambia
  tallas, precio y stock, que es lo que va por SKU. La PDP **no afirma** que
  la foto sea del color elegido (no hay leyenda ni swatch de color junto a la
  galería). El manifiesto de imágenes, `getProductImages()` y la convención
  `{ref}-{n}.webp` **no se tocan**.

## 3. Requisitos técnicos

- **RT1 — `V16__product_care_instructions.sql`**: única migración;
  `products.care_instructions TEXT NULL` con `IF NOT EXISTS` (reejecutable),
  **sin `UPDATE`** de datos existentes.
- **RT2 — Backend**: `Product.careInstructions` · **`ProductResponse` gana el
  campo al final del record** (posible `null`) · `ProductCreateRequest` y
  `ProductUpdateRequest` con `@Size(max = 2000)` opcional · normalización
  **blank → `null`** en el servicio (espejo de `normalizarDescripcion`) ·
  `referenceCode` y `barcode` siguen **inmutables**.
- **RT3 — PDP**: `selectedColor` + `colores` derivados (D1) y tallas
  filtradas (D2) · sección `data-testid="product-care"` con
  `whitespace-pre-line` (D4), pintada sólo con contenido · el botón de compra
  sigue operando sobre `selectedSku`.
- **RT4 — Admin**: `careInstructions` en `AdminProductForm` (textarea,
  validación espejo «Máximo 2000 caracteres», `trim()` y `undefined` si vacío)
  y en `api.ts` el tipo del payload.
- **RT5 — Tipos**: `Product.careInstructions?: string` en
  `src/types/commerce.ts` (opcional, espejo del `null` del backend).
- **RT6 — Sin reindex** (D6): `ProductSearchService.toDocument()` **intocado**;
  ningún workflow de CI ni `POST /products/search/index` se toca.
- **RT7 — R8.3 declaradas**: `AdminProductForm.test` (payload del `PUT` con
  `careInstructions`) y, si algún test de la PDP asertara orden o copy
  afectado, `ProductDetailPage.test` — declarado **antes** de tocarlo.

## 4. Alcance y no-alcance

| En alcance | Fuera de alcance |
|:---|:---|
| PDP: selector de color + sección «Cuidados» | **Tarjetas del catálogo** (no cambian) |
| `AdminProductForm`: campo «Cuidados» crear/editar | Búsqueda vectorial e índice (`toDocument` intocado) |
| `V16` · `Product` · `ProductResponse` · requests | Swatches con color hex (la BD sólo guarda el nombre) |
| Types `commerce.ts` + `api.ts` | `/receipt`, devoluciones, precios, stock |
| R8.3 declaradas en los tests afectados | Multi-idioma de la sección de cuidados |
| | **Fotos por color** — la galería es por referencia (R8/D10); `product-images.json`, `getProductImages()` y `{ref}-{n}.webp` **intactos** |

## 5. Criterios de aceptación / gates

1. `cd backend && ./mvnw test` → **EXIT 0** con los tests nuevos y los
   **345 preexistentes intactos**; migraciones **V1–V16** sin regresiones
   (`CatalogSeedTest` incluido).
2. `cd frontend && npm run test:coverage` → **EXIT 0**, sin bajar de los
   umbrales congelados (77/76/74/79 + `api.ts` ≥ 99).
3. `tsc --noEmit` 0 · ESLint 0/0 · `npm run build` 0 (reconstrucción limpia).
4. Verificación **en navegador** sobre el stack real (Playwright + capturas):
   - PDP de una referencia con **varios colores** (semilla `V12`): selector
     visible, cambiar de color **filtra las tallas** y **conserva la talla**.
   - Cambiar de color **recarga precio/stock** y el botón de compra sigue
     operando sobre el SKU correcto (barcode visible).
   - **R8 (comprobación negativa)**: cambiar de color **no cambia la
     galería** — las 3 fotos siguen siendo las de la referencia, y la PDP no
     afirma en ningún sitio que la foto sea del color elegido.
   - Crear un cuidado desde `/admin/products/[id]/edit` → aparece en la PDP
     con sus saltos de línea; **borrarlo → la sección desaparece**.
   - Referencia **sin cuidados**: sin sección (no un bloque vacío).
   - `/catalog` y `/search` **byte-idénticos en comportamiento** (R6).
5. axe → **14/14** sin hallazgos bloqueantes.
6. `/spec-check color-and-care` → aprobado.

## 6. Datos y API

- **Shape nuevo** (campo al final y opcional):
  `ProductResponse { id, referenceCode, name, description, family, skus, careInstructions?: string | null }`
- **Escritura**: `POST/PUT /api/v1/admin/products[/{id}]` aceptan
  `careInstructions` opcional ≤ 2000; en blanco se guarda `NULL`.
- **Color**: sin cambios de API — `SkuResponse.color` ya existe.
- Migración: **V16** (columna nueva, sin datos ni índices).

## 7. Documentación

- `CHANGELOG.md` (Added: selector de color y sección de cuidados) y bloque
  «ESTADO ACTUAL» de `AGENTS.md`/`MEMORY.md` **dentro de la feature PR**
  (convención D11).
- Sin ADR (D7) · sin PR de documentación de cierre.
