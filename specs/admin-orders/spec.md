# Spec — Tarea 7.4: Gestión de pedidos (ver, cambiar estado, tracking)

> **Fase 7 · Panel de administración** · requisitos (R1–R8) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D9) · checklist en `tasks.md`.
> **Estado**: ✅ APROBADA (2026-10-15, por el usuario) · **Fecha**: 2026-10-15

---

## Resumen

El panel gana la gestión de **pedidos**: listado global con filtros, detalle
completo, **cambio de estado con máquina de transiciones** que además mueve el
stock de forma coherente, y **tracking** (transportista + nº de seguimiento)
visible también para el cliente.

- **4 endpoints** bajo `/api/v1/admin/**` — heredan `hasRole("ADMIN")`
  **sin tocar `SecurityConfig`** (plan D1).
- **Listado paginado** con filtros `status` + `q` (nº de pedido o email del
  cliente), sin N+1, `returnRequested` con una consulta por página (plan D2).
- **Máquina de transiciones** explícita; transición inválida **o repetida →
  `409 ORDER_CONFLICT`** (plan D3).
- **Efectos de stock**: cancelar **libera** reservas · enviar **descuenta**
  disponible y consume la reserva (bajo `PESSIMISTIC_WRITE`, transaccional);
  sin cambios en `DELIVERED`/`CONFIRMED` (plan D4).
- **Tracking**: migración **`V14`** (`carrier`, `tracking_number`) + `PUT
  /tracking` independiente del estado (plan D5).
- **Cliente incluido**: `OrderResponse` gana `carrier`/`trackingNumber` → el
  comprador ve el seguimiento en su pedido (plan D5/D7).
- Frontend: **`/admin/orders`** (lista) + **`/admin/orders/[orderNumber]`**
  (detalle con acciones y tracking) + subnavegación y portada (plan D8).
- **Sin ADR, sin E2E/a11y nuevos** (plan D9); única migración: `V14`.

---

## R1 — API de listado bajo `/api/v1/admin/orders`

**Criterio**: el ADMIN lista **todos** los pedidos del sistema, filtrado y
paginado; nadie más puede.

| Método y ruta | Éxito | Parámetros |
|:--|:--|:--|
| `GET /api/v1/admin/orders` | `200` `AdminOrderPageResponse` | `page` (def. `0`), `size` (def. `20`), `status?`, `q?` |

```jsonc
// AdminOrderPageResponse
{
  "orders": [{
    "id": 7, "orderNumber": "ORD-…", "status": "CONFIRMED",
    "marketCode": "ES", "currency": "EUR", "totalAmount": 179.98,
    "createdAt": "2026-10-15T10:00:00Z",
    "userEmail": "cliente@ejemplo.com",   // null si user_id IS NULL
    "itemCount": 2,
    "carrier": null, "trackingNumber": null,
    "returnRequested": false
  }],
  "page": 0, "size": 20, "totalElements": 41, "totalPages": 3
}
```

**Criterios de aceptación**

1. Devuelve **todos los pedidos** (de todos los usuarios y con `user_id`
   NULL), orden **`createdAt DESC`** (determinismo en tests).
2. Filtros opcionales combinables: `status` (enum exacto — valor desconocido →
   `400`) y `q` (case-insensitive, contiene, sobre **`orderNumber` o
   `user.email`**); sin parámetros la respuesta es el listado completo
   paginado.
3. Paginación con los mismos defaults que el historial de usuario
   (`page=0`, `size=20`); respuesta con `totalElements`/`totalPages`.
4. **Sin N+1**: `user` con `LEFT JOIN FETCH`, items por `@BatchSize` (patrón
   5.5) — un listado de 20 no dispara 20+ consultas de cabeceras (verificable
   con log de Hibernate en test de service).
5. `returnRequested` se resuelve con **una única consulta** por página
   (`findOrderItemIdIn`), patrón 5.5 R10.
6. Lista vacía (sin pedidos o sin resultados del filtro) → `200` con
   `orders: []`.

## R2 — API de detalle admin

**Criterio**: el detalle admin muestra el pedido completo **más** lo que el
usuario no ve: email del cliente y si tiene devolución solicitada.

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `GET /api/v1/admin/orders/{orderNumber}` | `200` `AdminOrderDetailResponse` | — |

```jsonc
// AdminOrderDetailResponse (compone; plan D5/D6)
{
  "order": { /* OrderResponse COMPLETO: estado, montos BigDecimal, items
                con returnEligible, shippingAddress, paymentMethod,
                returnDeadline, carrier, trackingNumber … */ },
  "userEmail": "cliente@ejemplo.com",   // null si user_id IS NULL
  "returnRequested": true                // alguna línea con devolución (R10 de 5.5)
}
```

**Criterios de aceptación**

1. Devuelve **cualquier pedido** por `orderNumber`, sin comprobar propiedad
   (es la zona admin).
2. `orderNumber` inexistente → **`404`**.
3. `returnRequested` = `true` si **alguna línea** tiene una fila en
   `product_returns` (una consulta, no una por línea).
4. Las entidades `Order`/`OrderItem` **jamás** se exponen: sólo records
   (regla 4.4). Se reutilizan `OrderResponse` y `OrderItemResponse`
   existentes tal cual.

## R3 — Cambio de estado con máquina de transiciones

**Criterio**: el estado sólo avanza por transiciones válidas; el servidor es
la única autoridad (el espejo TS de la UI es presentación).

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `PUT /api/v1/admin/orders/{orderNumber}/status` | `200` `AdminOrderDetailResponse` (actualizado) | `{ "status": "SHIPPED" }` |

**Máquina** (plan D3):

| Desde | Permitido hacia |
|:---|:---|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED` |
| `DELIVERED` | — (terminal) |
| `CANCELLED` | — (terminal) |

**Criterios de aceptación**

1. Transición **fuera de la tabla** → **`409`** con `code: "ORDER_CONFLICT"`,
   `message` en español que indica el estado actual y hacia dónde sí se puede
   mover, y excepción nueva **`OrderStateConflictException`** (mismo patrón de
   `StockConflictException` en `GlobalExceptionHandler`).
2. **Mismo estado** (p. ej. `SHIPPED → SHIPPED`) → también **`409
   ORDER_CONFLICT»** — es la guarda contra doble clic/doble efecto (plan D3).
3. `status` ausente o valor no perteneciente al enum → **`400`** con `message`.
4. Pedido inexistente → **`404`**.
5. Éxito → **`200`** con el detalle **actualizado** (la UI se refresca con la
   propia respuesta, sin re-fetch — criterio heredado de 7.3).
6. Dos `PUT` concurrentes sobre el mismo pedido → se **serializan** con
   `findByOrderNumberForUpdate` (`PESSIMISTIC_WRITE`): uno aplica, el otro
   recibe `409`; **nunca** dos aplicaciones (test de servicio que lo cubra).
7. `updatedAt` del pedido se actualiza al cambiar el estado (`@UpdateTimestamp`
   ya existente).

## R4 — Efectos de stock en cancelación y envío

**Criterio**: cambiar el estado deja el inventario **coherente**: lo cancelado
vuelve a estar vendible, lo enviado sale del almacén; el ATS del panel de la
7.3 miente nunca.

**Criterios de aceptación** (por cada `OrderItem`, dentro de la **misma
transacción** que el cambio de estado — regla 4.2):

1. **→ `CANCELLED`**: `quantityReserved = max(0, reserved − quantity)` con
   `findBySkuIdAndWarehouseCodeForUpdate` (**`PESSIMISTIC_WRITE`**). La celda
   de la matriz `/admin/stock` y el ATS público `GET /inventory/skus/{id}`
   reflejan la liberación **sin reiniciar nada**.
2. **→ `CANCELLED` con fila de stock ausente** → `log.warn` y **sigue**: la
   cancelación se completa (`200`); nunca falla por stock (plan D4).
3. **→ `SHIPPED`**: fila ausente o `available < quantity` → **`409`
   STOCK_CONFLICT`** y **rollback completo** (el estado **no** cambia a
   `SHIPPED`). Si OK: `available −= quantity` **y**
   `reserved = max(0, reserved − quantity)` (la reserva se consume al salir la
   mercancía).
4. **→ `SHIPPED` con éxito**: el neto público baja exactamente `quantity`
   unidades respecto al estado previo (la reserva ya las excluía; ahora salen
   del disponible) — verificable con `GET /api/v1/inventory/skus/{id}` antes y
   después.
5. **→ `CONFIRMED` o → `DELIVERED`**: **cero** movimientos de `stock_items`
   (los valores quedan idénticos byte a byte).
6. Escritura de stock **sólo** vía los métodos nuevos de `InventoryService`
   (`releaseReservedStock`/`shipStock`); `reserveStock` **sin cambios** (los
   E2E del checkout siguen en verde).
7. `AdminStockService` y la matriz de la 7.3 **sin cambios** (leen las mismas
   filas).

## R5 — Tracking: migración V14 y edición independiente

**Criterio**: registrar quién lleva el paquete y su nº de seguimiento, y que
el cliente lo vea.

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `PUT /api/v1/admin/orders/{orderNumber}/tracking` | `200` `AdminOrderDetailResponse` | `{ "carrier": "SEUR", "trackingNumber": "123456789" }` |

**Modelo de datos** — `V14__order_tracking.sql`:

```sql
ALTER TABLE orders ADD COLUMN carrier VARCHAR(64);
ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
```

**Criterios de aceptación**

1. Migración `V14` con las **2 columnas nullable** (sin default: el dato sólo
   existe si se registra) y los **2 índices** que la lista R1 filtra/ordena.
   Reejecutable (`IF NOT EXISTS` donde aplique), estilo V13.
2. `PUT /tracking` es **full-replace**: campos ausentes o vacíos → `null`
   (limpia el dato); `@Size(max = 64)` por campo → `400` si se excede.
3. Editable **en cualquier estado** (incluido `CANCELLED`): es metadato sin
   efectos; un nº mal escrito no exige tocar la máquina (plan D5).
4. Pedido inexistente → `404`. Éxito → `200` con el detalle actualizado.
5. **`OrderResponse` gana `carrier` y `trackingNumber`** (nullable) →
   `GET /api/v1/orders/{orderNumber}` y el historial de usuario los traen ya;
   **`Order` (TS) los refleja** y la página `/orders/[orderNumber]` pinta un
   **bloque de seguimiento** cuando `carrier` o `trackingNumber` no sean
   `null` («Transportista · Nº de seguimiento»), junto al estado.
6. Las respuestas **previas a V14** (pedidos viejos) devuelven `null` en ambos
   campos → el bloque no se pinta (mismo criterio que `shippingAddress` null
   pre-V10).
7. El flujo de envío desde el detalle admin encadena `PUT /status` y, si hay
   datos de seguimiento, `PUT /tracking`; si la segunda falla, el estado ya
   quedó aplicado y **se permite reintentar sólo el tracking** (plan D5).

## R6 — Seguridad heredada, sin reglas nuevas

**Criterio**: la protección de los 4 endpoints es la misma regla de la 7.1.

**Criterios de aceptación**

1. Los 4 endpoints responden **`401`** sin token, **`403`** con rol `USER`
   (`e2e@nexus.dev`) y **`200`** con rol `ADMIN`.
2. `git diff` de la rama: **`SecurityConfig.java` sin cambios** — la
   protección viene de `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")`
   (ADR-0006).
3. Ningún endpoint nuevo vive fuera de la raíz admin (la zona de cliente
   `/api/v1/orders/**` y `/api/v1/users/me/orders/**` no gana métodos).

## R7 — Frontend: lista `/admin/orders`

**Criterio**: el ADMIN encuentra cualquier pedido en dos gestiones.

**Criterios de aceptación**

1. Ruta `/admin/orders` dentro de `app/admin/layout.tsx` (protegida por
   `AdminRoute`: `USER` → `/`); enlace en la **subnavegación** (`SECCIONES`
   gana «Pedidos» y «Stock») y **tarjeta «Pedidos»** en la portada (el aviso
   honesto queda para 7.5–7.6).
2. Tabla con: nº de pedido (enlace al detalle), fecha, cliente (`userEmail` o
   «—» si es `null`), mercado, total, `OrderStatusBadge`, nº de piezas y badge
   «Devolución solicitada» cuando aplique.
3. Filtros: **select de estado** (Todos + los 5) y **campo de búsqueda**
   (nº o cliente, `text-neutral-900`, label/aria-label) → re-fetch con los
   query params; paginación **anterior/siguiente** con nº de página (usa
   `totalPages`).
4. Estados: **cargando** (sin flash de filas vacías), **error de red**
   traducido con «Reintentar», **lista vacía** (0 pedidos o 0 resultados del
   filtro) con mensaje editorial.
5. `401`/`403` → comportamiento de la sesión admin ya existente (la puerta
   `AdminRoute` redirige antes; la API sigue siendo la puerta de verdad).
6. `api.ts` gana `getAdminOrders(params)` (con token, `cache: "no-store"`,
   umbral del fichero ≥99 preservado).

## R8 — Frontend: detalle `/admin/orders/[orderNumber]`

**Criterio**: desde una fila se ve todo el pedido y se actúa sobre él con
feedback claro y errores amigables.

**Criterios de aceptación**

1. Cabecera: nº de pedido + `OrderStatusBadge` + fecha. Secciones: cliente
   (email), dirección de envío y método de pago (tolerando `null` pre-V10),
   **líneas con desglose fiscal** (producto, talla/color, cantidad, unitario,
   IVA, total) y totales (`BigDecimal` pintado tal cual lo manda el backend).
2. **Panel de estado** con **sólo** los botones de las transiciones permitidas
   (espejo TS de la máquina D3; si el servidor rechaza, manda el `409`):
   - `CANCELLED` exige **`window.confirm`** (irreversible: libera stock) —
     mismo criterio que el borrado de productos de la 7.2.
   - Éxito → **toast** «Estado actualizado» y panel refrescado con la propia
     respuesta del `PUT` (sin re-fetch).
   - `409 ORDER_CONFLICT` → mensaje amigable vía `getFriendlyErrorMessage()`
     (muestra el `message` del servidor); `409 STOCK_CONFLICT` (envío con
     stock insuficiente) → también amigable; `400` → `message`; `404` →
     «Pedido no encontrado».
3. **Bloque tracking**: inputs «Transportista» y «Nº de seguimiento»
   (`text-neutral-900`, `@size` espejo ≤64) + **«Guardar seguimiento»**
   habilitado sólo si cambió → toast «Seguimiento guardado»; vacío = limpiar.
4. **Flag «Devolución solicitada»** visible cuando `returnRequested` —
   **sin** botones de resolución (fuera de alcance, decisión del usuario).
5. Estados de la página: cargando, error de red traducido con reintentar,
   `404` (pedido borrado/erróneo) con enlace de vuelta a la lista.
6. `api.ts` gana `getAdminOrder(orderNumber)`, `updateAdminOrderStatus(...)` y
   `updateAdminOrderTracking(...)`; `errors.ts` traduce `ORDER_CONFLICT`
   (mismo mecanismo que `STOCK_CONFLICT`) y conserva
   `getFriendlyErrorMessage()` como puerta única.

## R9 — Tests y documentación

**Criterio**: la feature se prueba entera y deja el repositorio en verde.

**Criterios de aceptación**

1. **Backend**: service con la **máquina completa** (todas las transiciones
   válidas, todas las inválidas → 409, mismo estado → 409), **efectos de stock**
   (cancelar libera; enviar descuenta; fila ausente → cancelación ok;
   `available < quantity` → 409 con estado intacto; `CONFIRMED`/`DELIVERED` sin
   movimiento), `PUT /tracking` (replace, limpieza, `@Size` → 400), MockMvc de
   los 4 endpoints (éxitos + 404/400/409) y seguridad `401`/`403`/`200`.
2. **Los tests de escritura no ensucian la BD compartida**: pedidos y filas de
   **stock propios** (clave fija `7401/001`) con limpieza en
   `@Before`/`@After` — nunca se modifica un pedido o stock **sembrado**
   (`CatalogSeedTest`, `MarketPriceSeedTest` y los E2E siguen en verde; los
   E2E restauran stock a V1, por eso los tests deben ser autónomos).
3. **Frontend**: lista (render con filtros, búsqueda, paginación, vacío/error),
   detalle (transiciones mostradas según estado, `confirm` en cancelar,
   `409 ORDER_CONFLICT` amigable, tracking guardar/limpiar, `404`), bloque de
   seguimiento **del cliente** en `/orders/[orderNumber]`, y las **4 funciones
   nuevas** de `api.ts` (umbral ≥99).
4. **R8 del proyecto**: ningún test preexistente cambia su aserción **salvo
   los cambios declarados**:
   - `OrderControllerTest` / `UserOrderControllerTest` (backend): los
     constructores de `OrderResponse` ganan `carrier`/`trackingNumber`
     (**aridad, sin tocar aserciones**).
   - `AdminPage.test` (frontend): la portada gana la tarjeta «Pedidos» y el
     aviso pasa de 7.4–7.6 a **7.5–7.6** (3.ª vez, precedente 7.2/7.3).
   - `AdminLayout.test`: **sólo aditivas** (las aserciones de «Panel»/
     «Productos» existentes se conservan intactas).
   - `OrderDetailPage.test` / fixtures `Order`: añaden `carrier`/
     `trackingNumber` en `null` (aridad/tipo; aserciones intactas) salvo el
     test nuevo del bloque de seguimiento.
5. Verificación **en navegador** obligatoria: cambiar estado desde el panel y
   verlo en el pedido del cliente · cancelar y ver la liberación en
   `/admin/stock` y en `GET /inventory` · registrar tracking y verlo en
   `/orders/[orderNumber]` · `USER` redirigido de `/admin/orders`.
6. `CHANGELOG.md` en es-ES · bloque «ESTADO ACTUAL» de `AGENTS.md` dentro de
   la feature PR (verdad tras el merge, sin PR/SHA) · **`MEMORY.md` refrescado
   en esta PR** (tabla «Rama actual» quedó con la verdad pre-merge de la 7.3) ·
   **sin ADR** (plan D9) · **sin PR de documentación de cierre** (plan D9).
