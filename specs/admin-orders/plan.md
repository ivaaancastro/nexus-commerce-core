# Plan — Tarea 7.4: Gestión de pedidos (ver, cambiar estado, tracking)

> **Fase 7 · Panel de administración** · documento de diseño (D1–D9).
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md`.

---

## 1. Objetivo

La 7.3 cerró productos, stock y precios, pero los **pedidos sólo existen para
el usuario que los hizo**: el panel no puede verlos, no puede cambiarles el
estado y nadie registra envíos. Además hay un **hueco real de negocio**: el
checkout incrementa `quantity_reserved`, y **no hay ninguna línea de código que
lo decremente jamás** — un pedido cancelado se queda comiendo ATS para siempre.

**Resultado esperado**: un `ADMIN` (a) **lista todos los pedidos** con filtros y
paginación desde `/admin/orders`, (b) abre el detalle y **cambia el estado** con
una máquina de transiciones válida que además **mueve el stock de forma
coherente** (cancelar libera reservas; enviar descuenta almacén), y (c)
**registra transportista y nº de seguimiento** al enviar, visibles también para
el cliente en su pedido. Un `USER` sigue recibiendo `403`.

---

## 2. Estado real — auditoría previa del repositorio (2026-10-15)

Hecha sobre el código de `main` (tras merge de la 7.3) antes de escribir la spec.

### 2.1 El pedido existe, pero el estado es un dato **congelado**

| Señal | Hallazgo |
|:---|:---|
| `entity/Order.java` | `status: OrderStatus` (`@Enumerated(STRING)`, NOT NULL) + montos `BigDecimal(12,2)`, `shippingAddress`/`paymentMethod` (nulls pre-V10), `user` (LAZY, nullable desde V7), `items` (`@BatchSize(20)`), auditoría `createdAt`/`updatedAt`. **Sin campos de tracking.** |
| `entity/OrderStatus.java` | `PENDING · CONFIRMED · SHIPPED · DELIVERED · CANCELLED`. |
| Único escritor | El checkout pone **`CONFIRMED`** (`OrderService` L139). `PENDING` sólo es el `DEFAULT` de V3 — nadie lo pone nunca. **Nadie cambia el estado después.** |
| Comentario obsoleto | `OrderService` L301 dice «en el checkout el pedido es PENDING» — es falso desde hace tiempo (observación, no se toca). |

### 2.2 El hueco de stock que esta tarea cierra

| Concepto | Hoy |
|:---|:---|
| Reserva | Sólo `InventoryService.reserveStock` **incrementa** `quantity_reserved` (lock `PESSIMISTIC_WRITE`, fila `findBySkuIdAndWarehouseCodeForUpdate`). |
| Liberación | **No existe.** Ni cancelación ni envío ni devolución tocan `stock_items`. |
| Consecuencia | Cada pedido deja su reserva **clavada**; el ATS real del panel queda por debajo de lo vendible. |
| Devoluciones | `ReturnStatus` sólo alcanza `REQUESTED`; el propio enum documenta que el backoffice «no existe» (5.4). |

### 2.3 Infraestructura reutilizable (ya está hecha)

- `OrderRepository` sólo tiene consultas **scoped al usuario**
  (`findByUserIdAndOrderNumber`, `findByUserIdOrderByCreatedAtDesc`) → el
  listado admin es query nueva. El patrón **sin EntityGraph en paginación +
  `@BatchSize`** ya está probado (5.5 §5.9) y evita truncar la colección.
- `OrderResponse` ya trae `returnDeadline` (misma constante que R1 de
  devoluciones) y `OrderItemResponse` trae `returnEligible`/`productName`…
  → el detalle admin puede **reutilizarlos tal cual**.
- `ReturnRepository.findOrderItemIdIn(itemIds)` → el flag «devolución
  solicitada» con **una consulta por página** (patrón 5.5 R10).
- `GlobalExceptionHandler` ya mapea: `409 + code`
  (`CATALOG_CONFLICT`/`STOCK_CONFLICT`), `400 + message`, `404`.
- Frontend: `OrderStatusBadge` (5 estados, paleta neutral), `api.ts` con la
  zona `/api/v1/admin/**` ya montada (7.2/7.3), `errors.ts` traduce
  `STOCK_CONFLICT` → mensaje amigable.

### 2.4 Seguridad ya instalada (7.1, ADR-0006)

`SecurityConfig` L82: `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")`
**antes** de `anyRequest().denyAll()`. Los 4 endpoints nuevos bajo esa raíz
heredan 401/403 **con cero cambios** (mismo argumento que 7.2 D1 y 7.3 D1).

### 2.5 Observación pre-existente (fuera de alcance)

`OrderController.getOrder` (`GET /api/v1/orders/{orderNumber}`) no comprueba
propiedad: cualquier autenticado puede leer un pedido si conoce su número. Es
**anterior** a esta tarea y no se toca aquí; queda apuntada como candidata a
fix aparte.

---

## 3. Decisiones de diseño

### D1 — Todo bajo `/api/v1/admin/**` y hereda la regla 7.1

| Alternativa | Por qué no |
|:---|:---|
| Endpoints en `/api/v1/orders/**` con rol extra | Mezclaría gestión con el flujo de cliente y expondría cambios de estado a la raíz `authenticated()`; tocar `SecurityConfig` para distinguir método/rol. |
| **`/api/v1/admin/orders`** ✅ | Hereda `hasRole("ADMIN")` con **cero cambios en `SecurityConfig`**. La zona de cliente no se toca. |

Endpoints nuevos (4):

| Método | Path | Éxito |
|:---|:---|:---|
| `GET` | `/api/v1/admin/orders` | `200` `AdminOrderPageResponse` (filtros + paginación) |
| `GET` | `/api/v1/admin/orders/{orderNumber}` | `200` `AdminOrderDetailResponse` |
| `PUT` | `/api/v1/admin/orders/{orderNumber}/status` | `200` detalle actualizado |
| `PUT` | `/api/v1/admin/orders/{orderNumber}/tracking` | `200` detalle actualizado |

### D2 — Listado paginado con filtros `status` + `q`, sin N+1

- `page`/`size` (defaults `0`/`20`, igual que el historial de usuario),
  orden **`createdAt DESC`** (determinismo en tests).
- Filtros opcionales: **`status`** (enum exacto) y **`q`** (case-insensitive
  sobre `orderNumber` **o** email del cliente — el panel necesita encontrar un
  pedido por cliente, no sólo por número).
- `user_email` con `LEFT JOIN FETCH` de `user` (to-one: seguro con paginación);
  `items` por `@BatchSize` ya existente. **`returnRequested` con una consulta**
  por página (`findOrderItemIdIn`), patrón 5.5 R10.
- Descartado: `Specification` dinámica (sobreingeniería para 2 filtros) y
  traer los items completos en la lista (la tabla sólo pinta `itemCount`).

### D3 — Máquina de transiciones explícita; **mismo estado → 409**

| Desde | Transiciones permitidas |
|:---|:---|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED` |
| `DELIVERED` | — (terminal) |
| `CANCELLED` | — (terminal, irreversible) |

- Fuera de tabla → **`409` `code: ORDER_CONFLICT`** con mensaje en español
  (excepción nueva `OrderStateConflictException`, patrón
  `StockConflictException`).
- **Mismo estado → también `409`** («el pedido ya está ENVIADO»): es la guarda
  que impide el **doble clic = doble descuento de stock**. No se usa
  `Idempotency-Key` (esa regla 4.3 es del checkout).
- Sin transiciones inversas: reabrir un cancelado exigiría **re-reservar** con
  las mismas garantías que el checkout; entregar sin enviar rompería el
  relato de tracking. Ambas, fuera de alcance.

### D4 — Efectos en stock: **cancelar libera, enviar descuenta**

| Transición | Efecto en `stock_items` (por cada `OrderItem`) |
|:---|:---|
| → `CANCELLED` | `quantityReserved = max(0, reserved − quantity)` → la reserva vuelve a estar vendible. Fila ausente → `log.warn` y **continúa**: una cancelación **nunca** falla por stock. |
| → `SHIPPED` | Guarda: fila existe y `available ≥ quantity`, si no → **`409 STOCK_CONFLICT`** (el estado **no** cambia: rollback completo). Si OK: `available −= quantity` **y** `reserved = max(0, reserved − quantity)` — la mercancía sale del almacén y la reserva se consume. |
| → `CONFIRMED` / → `DELIVERED` | **Cero** movimientos de stock. |

- **Lock de orden**: el método arranca con `findByOrderNumberForUpdate`
  (`PESSIMISTIC_WRITE`, query nueva en `OrderRepository`) → dos «enviar»
  concurrentes se serializan; el segundo ve el estado ya cambiado y recibe el
  `409` de D3. Después, las filas de stock con el
  `findBySkuIdAndWarehouseCodeForUpdate` **ya existente**.
- **Orden de locks** (sin deadlocks): admin = `order → stock rows`; checkout =
  `stock rows → inserción de orden nueva` (sin lock de fila ajena). No hay
  ciclo.
- **Una única transacción** (`@Transactional` en `AdminOrderService`): estado +
  todo el stock se confirman o revierten juntos.
- Los movimientos viven en **`InventoryService`** (métodos nuevos
  `releaseReservedStock`/`shipStock`): la lógica de stock queda en su servicio
  (regla 4.2), llamados desde `AdminOrderService` dentro de la misma
  transacción.
- El `max(0, …)` es **defensivo y documentado**: los E2E restauran el stock a
  los valores de V1 y podrían dejar `reserved = 0` con pedidos vivos; liberar
  debe poder bajar a 0 sin reventar, y subir `reserved` por encima de lo
  físico nunca es un riesgo de over-selling (el riesgo es al revés).

### D5 — Tracking: migración `V14` + dos `PUT` con roles distintos

- **`V14__order_tracking.sql`**: `carrier VARCHAR(64)` y
  `tracking_number VARCHAR(64)` **nullable** (sin default — el dato sólo existe
  si alguien lo registra) + `idx_orders_status` y `idx_orders_created_at`
  (la lista filtra por estado y ordena por fecha).
- **`OrderResponse` gana `carrier`/`trackingNumber`** (nullables) → el
  **cliente también los ve** en su pedido: el tracking que el admin registra es
  exactamente lo que el comprador necesita.
- **`PUT /status` sólo lleva `{status}`** y **`PUT /tracking` lleva
  `{carrier?, trackingNumber?}`** (full-replace: vacío/ausente → `null`,
  sirve para limpiar; `@Size(max=64)`).
  - Descartado: meter tracking en el body de cambio de estado → ramas
    «sólo si es SHIPPED», y el envío con tracking quedaría en **2 peticiones
    encadenadas desde la UI** (estado primero, tracking después; si la segunda
    falla, se reintenta sin repetir el estado — recuperable y backend simple).
  - El `PUT /tracking` es editable **en cualquier estado**: es metadato puro,
    sin efectos; un nº mal escrito se corrige sin tocar la máquina.
- **`AdminOrderDetailResponse` compone `OrderResponse`** (que ya lleva
  tracking) + `userEmail` + `returnRequested` → cero duplicación de campos.

### D6 — DTOs nuevos para admin; **entidades jamás expuestas**

- `AdminOrderSummaryResponse` (fila de tabla: nº, estado, mercado, moneda,
  total, fecha, `userEmail`, `itemCount`, `carrier`, `trackingNumber`,
  `returnRequested`), `AdminOrderPageResponse`, `AdminOrderDetailResponse`,
  `AdminOrderStatusRequest` (`@NotNull status`), `AdminOrderTrackingRequest`.
- `userEmail` **nullable**: hay pedidos con `user_id` NULL (V7 lo permite).

### D7 — Flujo de cliente y vitrina **intocados**

- El checkout **sigue creando `CONFIRMED`**; `ReturnService`,
  `ReturnEligibilityService` y el historial de usuario **sin cambios**: R2 de
  devoluciones (sólo `DELIVERED` es devolvible) ya funciona con la máquina
  nueva, y el flag `returnRequested` del panel es **informativo** (sin
  botones de resolución — decisión del usuario: devoluciones fuera de 7.4).
- El estado «se ve» en el cliente porque `OrderResponse` lo trae ya; sin
  cachés ni polling (`cache: "no-store"`, al abrir la página).

### D8 — UX: `/admin/orders` (lista) + `/admin/orders/[orderNumber]` (detalle)

| Superficie | Contenido |
|:---|:---|
| **`/admin/orders`** (nueva) | Tabla: nº (enlace al detalle), fecha, cliente, mercado, total, `OrderStatusBadge`, nº de piezas, badge «Devolución solicitada». Filtros: **select de estado** (Todos + 5) y **búsqueda** por nº/cliente. Paginación anterior/siguiente con nº de página. Estados carga/error con «Reintentar»/vacío. |
| **Detalle** (nueva) | Cabecera nº + badge · datos de cliente (email, dirección, pago) · líneas con desglose fiscal (reutiliza `OrderItemResponse`) · **panel de estado**: sólo los botones de transiciones permitidas (espejo de D3 en TS), `window.confirm` en **CANCELLED** (irreversible: libera stock y no se puede deshacer), toast de éxito · **bloque tracking** editable («Guardar seguimiento») · flag devolución. |
| **Subnavegación** | `SECCIONES` de `layout.tsx` gana **«Pedidos»** y, por coherencia, **«Stock»** (hoy `/admin/stock` sólo se alcanza desde la portada — incoherencia menor de la 7.3 que se arregla de paso). |
| **Portada `/admin`** | Tarjeta **«Pedidos»** → `/admin/orders`; el aviso honesto queda sólo para **7.5–7.6**. |

Tras «Marcar como enviado» la UI encadena `PUT /status` → `PUT /tracking` si
hay campos de seguimiento (D5), mostrando el fallo del paso que corresponda.

### D9 — Sin ADR, sin E2E nuevos, sin PR de documentación de cierre

- **Sin ADR**: mismas capas, mismos records, misma regla de seguridad de
  ADR-0006 (criterio de 7.1/7.2/7.3). Estado en la feature PR (D11 de la 3.3).
- **Sin rutas nuevas en `a11y.spec.ts`** (las 14 se quedan intactas — mismo
  criterio que 7.3 R6.6: exigiría login ADMIN en E2E; se cubre con tests de
  componente) **y sin E2E nuevos** (precedente 7.2/7.3).
- La **única migración** de la tarea es V14 (D5); nada de reindex (los pedidos
  no son texto de catálogo).

---

## 4. Fuera de alcance

- ❌ **Backoffice de devoluciones** (`REQUESTED → REJECTED/REFUNDED`) — decisión
  del usuario; el panel sólo **muestra** el flag (D7).
- ❌ **Notificaciones email** de cambio de estado (existe `EmailService`, no se
  amplía).
- ❌ **Transiciones inversas**: reabrir cancelado, corregir hacia atrás
  (D3) · editar items/precios/dirección de un pedido existente.
- ❌ **Filtros por fecha/mercado, ordenación configurable, export CSV** — sólo
  `status` + `q` (D2).
- ❌ **Paginación infinita / auto-refresh / polling** de estados.
- ❌ **Uso de `PENDING`**: se conserva en la máquina por completitud, pero
  nadie lo crea (2.1).
- ❌ El IDOR observado en `GET /api/v1/orders/{orderNumber}` (2.5) — fix
  aparte.
- ❌ **7.5** usuarios · **7.6** dashboard · notificaciones · reembolsos.

---

## 5. Estimación y orden de implementación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | `V14__order_tracking.sql` + campos en `Order` + `OrderResponse` (+2) + DTOs admin (5) + `OrderStateConflictException` + handler | bajo |
| **B** | `OrderRepository` (query lista con filtros + `findByOrderNumberForUpdate`) + `InventoryService` (`releaseReservedStock`/`shipStock`) + `AdminOrderService` (listar/detalle/cambiarEstado/tracking) + `AdminOrderController` (4 endpoints) | medio-alto |
| **C** | Tests backend: máquina de transiciones + efectos de stock (liberar/descontar/409/guardas) + MockMvc (éxitos + 409/404/400) + seguridad 401/403/200 + constructores `OrderResponse` actualizados; **BD compartida limpia** | medio-alto |
| **D** | Frontend: types + 4 funciones en `api.ts` (≥99) + `ORDER_CONFLICT` en `errors.ts` | bajo |
| **E** | Frontend admin: `/admin/orders` (lista+filtros+paginación), `/admin/orders/[orderNumber]` (detalle+estado+tracking), subnavegación, tarjeta de portada | medio-alto |
| **F** | Frontend cliente: `Order` (+2) + bloque de seguimiento en `/orders/[orderNumber]` | bajo |
| **G** | Tests frontend: 2 páginas admin, api, cambios declarados (`AdminPage`, `AdminLayout`, fixtures de `Order`) | medio |
| **H** | CHANGELOG + bloque ESTADO ACTUAL en la PR + `MEMORY.md` + `/spec-check` | bajo |

**Baselines que deben seguir verdes** (medidos tras la 7.3): `./mvnw test` →
**249** · `tsc --noEmit` → 0 · ESLint → 0/0 · `npm run test:coverage` → **359+**
y EXIT 0 (umbrales congelados: globales 77/76/74/79 + `api.ts` ≥ 99) ·
`npm run build` → 0 · E2E local (Chromium+WebKit) → **36 passed + 14 skipped** ·
CI 4/4 · `/spec-check` → aprobado.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| Doble clic en «Enviar» → **doble descuento** de stock | Mismo estado → `409` (D3) **+** lock de fila de pedido (D4) + test que lo reproduce |
| Transición inválida corrige mal un pedido | Tabla explícita en servidor; el espejo TS de la UI es sólamente presentación (la API manda) — `409 ORDER_CONFLICT` con mensaje |
| Cancelar libera **dos veces** o libera pedidos ajenos | `CANCELLED` es terminal (sólo se entra una vez) + `max(0,…)` defensivo (D4) |
| Enviar con `available < quantity` corrompe el invariant | `409 STOCK_CONFLICT` con rollback total (el estado no cambia) — ya traducible en frontend |
| Tests que ensucian la BD compartida (pedidos/stock sembrados; `CatalogSeedTest` vigila el catálogo) | Tests con **pedidos y stock propios** (patrón `7401/001`) + limpieza en `@Before`/`@After`; nunca tocar sembrados |
| `OrderResponse` gana 2 campos → constructores de test | **Cambio declarado** en R8 de la spec (aridad, sin tocar aserciones) |
| `/admin` gana tarjeta y aviso **7.4–7.6 → 7.5–7.6** | `AdminPage.test` **cambio declarado** (3.ª vez, precedente 7.2/7.3) |
| `SECCIONES` gana 2 entradas | `AdminLayout.test`: aserciones existentes intactas (sólo aditivas) |
| Deadlock admin vs checkout | Orden de locks fijado y documentado (D4): `order → stock` vs `stock → insert` |
| El cliente no ve el cambio hecho en el panel | Mismas filas + `OrderResponse` con estado/tracking + verificación en navegador obligatoria (D7) |
| Inputs de búsqueda/filtros con texto invisible | `text-neutral-900` en todos los inputs (regla de frontend 7) |
