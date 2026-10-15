# Plan — Tarea 7.3: Gestión de stock y precios (multimercado)

> **Fase 7 · Panel de administración** · documento de diseño (D1–D9).
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md`.

---

## 1. Objetivo

La 7.2 creó productos y SKUs desde el panel, pero dejó una frontera explícita
(**D9**): un SKU nuevo nace **sin `market_prices` ni `stock_items`** — es
visible en la vitrina, pero no comprable. Hoy, además, **ningún SKU existente
se puede reajustar** desde la UI: precios y stock sólo se escriben con SQL
(migraciones V1/V11 y E2E).

**Resultado esperado**: un `ADMIN` puede (a) ver y editar **el stock por
almacén** desde `/admin/stock` y (b) ver y editar **el precio por mercado** de
cada SKU desde la ficha de producto; la vitrina pública refleja los cambios al
instante porque lee **las mismas filas**; un `USER` sigue recibiendo `403`.

---

## 2. Estado real — auditoría previa del repositorio (2026-10-15)

Hecha sobre el código de `main` (tras merge de la 7.2) antes de escribir la spec.

### 2.1 Las tablas existen, tienen datos… y **sólo se escriben con Flyway**

| Señal | Hallazgo |
|:---|:---|
| `market_prices` (V1) | `uk_sku_market UNIQUE (sku_id, market_id)`, `base_price NUMERIC(10,2) NOT NULL`, `discount_price` nullable, `is_active BOOLEAN DEFAULT TRUE`. |
| `stock_items` (V1) | `uk_sku_warehouse UNIQUE (sku_id, warehouse_id)`, `quantity_available INT NOT NULL DEFAULT 0`, `quantity_reserved INT NOT NULL DEFAULT 0`, `updated_at`. |
| Semillas | **4 mercados** (ES/UK/US/CH con `tax_rate`), **2 almacenes** (`WH_ARTEIXO`, `WH_ZARAGOZA`, ambos `CENTRAL`, coordenadas en V4/V5), matriz de precios **completada en V11** para los SKUs semilla. |
| Única vía de escritura | **Migraciones**. Ni `save(` ni `delete(` de `MarketPrice`/`StockItem` en el código de servicio (la reserva de checkout **actualiza** `quantity_reserved` vía dirty-checking bajo lock). |

### 2.2 Semántica ya establecida (no se toca, se respeta)

| Concepto | Cómo funciona hoy |
|:---|:---|
| **ATS** | `net = max(0, quantity_available − quantity_reserved)` por celda; el stock público **suma** `net` por SKU (`InventoryService.getStockBySku`). |
| **Reservas** | Sólo el checkout (`POST /inventory/reserve`) incrementa `quantity_reserved`, con `@Lock(PESSIMISTIC_WRITE)` sobre la fila (`findBySkuIdAndWarehouseCodeForUpdate`). |
| **Precio activo** | `findActivePriceBySkuAndMarket` filtra `is_active = true`; **manda el descuento**: `discount_price > 0 ? discount : base_price`; el impuesto lo pone el mercado (`tax_rate`). |
| **SKU sin fila** | Sin `market_prices` → PDP «precio no disponible»; sin `stock_items` → ATS 0 → «No disponible». **Ambos tolerados** (frontera 7.2 D9, verificada en la 7.2). |

### 2.3 Infraestructura reutilizable (ya está hecha)

- `StockItemRepository.findBySkuIdAndWarehouseCodeForUpdate` → **`PESSIMISTIC_WRITE`** ya existe para la reserva: el PUT de stock puede usarla tal cual.
- `GlobalExceptionHandler` ya mapea: `IllegalArgumentException` → **400 + message**, `MethodArgumentNotValidException` → **400 + message** (en español), `ResourceNotFoundException` → **404**, `CatalogConflictException` → **409 + code**.
- `GET /api/v1/markets` público → la tabla de precios de un producto puede montarse **con la propia respuesta del GET de precios** (cada fila trae `marketCode/name/currency/taxRate`), sin depender de contexto.
- `GET /api/v1/admin/products` (7.2) → el panel ya lista productos con SKUs.

### 2.4 Seguridad ya instalada (7.1, ADR-0006)

`SecurityConfig` L78: `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")`
**antes** de `anyRequest().denyAll()`. Todo endpoint nuevo bajo esa raíz
hereda 401/403 **con cero cambios**. Observación de auditoría (fuera de
alcance): `/api/v1/pricing/**` hace `permitAll` **sin restricción de método**,
pero `PricingController` sólo declara `GET` → sin superficie explotable hoy;
7.3 **no añade nada** bajo esa raíz (D1).

### 2.5 Frontera con la 7.2 (D9 de la 7.2) que esta tarea cierra

Un SKU creado en el panel no tiene precios ni stock → la 7.3 ofrece el
**upsert**: crear la fila desde la UI (no sólo actualizar la sembrada por
Flyway). Además, los precios se editan **en la misma página** donde se creó
el SKU, cerrando el bucle «crear → preciar» sin navegación extra.

---

## 3. Decisiones de diseño

### D1 — Todo bajo `/api/v1/admin/**` y hereda la regla 7.1

| Alternativa | Por qué no |
|:---|:---|
| Writes sobre `/api/v1/inventory/**` o `/api/v1/pricing/**` | Habría que meter matchers **antes** de los `permitAll` existentes (y `/pricing/**` no distingue método); tocar la zona pública para gestionar es el riesgo que la 6.4 ya cerró. |
| **`/api/v1/admin/stock` + `/api/v1/admin/skus/{skuId}/prices`** ✅ | Hereda `hasRole("ADMIN")` con **cero cambios en `SecurityConfig`** (mismo argumento que 7.2 D1). La vitrina no se toca. |

Endpoints nuevos (4):

| Método | Path | Éxito |
|:---|:---|:---|
| `GET` | `/api/v1/admin/stock` | `200` matriz completa (almacenes + filas SKU) |
| `PUT` | `/api/v1/admin/stock/{skuId}/{warehouseCode}` | `200` celda actualizada (upsert) |
| `GET` | `/api/v1/admin/skus/{skuId}/prices` | `200` los **4 mercados** del SKU |
| `PUT` | `/api/v1/admin/skus/{skuId}/prices/{marketCode}` | `200` fila actualizada (upsert) |

### D2 — Stock: **una matriz agregada en un solo GET** + PUT por celda

- `GET /admin/stock` devuelve **almacenes (columnas) + filas SKU** con una
  celda por almacén para **todos** los SKUs — consulta con joins
  (`stock_items → sku → product → warehouse`), **sin N+1**.
- Las celdas sin fila se devuelven como `0/0/0`: un SKU creado en la 7.2
  aparece en la matriz y su primera edición **crea** la fila (upsert).
- Los almacenes vienen **embebidos**: no hace falta `GET /admin/warehouses`.
- `PUT` devuelve **la celda resultante** para actualizar la UI sin re-fetch.
- Descartado: endpoints anidados bajo `/admin/products/{id}/skus/...` → path
  profundo y N peticiones para pintar una página que es una tabla.

### D3 — El admin edita `quantity_available`; **nunca `quantity_reserved`**

- `quantity_reserved` lo mueve **sólo el checkout** (transacción + lock, regla
  4.2). El panel lo **muestra** (reservado y neto) pero no lo edita: reservar a
  mano desde la UI duplicaría la lógica de `InventoryService.reserveStock`.
- **Guarda**: `quantityAvailable < quantityReserved` → **`409`**
  (`StockConflictException`, `code: STOCK_CONFLICT`, mensaje con las unidades
  reservadas). `net = max(0, …)` ocultaría la inconsistencia; reservado por
  encima de disponible es un estado imposible (las reservas salen de unidades).
- `quantityAvailable`: entero `≥ 0` (`400` si no). En dinero no aplica — aquí
  no hay aritmética monetaria (la regla 4.1 ya está cubierta: `BigDecimal` en
  toda la respuesta de precio, jamás `double`).

### D4 — Escritura de stock **bajo bloqueo pesimista**; carreras → 409, nunca 500

- El `PUT` lee la fila con `findBySkuIdAndWarehouseCodeForUpdate`
  (**`PESSIMISTIC_WRITE`**, ya existente): se serializa con una reserva
  concurrente del checkout sobre la **misma fila**.
- Fila inexistente (upsert): insert con carrera posible →
  `DataIntegrityViolationException` (`uk_sku_warehouse`) → **409**, mismo
  criterio que 7.2 D4. La carrera análoga de precios (`uk_sku_market`) →
  **409** reutilizando `CatalogConflictException`.

### D5 — Precios: upsert por (SKU, mercado) con validación en dos capas

- `GET /skus/{skuId}/prices` devuelve **siempre los 4 mercados** (la fila en
  BD cruzada con el catálogo de mercados); **sin fila → `null`** en
  `basePrice`/`discountPrice`/`isActive` → la UI pinta inputs vacíos listos
  para crear (cierra la frontera 7.2 D9).
- `PUT` `{basePrice, discountPrice?, isActive}` → crea o actualiza.
- **Capa 1 — `jakarta.validation`**: `basePrice` `@NotNull @Positive @Digits(8,2)` ·
  `discountPrice` opcional `@Positive @Digits(8,2)` · `isActive` `@NotNull`.
  El **0 no es un descuento**: para quitarlo se envía `null` (el frontend
  convierte vacío → `null`).
- **Capa 2 — cross-field** `0 < descuento ≤ base` → `IllegalArgumentException`
  → **400 + message** (handler ya existente). Un descuento mayor que el base
  haría «rebaajar» hacia arriba: se rechaza.
- Escala 2 con `@Digits` (HALF_UP no interviene: **no hay cálculo**, sólo
  persistencia; `PricingService` sigue haciendo la única aritmética, ya existente).

### D6 — DTOs nuevos para admin; **entidades jamás expuestas**

- Lectura: records nuevos `StockMatrixResponse` (almacenes + filas con celdas)
  y `SkuPriceResponse` (fila por mercado). No reutilizo
  `StockResponse`/`PriceCalculationResponse`: son las formas **públicas**
  (calculation/ATS) y no traen el contexto que el panel necesita
  (producto, reservado por celda, `is_active`).
- Escritura: `StockUpdateRequest`, `PriceUpdateRequest`, con validación
  `jakarta` **y espejo en cliente** (mismo criterio que 7.2 D8).

### D7 — Vitrina **intocada**: mismas filas, reflejo en vivo

`GET /pricing/**`, `GET /inventory/**`, PDP, carrito y checkout leen las
mismas tablas: un `PUT` admin es visible **sin cambiar una línea** de
`PricingService`/`InventoryService`. La verificación en navegador de la 7.3 lo
demuestra (stock → «No disponible» ↔ disponible; descuento → precio final
tachado; SKU sin precio → deja de estar «no disponible»).

### D8 — UX: stock en **`/admin/stock`**; precios en **la ficha de producto**

| Superficie | Contenido |
|:---|:---|
| **`/admin/stock`** (nueva) | Tabla SKU × almacén: producto/referencia/talla/color, por celda **disponible (editable) · reservado (sólo lectura) · neto**, total ATS por fila. Guardado **por celda** (input + «Guardar»), toast «Stock actualizado», `409` → mensaje amigable. Sin `confirm` (reversible). |
| **Ficha de producto** (`/admin/products/[id]/edit`) | Bloque por SKU («TALLA · COLOR») con tabla de 4 mercados: base · descuento · activo + «Guardar» por fila → toast «Precio guardado». **Autosuficiente**: las filas traen los mercados del propio GET (sin contexto de mercado). |
| **Portada `/admin`** | Tarjeta «Stock y precios» → `/admin/stock` (los precios, en la ficha de producto). |

Descartado: una página `/admin/prices` en matriz → separaría «crear SKU →
preciarlo» de la ficha donde se creó, con 4-6 productos la tabla por producto
no escala mal; la matriz de stock sí es propia porque responde a la visión
**por almacén**, que no vive en una ficha de producto.

### D9 — Sin migración, sin reindex, sin ADR

- **Cero migraciones Flyway**: tablas, constraints, índices y datos ya existen
  (V1, V4-V5, V11).
- **Sin reindex**: precios y stock no son texto de catálogo; el reindex
  manual documentado en 7.2 D6 sigue siendo lo único aplicable (nombre/desc).
- **Sin ADR**: mismas capas, mismos DTOs record, misma regla de seguridad de
  ADR-0006 (criterio de 7.1/7.2). Estado en la feature PR (D11 de la 3.3),
  sin PR de documentación de cierre.

---

## 4. Fuera de alcance

- ❌ **CRUD de almacenes ni mercados** — fijos: 2 almacenes, 4 mercados.
- ❌ **Reservar/liberar unidades a mano** (`quantity_reserved`) — sólo el
  checkout (D3).
- ❌ **Histórico de movimientos, ajustes masivos multi-celda, import/export CSV**.
- ❌ **Alertas, stock mínimo, umbrales de reposición**.
- ❌ **Cambios en checkout, reservas, devoluciones o vitrina** — leen igual (D7).
- ❌ **Soft-delete de precios** — se desactiva con `isActive` (D5).
- ❌ **Paginación** — el catálogo nunca pagina (3.1 D10); el panel lo hereda.
- ❌ **7.4** pedidos · **7.5** usuarios · **7.6** dashboard.
- ❌ Endpoints admin bajo `/api/v1/pricing/**` (observación §2.4) — fuera.

---

## 5. Estimación y orden de implementación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | DTOs (`StockMatrixResponse`, `StockUpdateRequest`, `SkuPriceResponse`, `PriceUpdateRequest`) + `StockConflictException` + queries nuevas (`MarketPriceRepository`: todas las filas del SKU con mercado; matriz de stock con joins) | bajo |
| **B** | `AdminStockController` (2 endpoints) + `AdminSkuPriceController` (2) + `AdminStockService`/`AdminPricingService` con upsert, guarda 409 y lock pesimista | medio |
| **C** | Tests backend: service + MockMvc + 3 caminos de seguridad (401/403/200) + **sin ensuciar la BD compartida** | medio |
| **D** | Frontend: types + 4 funciones en `api.ts` (≥99) + `STOCK_CONFLICT` en `errors.ts` | bajo |
| **E** | Frontend: `/admin/stock` (matriz editable) + bloque de precios en la ficha de producto + tarjeta en la portada | medio-alto |
| **F** | Tests frontend: página stock, `AdminSkuPrices`, ficha (mocks declarados), `AdminPage` (cambio declarado), api, errors | medio |
| **G** | CHANGELOG + estado en la PR + `/spec-check` | bajo |

**Baselines que deben seguir verdes** (medidos tras la 7.2): `./mvnw test` →
**225** · `tsc --noEmit` → 0 · ESLint → 0/0 · `npm run test:coverage` →
**340+** y EXIT 0 (umbrales congelados: globales 77/76/74/79 + `api.ts` ≥ 99) ·
`npm run build` → 0 · E2E local (Chromium+WebKit) → **25** en verde ·
`/spec-check` → aprobado.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| **Tests que ensucian la BD compartida** (escrituras de stock/precio sobre el PostgreSQL real de dev/E2E; `CatalogSeedTest` vigila «catálogo = 4») | Tests de escritura con **rollback** (`@Transactional`) o limpieza en `@AfterEach` — regla escrita en la spec (criterio 7.2) |
| Poner disponible < reservado corrompería el invariant en silencio | Guarda **409 `STOCK_CONFLICT`** (D3) + test que la reproduce |
| Carrera `PUT` admin vs `RESERVE` del checkout sobre la misma fila | `PESSIMISTIC_WRITE` reutilizando el repo existente (D4) |
| Carrera de doble insert (upsert) → 500 | `DataIntegrityViolationException` → **409** en ambos upserts (D4) |
| Los cambios «no se ven» en la vitrina | Mismas filas + verificación en navegador obligatoria (D7) |
| `/admin` gana tarjeta → aserciones de `AdminPage.test` | **Cambio declarado** en la spec (R8), con justificación |
| `AdminProductEditPage.test` necesita mocks nuevos (GET de precios) | **Cambio declarado** en la spec (R8) |
| Inputs de la matriz con texto invisible | `text-neutral-900` en todos los inputs (regla de frontend 7) |
| Un precio `discount > base` envenena el cálculo público | Rechazo cross-field en servidor (D5) + espejo en cliente |
