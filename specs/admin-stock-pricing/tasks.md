# Tasks — Tarea 7.3: Gestión de stock y precios (multimercado)

> **Fase 7 · Panel de administración** · spec `spec.md` (R1–R8) · plan `plan.md` (D1–D9).
> Un checkbox por unidad terminada; las decisiones y hallazgos quedan como nota
> debajo de su bloque. **Regla**: marcar al completar; nada de código fuera de
> este checklist.

---

## A — DTOs, excepción de conflicto y consultas (R1, R2, R3, plan D3/D4/D5/D6)

- [x] **A.1** `StockUpdateRequest`: `quantityAvailable` `@NotNull @PositiveOrZero` (entero, mensajes en español)
- [x] **A.2** `StockMatrixResponse` con `warehouses[]` (code/name/countryCode) + `rows[]` (skuId, productId, referenceCode, productName, color, size, `cells[]` → warehouseCode, quantityAvailable, quantityReserved, netAvailable) — records, sin entities
- [x] **A.3** `SkuPriceResponse` (marketCode, marketName, currency, taxRate, basePrice, discountPrice, isActive — **nullable** los tres últimos) + `PriceUpdateRequest` (`basePrice` `@NotNull @Positive @Digits(8,2)` · `discountPrice` opcional `@Positive @Digits(8,2)` · `isActive` `@NotNull`)
- [x] **A.4** Excepción `StockConflictException` + handler en `GlobalExceptionHandler` → `409` con `code: "STOCK_CONFLICT"` y mensaje en español (patrón de `CatalogConflictException`)
- [x] **A.5** Consultas nuevas: `StockItemRepository` (todos los items con sku+product+warehouse, JOIN FETCH) · `SkuRepository` (todos los SKUs con product, orden por referenceCode+size) · `MarketPriceRepository` (filas del SKU con mercado **sin filtrar `isActive`** + finder por sku+market para upsert)
- [x] **A.6** `SecurityConfig` **sin ningún cambio** (verificar por diff, plan D1)

## B — Servicios y controllers (R1–R5, plan D2/D3/D4/D5/D7)

- [x] **B.1** `AdminStockService.getMatrix()`: almacenes ordenados por `code` + todos los SKUs con una celda por almacén (`0/0/0` si no hay fila), consultas con joins **sin N+1** (R1.1/R1.2/R1.5)
- [x] **B.2** `AdminStockService.actualizarCelda(skuId, warehouseCode, request)`: `404` sku/almacén · lock `PESSIMISTIC_WRITE` con el repo existente · guarda `available < reserved` → `409 STOCK_CONFLICT` (R2.2/R2.3) · upsert (crea con `reserved=0`) · `DataIntegrityViolationException` → `409` (R2.4) · `net = max(0, available − reserved)`
- [x] **B.3** `AdminPricingService.getPrecios(skuId)`: `404` si el SKU no existe · **4 mercados siempre** ordenados por `code`, nulls si no hay fila (R3.1)
- [x] **B.4** `AdminPricingService.actualizarPrecio(skuId, marketCode, request)`: `404` sku/mercado · cross-field `descuento > base` → `IllegalArgumentException` → `400` (R3.4) · upsert sobre `uk_sku_market` con carrera → `409 CatalogConflictException` (R3.5) · devuelve la fila resultante
- [x] **B.5** `AdminStockController` (GET `/api/v1/admin/stock`, PUT `/{skuId}/{warehouseCode}`) + `AdminSkuPriceController` (GET/PUT `.../skus/{skuId}/prices[/{marketCode}]`) con `@Tag`/`@Operation` y `@Valid`
- [x] **B.6** Cero cambios en `PricingController`/`InventoryController`/`PricingService`/`InventoryService` (R5.1) — verificar por diff

## C — Tests backend (R4, R8)

- [x] **C.1** Matriz: `200` con almacenes + todos los SKUs · SKU sin `stock_items` aparece en `0/0/0` · celdas completas por almacén · determinismo del orden
- [x] **C.2** PUT stock: upsert crear → fila nueva visible · actualizar → `200` con celda · `available < reserved` → `409 STOCK_CONFLICT` · negativo/nulo → `400` · sku/almacén desconocido → `404`
- [x] **C.3** Precios: `GET` devuelve los 4 mercados con nulls sin fila · `PUT` crea/actualiza · `descuento > base` → `400` con message · `base=0`/`descuento=0` → `400` · `isActive=false` → precio público `404` · `isActive=true` refleja el nuevo valor · `404` sku/mercado
- [x] **C.4** Seguridad de los 4 endpoints: `401` sin token · `403` USER · `200` ADMIN (junto a los tests de seguridad existentes)
- [x] **C.5** **BD compartida limpia**: escrituras con `@Transactional` (rollback) o limpieza en `@AfterEach` — `CatalogSeedTest` y E2E sin restos
- [x] **C.6** `./mvnw test` en verde con la suite completa (**225+**)

## D — Frontend: tipos, cliente y errores (R6.7, R7.6)

- [x] **D.1** `types/commerce.ts`: `StockMatrix`/`StockWarehouse`/`StockRow`/`StockCell`/`SkuPrice` reflejando los records del backend
- [x] **D.2** `lib/api.ts`: `getAdminStock()`, `updateAdminStockCell()`, `getAdminSkuPrices()`, `updateAdminSkuPrice()` con `getAuthHeaders()` — **`api.ts` ≥ 99 preservado**
- [x] **D.3** `lib/errors.ts`: `STOCK_CONFLICT` traducido («No se puede por debajo de las unidades reservadas…») — `getFriendlyErrorMessage()` sigue siendo la puerta única

## E — Frontend: superficies del panel (R6, R7)

- [x] **E.1** `/admin/stock`: tabla SKU × almacén (referencia enlazada a la ficha, producto, talla, color) con disponible (input `number min=0 step=1`) · reservado (solo lectura) · neto + **total ATS** por fila
- [x] **E.2** `/admin/stock`: guardado **por celda** (habilitado sólo si cambió) → PUT → celda actualizada con la respuesta + **toast «Stock actualizado»**; `409`/`400`/`404` → mensajes amigables; estados de carga, error de red y matriz vacía
- [x] **E.3** Bloque **«Precios por mercado»** en `/admin/products/[id]/edit`: uno por SKU con las 4 filas (base · descuento · activo) autosuficientes del propio GET, guardar por fila → **toast «Precio guardado»**, producto sin SKUs → mensaje sin peticiones
- [x] **E.4** Espejo de validación en cliente: vacío → `null` (nunca `0`), `descuento > base`/`base ≤ 0` → error en campo antes de llamar; `400` → `message` del servidor
- [x] **E.5** Portada `/admin`: tarjeta **«Stock y precios»** → `/admin/stock` con nota «los precios, en la ficha de producto»
- [x] **E.6** Inputs con `text-neutral-900`, labels/`aria-label` accesibles, estilo editorial, `tsc` 0, ESLint 0/0

## F — Tests frontend (R6, R7, R8)

- [x] **F.1** `AdminStockPage.test.tsx`: render de la matriz, editar celda + guardar → toast, `409` → mensaje amigable, matriz vacía, estados de carga
- [x] **F.2** `AdminSkuPrices.test.tsx`: render 4 mercados desde el GET, guardar por fila → toast, validación espejo (descuento > base), sin SKUs → mensaje
- [x] **F.3** `AdminProductEditPage.test.tsx`: mocks nuevos del GET de precios **sin cambiar la aserción original** (cambio declarado R8.4) + bloque presente
- [x] **F.4** `AdminPage.test.tsx`: tarjeta «Stock y precios» (cambio declarado R8.4)
- [x] **F.5** `Api.test.ts`: URLs/métodos/auth de las 4 funciones nuevas · **`errors.test`** con `STOCK_CONFLICT` — `api.ts` ≥ 99
- [x] **F.6** `npm run test:coverage` EXIT 0 con umbrales congelados (**340+**)

## G — Documentación y cierre (R8.6, plan D9)

- [x] **G.1** `CHANGELOG.md` — entrada en Keep a Changelog es-ES
- [x] **G.2** Bloque «ESTADO ACTUAL» de `AGENTS.md` **dentro de la feature PR** (verdad tras el merge, sin PR/SHA) + `MEMORY.md` con la tarea marcada
- [x] **G.3** **Sin ADR** (plan D9) · **sin PR de documentación de cierre** (plan D9) · sin migraciones (plan D9)

## Cierre

- [x] **Baselines**: `./mvnw test` **225+** · `npm run test:coverage` **340+** y EXIT 0 (globales 77/76/74/79 + `api.ts` ≥ 99 — **`npx vitest run` no evalúa umbrales**) · `tsc` 0 · ESLint 0/0 · `npm run build` 0 · E2E local (Chromium+WebKit) verde
- [x] **Verificación en navegador**: como ADMIN — ver matriz con celdas `0/0/0` de un SKU sin stock, editar stock → PDP/vitrina refleja, poner descuento → precio final tachado, crear precio de SKU sin precios → PDP sale de «no disponible», `409` de reserva-resguardado traducido · como USER — `/admin/stock` redirige a `/`
- [x] **BD compartida**: tras los tests, `CatalogSeedTest` sigue viendo exactamente las 4 referencias y la BD de dev sin restos
- [x] `/spec-check admin-stock-pricing` → aprobado
- [x] **Preguntar al usuario antes de cualquier commit y PR** ⛔ — aprobado el 2026-10-15

---

## Notas de implementación

*(se rellenan con los hallazgos del camino)*
