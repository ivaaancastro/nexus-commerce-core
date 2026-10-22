# Tasks — Colores visibles y cuidados de lavado (`color-and-care`)

> Rama `feat/color-and-care` · **spec aprobada 2026-10-22** · M.
> Migración única **V16** · **fotos por referencia** (R8/D10) · catálogo de tarjetas intacto.

## A — Backend: migración, entidad, DTOs y servicio

- [x] **T1** — Rama `feat/color-and-care` desde `main`
- [x] **T2** — `V16__product_care_instructions.sql`: `care_instructions TEXT NULL`, `IF NOT EXISTS`, **sin backfill**
- [x] **T3** — `Product.careInstructions` + `ProductResponse` gana el campo **al final** (nullable)
- [x] **T4** — `ProductCreateRequest` / `ProductUpdateRequest`: `@Size(max = 2000)` opcional
- [x] **T5** — `AdminProductService`: normalización **blank → `null`** — helper generalizado a `normalizarTexto` (compartido con la descripción) en crear y actualizar

## B — Backend tests

- [x] **T6** — Service: crear/actualizar con cuidados · blank → `null` · `referenceCode`/`barcode` inmutables · **R8.3**: 2 constructores `ProductCreateRequest` preexistentes ampliados a 5 argumentos
- [x] **T7** — Controller (MockMvc sobre PG real): `careInstructions` en el shape del catálogo público · **`NULL` real en BD** al enviarlo en blanco · `400` con `message` si > 2000
- **Backend: 349 tests, 0 errores, 0 fallos** (345 + 4 nuevos), V16 aplicada por Flyway

## C — PDP

- [x] **T8** — Selector de color derivado de `product.skus` (D1, visible también con 1 color) + tallas **filtradas** (D2) + **conservar la talla** al cambiar de color, con caída a la primera disponible (R3)
- [x] **T9** — Sección **«Cuidados»**: `data-testid="product-care"`, `whitespace-pre-line`, pintada **sólo con contenido**, **después** de la descripción (D4)

## D — Admin y tipos

- [x] **T10** — `AdminProductForm`: textarea «Cuidados» (validación espejo 2000, `trim()`, `undefined` si vacío, reset al crear)
- [x] **T11** — `Product.careInstructions?` + `ProductCreateData`/`ProductUpdateData` en `src/types/commerce.ts`

## E — Frontend tests

- [x] **T12** — `ProductDetailPage.test`: 7 tests nuevos — selector con 4 colores, tallas filtradas por color, conservar talla (y caer a la primera sin ella), D1 con un solo color, cuidados con saltos de línea y tras la descripción, ausencia de sección, y **R8 negativa** (el cambio de color no mueve la galería). Fixture `PDP_COLORES` de 9 SKUs
- [x] **T13** — `AdminProductForm.test`: payload con cuidados recortados al crear · en edición se cargan, se borran y el payload va sin ellos. **La aserción preexistente de L126 no se tocó** (cláusula `undefined` ignorada por `toHaveBeenCalledWith`)

## F — Gates y cierre

- [x] **T14** — Gates: backend **349/0/0** · frontend `test:coverage` **85.94 / 81.78 / 83.75 / 88.03** (umbrales 77/76/74/79 intactos) · `tsc --noEmit` **0** · ESLint **0/0** · `npm run build` **exit 0**
- [x] **T15** — Verificación en navegador (D9): **3/3** contra backend real (Chromium) — selector con un color real **sin mover las fotos** · producto temporal de **2 colores** creado y borrado por la propia prueba (Marino S/M · Camel M: tallas separadas y **la talla M conservada** al cambiar de color, con el barcode cambiando al SKU correspondiente) · **admin → ficha → PDP → borrado** (el cuidado se pinta con sus saltos y **la sección desaparece entera** al dejarlo en blanco) · **axe 14/14** · **BD sin restos** (temporal fuera, `care_instructions` a `NULL`, catálogo con sus 4 productos) · one-off borrado
- [x] **T16** — CHANGELOG · bloque ESTADO ACTUAL en `AGENTS.md` (tabla + decisiones `color-and-care`) · `/spec-check color-and-care` → **APROBADO** · ⛔ **permiso de commit/push/PR pedido al usuario**

---

## Apuntes de la verificación (medidos el 2026-10-22)

1. **La URL de la PDP va codificada**: la referencia lleva `/` dentro, así que
   `/products/0432%2F021` — igual que `ProductCard` L94. **Sin codificar, Next
   devuelve 404** y una verificación "no ve" lo que sí está implementado.
   La suite `a11y.spec.ts` ya lo hacía (ruta 9).
2. **La semilla V12 tiene un color por producto** (Marino/Camel/Crudo/Negro
   repartidos en 4 referencias), no 4 colores en una — el multi-color se
   verifica con un producto temporal que crea y borra la propia prueba
   (credenciales `admin@nexus.dev` / `Admin1234!`; el login responde **`token`**).
3. **El código de barras sólo admite dígitos** (`\d{8,20}` en `SkuCreateRequest`):
   meter la talla dentro del código devuelve **400** — comprobado en vivo.
4. **Un paso de creación fuera del `try/finally` deja datos huérfanos**: la
   primera corrida dejó un producto temporal en BD; se recuperó con
   `DELETE /api/v1/admin/products/{id}` y el script quedó cubierto.
