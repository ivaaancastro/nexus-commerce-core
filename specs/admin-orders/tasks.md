# Tasks — Tarea 7.4: Gestión de pedidos (ver, cambiar estado, tracking)

> **Fase 7 · Panel de administración** · spec `spec.md` (R1–R9) · plan `plan.md` (D1–D9).
> Un checkbox por unidad terminada; las decisiones y hallazgos quedan como nota
> debajo de su bloque. **Regla**: marcar al completar; nada de código fuera de
> este checklist.

---

## A — Migración V14, entidad, DTOs y excepción (R3, R5, plan D3/D5/D6)

- [x] **A.1** `V14__order_tracking.sql`: `ALTER TABLE orders ADD COLUMN carrier VARCHAR(64)` + `tracking_number VARCHAR(64)` (nullable, sin default) + `idx_orders_status` + `idx_orders_created_at` con `IF NOT EXISTS` (estilo V13, reejecutable)
- [x] **A.2** `Order.java` gana `carrier` y `trackingNumber` (nullable, `@Column(length = 64)`) con Javadoc de la 7.4
- [x] **A.3** `OrderResponse` gana `carrier` y `trackingNumber` (nullable) + `OrderService.mapToOrderResponse` los rellena (R5.5)
- [x] **A.4** DTOs admin: `AdminOrderSummaryResponse` (id, orderNumber, status, marketCode, currency, totalAmount, createdAt, userEmail **nullable**, itemCount, carrier, trackingNumber, returnRequested) · `AdminOrderPageResponse` (orders, page, size, totalElements, totalPages) · `AdminOrderDetailResponse` (**compone** `OrderResponse` + userEmail + returnRequested) · `AdminOrderStatusRequest` (`@NotNull status`) · `AdminOrderTrackingRequest` (`@Size(max=64)` por campo, ambos opcionales)
- [x] **A.5** Excepción `OrderStateConflictException` + handler en `GlobalExceptionHandler` → `409` con `code: "ORDER_CONFLICT"` y mensaje en español (patrón `StockConflictException`)
- [x] **A.6** `SecurityConfig` **sin ningún cambio** (verificado por diff vacío, plan D1)

## B — Repositorios, servicios y controllers (R1–R5, plan D1/D2/D3/D4/D5)

- [x] **B.1** `OrderRepository`: query de **listado admin** (todos los pedidos, `LEFT JOIN FETCH user`, filtros opcionales `status` + `q` sobre `orderNumber`/`user.email`, `ORDER BY createdAt DESC`, `Pageable`) con `LEFT JOIN FETCH user` + `countQuery` explícito (to-one: seguro con paginación), **sin EntityGraph de colección** (items por `@BatchSize`, patrón 5.5) + `findByOrderNumberForUpdate` con `@Lock(PESSIMISTIC_WRITE)` (R3.6)
- [x] **B.2** `InventoryService` gana `releaseReservedStock(skuId, warehouseCode, quantity)` (lock `findBySkuIdAndWarehouseCodeForUpdate`, `reserved = max(0, reserved − qty)`, fila ausente → `log.warn` y continúa) y `shipStock(skuId, warehouseCode, quantity)` (fila ausente o `available < qty` → `StockConflictException` → `409`; si OK: `available −= qty` y `reserved = max(0, reserved − qty)`) — `reserveStock` **sin cambios** (R4.1–R4.3, R4.6)
- [x] **B.3** `AdminOrderService.listar(page, size, status, q)`: `400` si `status` no es enum válido · una consulta `findOrderItemIdIn` para `returnRequested` de la página (patrón 5.5 R10) · respuesta paginada (R1.1–R1.6)
- [x] **B.4** `AdminOrderService.detalle(orderNumber)`: `404` si no existe · `returnRequested` con una consulta · compone `AdminOrderDetailResponse` (R2.1–R2.4)
- [x] **B.5** `AdminOrderService.cambiarEstado(orderNumber, status)`: `404` · lock `findByOrderNumberForUpdate` **primero** · máquina de transiciones (tabla D3) → fuera de tabla o mismo estado → `409 ORDER_CONFLICT` · efectos de stock **en la misma transacción**: →`CANCELLED` libera por línea · →`SHIPPED` descuenta con guarda `409 STOCK_CONFLICT` (rollback: el estado no cambia) · →`CONFIRMED`/→`DELIVERED` sin movimiento · devuelve el detalle actualizado (R3.1–R3.7, R4.1–R4.5)
- [x] **B.6** `AdminOrderService.actualizarTracking(orderNumber, request)`: `404` · full-replace (vacío/ausente → `null`) · cualquier estado · devuelve el detalle actualizado (R5.2–R5.4)
- [x] **B.7** `AdminOrderController` con los 4 endpoints (`GET /api/v1/admin/orders`, `GET/PUT .../{orderNumber}`) bajo `@RequestMapping("/api/v1/admin/orders")`, `@Tag`/`@Operation` en español, `@Valid` en los bodies (R1, R2, R3, R5)
- [x] **B.8** Cero cambios en `OrderController`, `UserOrderController`, `OrderService.listOrders/getOrderForUser`, `ReturnService` y `ReturnEligibilityService` (R6.3, plan D7) — verificado por diff vacío; única tangencia: `mapToOrderResponse` pasa a package-visible para reuso del panel

## C — Tests backend (R9.1, R9.2)

- [x] **C.1** `AdminOrderServiceTest` (máquina): todas las transiciones válidas de la tabla → `200` con estado nuevo · todas las inválidas (incl. `DELIVERED→*`, `CANCELLED→*`, saltos como `CONFIRMED→DELIVERED`) → `409 ORDER_CONFLICT` · mismo estado → `409` · pedido inexistente → `404`
- [x] **C.2** `AdminOrderServiceTest` (stock): cancelar libera `reserved` exactamente `quantity` (y con reserva 0 → queda 0, no negativo) · cancelar con fila de stock ausente → `200` (no falla) · enviar descuenta `available` y `reserved` · enviar con `available < quantity` → `409 STOCK_CONFLICT` **y el estado sigue sin cambiar** · `CONFIRMED`/`DELIVERED` → filas de stock intactas
- [x] **C.3** `AdminOrderServiceTest` (lista/detalle): página con `totalElements`/`totalPages` · filtro `status` · filtro `q` por nº y por email (case-insensitive) · pedido con `user_id NULL` → `userEmail: null` · `returnRequested` en detalle y lista · lista vacía → `orders: []`
- [x] **C.4** `AdminOrderTrackingTest` (integrado en service + controller): full-replace con campos vacíos → `null` · `@Size(64)` excedido → `400` · cualquier estado editable · `404`
- [x] **C.5** `AdminOrderControllerTest` (MockMvc `@SpringBootTest`, patrón `AdminStockControllerTest`): éxitos de los 4 endpoints con JSON assertions · `404` · `400` (status ausente/inválido, size excedido) · `409 ORDER_CONFLICT` con `code` · `409 STOCK_CONFLICT` en envío sin stock · **seguridad** `401` sin token / `403` USER / `200` ADMIN
- [x] **C.6** **BD compartida limpia**: pedidos y filas de stock **propios** (clave `7401/001`, patrón 7.3 C.5) con limpieza en `@Before` **y** `@After`; nunca se modifica un pedido o stock sembrado — `CatalogSeedTest`/`MarketPriceSeedTest` y E2E sin restos
- [x] **C.7** `./mvnw test` en verde con la suite completa (**287 = 249 + 38**: +22 controller, +10 service, +6 InventoryService); constructores de `OrderResponse` en tests existentes actualizados por aridad (cambio declarado R9.4, **aserciones intactas**)

## D — Frontend: tipos, cliente y errores (R7.6, R8.6)

- [x] **D.1** `types/commerce.ts`: `Order` gana `carrier: string | null` y `trackingNumber: string | null` (espejo A.3) + `AdminOrderSummary`, `AdminOrderPage`, `AdminOrderDetail`, `AdminOrderStatusData`, `AdminOrderTrackingData`
- [x] **D.2** `lib/api.ts`: `getAdminOrders(params)`, `getAdminOrder(orderNumber)`, `updateAdminOrderStatus(orderNumber, data)`, `updateAdminOrderTracking(orderNumber, data)` con `getAuthHeaders()` — **`api.ts` ≥ 99 preservado**
- [x] **D.3** `lib/errors.ts`: `ORDER_CONFLICT` traducido (mostrar el `message` del servidor, mismo mecanismo que `STOCK_CONFLICT`) — `getFriendlyErrorMessage()` sigue siendo la puerta única

## E — Frontend: superficies del panel (R7, R8)

- [x] **E.1** `/admin/orders`: tabla (nº enlazado, fecha, cliente con «—» si `userEmail` null, mercado, total, `OrderStatusBadge`, piezas, badge «Devolución solicitada») con **select de estado** y **campo de búsqueda** (nº/cliente, `text-neutral-900`, label) → re-fetch con query params
- [x] **E.2** `/admin/orders`: paginación anterior/siguiente con nº de página (`totalPages`) + estados de carga, error de red con «Reintentar» y lista vacía editorial
- [x] **E.3** `/admin/orders/[orderNumber]`: cabecera (nº + badge + fecha), cliente/dirección/pago (tolerando nulls pre-V10), líneas con desglose fiscal y totales
- [x] **E.4** Panel de estado: **sólo** los botones de transiciones permitidas (espejo TS de la tabla D3) · `window.confirm` en CANCELLED · éxito → **toast «Estado actualizado»** + panel actualizado con la propia respuesta del `PUT` · `409 ORDER_CONFLICT`/`409 STOCK_CONFLICT`/`400`/`404` → mensajes amigables
- [x] **E.5** Bloque tracking en el detalle: «Transportista» + «Nº de seguimiento» (`text-neutral-900`, espejo ≤64) + **«Guardar seguimiento»** habilitado sólo si cambió → toast «Seguimiento guardado» · vacío = limpiar · flag «Devolución solicitada» sin botones de resolución
- [x] **E.6** Estados de la página detalle: cargando, error de red con reintentar, `404` con enlace de vuelta a la lista
- [x] **E.7** `SECCIONES` de `app/admin/layout.tsx` gana **«Pedidos»** y **«Stock»** (coherencia, plan D8) + tarjeta **«Pedidos»** en la portada `/admin` con el aviso honesto reducido a **7.5–7.6**
- [x] **E.8** Inputs con `text-neutral-900`, labels/`aria-label`, estilo editorial, `tsc` 0, ESLint 0/0

## F — Frontend: bloque de seguimiento del cliente (R5.5, R5.6, plan D7)

- [x] **F.1** `/orders/[orderNumber]`: bloque **«Transportista · Nº de seguimiento»** renderizado sólo cuando `carrier` o `trackingNumber` no sean `null`, junto al estado (sin cambios en `/receipt`, sin tocar `OrderStatusBadge`)

## G — Tests frontend (R9.3, R9.4)

- [x] **G.1** `AdminOrdersPage.test.tsx`: render de filas, filtro por estado y búsqueda (query params enviados), paginación, lista vacía, estado de error con reintentar, `userEmail` null → «—»
- [x] **G.2** `AdminOrderDetailPage.test.tsx`: transiciones mostradas según estado actual (espejo) · cancelar exige `confirm` · éxito → toast y panel refrescado sin re-fetch · `409 ORDER_CONFLICT` amigable · guardar/limpiar tracking · `404` con enlace de vuelta
- [x] **G.3** `OrderDetailPage.test.tsx`: fixtures con `carrier`/`trackingNumber` en `null` (cambio declarado R9.4, **aserciones intactas**) + test nuevo del bloque de seguimiento con datos
- [x] **G.4** `AdminPage.test.tsx`: tarjeta «Pedidos» + aviso **7.5–7.6** (cambio declarado R9.4) · `AdminLayout.test.tsx`: aserciones existentes intactas + aditivas de «Pedidos»/«Stock»
- [x] **G.5** `Api.test.ts`: URLs/métodos/auth de las 4 funciones nuevas · **`errors.test`** con `ORDER_CONFLICT` — `api.ts` ≥ 99
- [x] **G.6** `npm run test:coverage` EXIT 0 con umbrales congelados (**359+**)

## H — Documentación y cierre (R9.6, plan D9)

- [x] **H.1** `CHANGELOG.md` — entrada en Keep a Changelog es-ES
- [x] **H.2** Bloque «ESTADO ACTUAL» de `AGENTS.md` **dentro de la feature PR** (verdad tras el merge, sin PR/SHA) + **`MEMORY.md` refrescado en esta PR** (tabla «Rama actual» + sección 7.4)
- [x] **H.3** **Sin ADR** (plan D9) · **sin PR de documentación de cierre** (plan D9) · única migración V14 (A.1)

## Cierre

- [ ] **Baselines**: `./mvnw test` **249+** · `npm run test:coverage` **359+** y EXIT 0 (globales 77/76/74/79 + `api.ts` ≥ 99 — **`npx vitest run` no evalúa umbrales**) · `tsc` 0 · ESLint 0/0 · `npm run build` 0 · E2E local (Chromium+WebKit) **36 passed + 14 skipped** · CI 4/4
- [x] **Verificación en navegador**: como ADMIN — `/admin/orders` filtrar y abrir detalle, marcar `SHIPPED` con tracking y verlo en `/orders/[orderNumber]` del cliente, cancelar con `confirm` y ver la **liberación de reservas** en `/admin/stock`/`GET inventory` (reflejo en vivo), `409 ORDER_CONFLICT` con doble clic · como USER — `/admin/orders` redirige a `/`
- [x] **BD compartida**: tras los tests, `CatalogSeedTest` sigue viendo las 4 referencias y la BD de dev sin restos (los pedidos de prueba y su stock, borrados)
- [x] `/spec-check admin-orders` → aprobado
- [ ] **Preguntar al usuario antes de cualquier commit y PR** ⛔

---

## Notas de implementación

*(se rellenan con los hallazgos del camino)*
