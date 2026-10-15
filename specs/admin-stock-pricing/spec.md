# Spec — Tarea 7.3: Gestión de stock y precios (multimercado)

> **Fase 7 · Panel de administración** · requisitos (R1–R8) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D9) · checklist en `tasks.md`.
> **Estado**: ✅ APROBADA (2026-10-15, por el usuario) · **Fecha**: 2026-10-15

---

## Resumen

El panel gana la gestión de **stock multimercado-almacén** y de **precio por
mercado**, cerrando la frontera que la 7.2 dejó abierta (SKU nuevo sin
`market_prices`/`stock_items`).

- **4 endpoints** bajo `/api/v1/admin/**` — heredan `hasRole("ADMIN")`
  **sin tocar `SecurityConfig`** (plan D1).
- **Matriz de stock** en un solo `GET` (almacenes embebidos, sin N+1) +
  `PUT` por celda con **upsert** (plan D2).
- Guardas: `quantity_available ≥ 0` → `400`; **disponible < reservado →
  `409 STOCK_CONFLICT`**; escritura con **`PESSIMISTIC_WRITE`**; carreras de
  insert → `409`, nunca `500` (plan D3/D4).
- **Precios**: `GET` devuelve los **4 mercados** (nulls si no hay fila) +
  `PUT` upsert con validación en dos capas (jakarta + cross-field
  `0 < descuento ≤ base` → `400`) (plan D5).
- **Vitrina intocada**: mismas filas, reflejo en vivo sin cambiar
  `PricingService`/`InventoryService` (plan D7).
- Frontend: **`/admin/stock`** (matriz editable) + **bloque de precios en la
  ficha de producto** + tarjeta en la portada (plan D8).
- **Sin migración, sin reindex, sin ADR** (plan D9).

---

## R1 — API de stock bajo `/api/v1/admin/stock`

**Criterio**: el panel lee y escribe el stock por almacén desde la zona admin;
las lecturas públicas de inventario no cambian.

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `GET /api/v1/admin/stock` | `200` | `StockMatrixResponse` |
| `PUT /api/v1/admin/stock/{skuId}/{warehouseCode}` | `200` | `StockUpdateRequest` → `StockCellResponse` |

**Formas** (records; entidades jamás expuestas — regla 4.4):

```jsonc
// StockMatrixResponse
{
  "warehouses": [{ "code": "WH_ARTEIXO", "name": "Centro Logístico Sabón", "countryCode": "ES" }],
  "rows": [{
    "skuId": 1, "productId": 1, "referenceCode": "0432/021",
    "productName": "Blazer Cruzada Estructura", "color": "Marino", "size": "M",
    "cells": [{ "warehouseCode": "WH_ARTEIXO",
                "quantityAvailable": 40, "quantityReserved": 4, "netAvailable": 36 }]
  }]
}
// StockUpdateRequest  → { "quantityAvailable": 40 }
// StockCellResponse   → la celda resultante (mismo shape que cells[])
```

**Criterios de aceptación**

1. `GET /admin/stock` devuelve **todos los SKUs** del catálogo y, para cada
   uno, **una celda por cada almacén**: sin fila en `stock_items` la celda se
   devuelve `0/0/0` (así un SKU creado en la 7.2 aparece ya en la matriz).
   Almacenes ordenados por `code`; filas ordenadas por `referenceCode`+`size`
   (determinismo en tests).
2. La respuesta se construye con **consultas con joins** (`stock_items → sku →
   product → warehouse` y `skus → products`), **sin N+1**: un `GET` con N SKUs
   no dispara N+1 consultas (verificable con log de Hibernate en test de service).
3. `PUT` es **upsert**: si la fila `(sku, warehouse)` existe la actualiza; si
   no, la **crea** con `quantityReserved = 0` (cierre de la frontera 7.2 D9).
   Siempre `200` con la celda resultante (no `201` — la representación es la
   misma).
4. El `PUT` **no acepta** `quantityReserved`: el body sólo contiene
   `quantityAvailable` (plan D3).
5. Matriz sin SKUs (catálogo vacío) → `200` con `rows: []` y los almacenes.

## R2 — Guardas de stock: validación, bloqueo y `409`

**Criterio**: el invariant «reservado ≤ disponible» es inquebrantable y la
escritura admin no puede pisar al checkout.

**Criterios de aceptación**

1. `quantityAvailable` **entero `≥ 0`** (`@NotNull @PositiveOrZero`): falta,
   negativo o no entero → `400` con `message` en español (handler de
   `MethodArgumentNotValidException`, ya existente).
2. `quantityAvailable < quantityReserved` → **`409`** con `code:
   "STOCK_CONFLICT"`, `message` que incluye las unidades reservadas, y
   excepción nueva `StockConflictException` (mismo patrón de
   `CatalogConflictException` en `GlobalExceptionHandler`).
3. El `PUT` lee la fila con **`findBySkuIdAndWarehouseCodeForUpdate`
   (`PESSIMISTIC_WRITE`)** — el repo ya lo tiene — y se serializa con
   `POST /api/v1/inventory/reserve` sobre la misma fila.
4. Carrera de doble insert (fila inexistente + dos `PUT` concurrentes) →
   `DataIntegrityViolationException` (`uk_sku_warehouse`) traducida a **`409`**,
   jamás `500`.
5. `skuId` inexistente o `warehouseCode` desconocido → **`404`**
   (`ResourceNotFoundException`).

## R3 — API de precios por SKU × mercado

**Criterio**: el precio de cada SKU se gestiona mercado a mercado desde la
zona admin; el cálculo público no cambia.

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `GET /api/v1/admin/skus/{skuId}/prices` | `200` | `SkuPriceResponse[4]` |
| `PUT /api/v1/admin/skus/{skuId}/prices/{marketCode}` | `200` | `PriceUpdateRequest` → `SkuPriceResponse` |

```jsonc
// SkuPriceResponse (nulls = el SKU no tiene fila para ese mercado aún)
{ "marketCode": "ES", "marketName": "España", "currency": "EUR", "taxRate": 21.00,
  "basePrice": 89.99, "discountPrice": 79.99, "isActive": true }
// PriceUpdateRequest → { "basePrice": 89.99, "discountPrice": null, "isActive": true }
```

**Criterios de aceptación**

1. `GET` devuelve **siempre los 4 mercados** (catálogo de `markets` cruzado
   con las filas del SKU, orden determinista por `code`); sin fila → campos en
   `null` — la UI pinta inputs vacíos listos para crear (cierre de frontera
   7.2 D9).
2. `PUT` es **upsert** sobre `uk_sku_market` → `200` con la fila resultante.
3. **Validación capa 1** (`jakarta` en el record, mensajes en español):
   `basePrice` `@NotNull @Positive @Digits(integer=8, fraction=2)` ·
   `discountPrice` opcional `@Positive @Digits(8,2)` (**`null` = sin
   descuento; el `0` se rechaza**) · `isActive` `@NotNull` → todo fallo `400`
   con `message`.
4. **Validación capa 2** (cross-field, en el service): `discountPrice >
   basePrice` → `IllegalArgumentException` → **`400` con `message`**. El
   cliente la **espelja antes de llamar** (plan D5).
5. Carrera de doble insert → `DataIntegrityViolationException` traducida a
   **`409`** reutilizando `CatalogConflictException`; `skuId`/`marketCode`
   desconocidos → **`404`**.
6. **Sin `double`/`float` en ninguna parte**: `BigDecimal` de punta a punta
   (regla 4.1). Aquí no hay aritmética — la única, la de `PricingService`, no
   se toca.
7. Tras un `PUT` con `isActive: false`, el precio público
   `GET /api/v1/pricing/skus/{skuId}?market=...` responde `404` (mismo
   comportamiento que «sin precio»), y con `true` refleja el nuevo valor.

## R4 — Seguridad heredada, sin reglas nuevas

**Criterio**: la protección de los 4 endpoints es la misma regla de la 7.1.

**Criterios de aceptación**

1. Los 4 endpoints responden **`401`** sin token, **`403`** con rol `USER`
   (`e2e@nexus.dev`) y **`200`** con rol `ADMIN`.
2. `git diff` de la rama: **`SecurityConfig.java` sin cambios** — la protección
   viene de `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` (ADR-0006).
3. Ningún endpoint nuevo vive bajo `/api/v1/inventory/**` ni
   `/api/v1/pricing/**` (zonas públicas intactas, plan D1).

## R5 — Vitrina intocada: reflejo en vivo

**Criterio**: gestionar stock y precios no exige tocar la vitrina — cambian
las mismas filas que ella lee.

**Criterios de aceptación**

1. `PricingController`, `InventoryController`, `PricingService` e
   `InventoryService` **sin cambios** (sólo se añaden records/consultas en
   repositories y clases `Admin*` nuevas).
2. Cambiar el stock de un SKU y llamar `GET /api/v1/inventory/skus/{id}` refleja
   el `netAvailable` nuevo **sin reiniciar nada**.
3. Poner un `discountPrice` y llamar `GET /api/v1/pricing/skus/{id}?market=ES`
   devuelve el precio final con descuento.
4. Un SKU **sin precio** deja de estar «no disponible» en el PDP en cuanto se
   crea su fila con `PUT` (cierre del bucle 7.2 D9, verificado en navegador).
5. Los E2E existentes (compra con stock `40`, tallas M…) siguen en verde:
   las semillas no cambian y los valores por defecto se restauran tras la
   verificación manual.

## R6 — Frontend: página `/admin/stock`

**Criterio**: el ADMIN ve y edita la matriz de stock por almacén con feedback
inmediato y errores amigables.

**Criterios de aceptación**

1. Ruta `/admin/stock` dentro de `app/admin/layout.tsx` (la puerta `AdminRoute`
   ya la protege: `USER` → redirige a `/`); enlace visible desde la portada
   (R7.3).
2. Tabla: por fila `referenceCode` (enlace a la ficha de edición), producto,
   talla y color; por almacén una columna con **disponible (input editable) ·
   reservado (sólo lectura) · neto**; y **total ATS** por fila (suma de nets).
3. Guardado **por celda**: «Guardar» habilitado sólo si la celda cambió →
   `PUT` → actualiza la celda con la respuesta del servidor y muestra **toast
   «Stock actualizado»**. Fallo → **sin** toast de éxito.
4. `409 STOCK_CONFLICT` → mensaje amigable vía `getFriendlyErrorMessage()`;
   `400` → muestra el `message` del servidor; `404` (SKU borrado en otra
   pestaña) → mensaje amigable.
5. Estados: **cargando** (sin flash de celdas vacías), **error de red**
   traducido, **matriz vacía** (catálogo sin SKUs) con mensaje editorial.
6. Inputs `type="number" min="0" step="1"` con **`text-neutral-900`** (regla 7),
   `<label>`/`aria-label` por celda y foco visible (a11y: los E2E de axe
   audit `/admin` — la nueva ruta se añade a la auditoría sólo si el alcance
   de las 14 rutas lo permite **sin cambiar el gate**; si no, se cubre con
   test de componentes).
7. `api.ts` gana `getAdminStock()` y `updateAdminStockCell(skuId, warehouseCode, body)`
   (con token, umbral del fichero ≥99 preservado).

## R7 — Frontend: precios en la ficha de producto y portada

**Criterio**: crear un SKU y preciarlo ocurre en la misma página.

**Criterios de aceptación**

1. `/admin/products/[id]/edit` añade el bloque **«Precios por mercado»**: uno
   por SKU (título «TALLA · COLOR») con tabla de las 4 filas de mercado
   (base · descuento · activo) + «Guardar» por fila → **toast «Precio
   guardado»**. El bloque es **autosuficiente**: los mercados salen del propio
   `GET /skus/{id}/prices` (sin `MarketContext`).
2. Producto **sin SKUs** → mensaje «Añade una variante para poder preciarla»
   (sin peticiones). Inputs vacíos crean la fila en el primer guardado.
3. Portada `/admin`: tarjeta **«Stock y precios»** → `/admin/stock`, con nota
   de que los precios se editan en la ficha de producto.
4. Espejo de validación en cliente: descuento vacío → `null` (no `0`);
   `descuento > base` o `base ≤ 0` → error en el campo **antes** de llamar;
   en cualquier caso de `400` se muestra el `message` del servidor.
5. Inputs con **`text-neutral-900`** y etiquetas accesibles; checkbox «Activo»
   con label asociado.
6. `api.ts` gana `getAdminSkuPrices(skuId)` y `updateAdminSkuPrice(skuId, marketCode, body)`;
   `errors.ts` traduce `STOCK_CONFLICT` y conserva `getFriendlyErrorMessage()`
   como puerta única.

## R8 — Tests y documentación

**Criterio**: la feature se prueba entera y deja el repositorio en verde.

**Criterios de aceptación**

1. **Backend**: MockMvc de los 4 endpoints (códigos de éxito), service con
   guardas (`400` validación, `400` cross-field, `404`, `409 STOCK_CONFLICT`,
   upsert crear/actualizar, `isActive=false` → precio público `404`), y
   seguridad `401`/`403`/`200`.
2. **Los tests de escritura no ensucian la BD compartida**: rollback
   (`@Transactional`) o limpieza en `@AfterEach` — `CatalogSeedTest` y los E2E
   siguen pasando (mismo criterio que la 7.2).
3. **Frontend**: `/admin/stock` (render, edición, guardado, `409` amigable,
   vacío/carga), bloque de precios (guardar por mercado, validación espejo,
   sin SKUs), portada, y las 4 funciones nuevas de `api.ts` (umbral ≥99).
4. **R8 del proyecto**: ningún test preexistente cambia su aserción **salvo
   los cambios declarados**: `AdminPage.test` (la portada gana la tarjeta R7.3)
   y `AdminProductEditPage.test` (la ficha ahora pide precios al montarse →
   mocks nuevos; la aserción original se conserva).
5. Verificación **en navegador** de los flujos R5.2–R5.4 y de la guarda `409`
   (p. ej. con `quantity_reserved` temporalmente elevado vía SQL y restaurado).
6. `CHANGELOG.md` en es-ES · bloque «ESTADO ACTUAL» de `AGENTS.md` dentro de la
   feature PR (verdad tras el merge, sin PR/SHA) · `MEMORY.md` actualizado ·
   **sin ADR** (plan D9) · **sin PR de documentación de cierre** (plan D9).
