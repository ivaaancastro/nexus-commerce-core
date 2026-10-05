# Tasks: Tarea 5.4 — Devoluciones de Productos

> **Estado**: ✅ APROBADA
> **Fecha**: 2026-10-01
> **Rama**: `feat/product-returns`

---

## Backend ✅

### Enum de estados
- [x] `ReturnStatus`: `REQUESTED`, `REJECTED`, `REFUNDED`
- [x] `OrderStatus`: `SHIPPED` y `DELIVERED` — **hecho en la Tarea 5.3** (PR #12), el enum ya los contiene

### Migración
- [x] `V9__product_returns.sql` con `uq_return_per_item`
- [x] Índice `idx_returns_user`

### Entidad y repositorio
- [x] Entidad `ProductReturn`
- [x] `ProductReturnRepository` con `existsByOrderItemId` y `findByOrderItemOrderId` (el `order_id` vive en `order_items`, así que la ruta es `orderItem.order.id`)

### Servicio de elegibilidad
- [x] `ReturnEligibilityService.evaluate(order, item)` + `isEligible(...)` — R1 (30 días), R2 (`DELIVERED`), R3 (sin devolución previa)
- [x] Motivo de inelegibilidad: `NOT_DELIVERED` / `EXPIRED` / `ALREADY_RETURNED`
- [x] `Clock` inyectable (`config/ClockConfig.java`) para poder testear el límite de 30 días

> **Decisión**: el orden de evaluación es `NOT_DELIVERED → ALREADY_RETURNED → EXPIRED`.
> R2 es la única compuerta que no consulta BD, así que el checkout (pedido `PENDING`)
> sale sin coste; y si la línea ya se devolvió, decir «plazo agotado» induciría a error.

### Servicio de devoluciones
- [x] `ReturnService.createReturn(email, orderNumber, request)` con validación previa
- [x] Cálculo de `refundAmount` con `BigDecimal` + `HALF_UP` escala 2 (**regla #4**)
      Fórmula `unitPrice × quantity` — **sin sumar `taxAmount`** (corrección aprobada el 2026-10-05, ver R5)
- [x] `ReturnService.listReturns(email, orderNumber)`
- [x] `@Transactional` en métodos que escriben (**regla #5**)
- [x] Excepción `ReturnNotAllowedException` → `409` en `GlobalExceptionHandler`
- [x] `DataIntegrityViolationException` (carrera sobre el `UNIQUE`) → también `409`

### Controller y DTOs
- [x] `POST /api/v1/users/me/orders/{orderNumber}/returns` → `201 Created`
- [x] `GET /api/v1/users/me/orders/{orderNumber}/returns` → `200`
- [x] DTOs `ReturnRequest`, `ReturnResponse` (records)
- [x] `OrderItemResponse` gana `returnEligible` y `returnIneligibleReason`

### Tests (28 nuevos: 134 en total, todos verdes)
- [x] Elegible: pedido `DELIVERED` + 29 días + sin devolución previa
- [x] No elegible: pedido `SHIPPED` — ampliado a los 4 estados no entregados
- [x] No elegible: 30 días exactos (límite) y 31 días
- [x] No elegible: línea ya devuelta
- [x] `refundAmount` correcto con `HALF_UP` (33,335 → 33,34)
- [x] Regresión: el IVA no se suma dos veces (`shouldNotAddTaxAgain`, réplica del pedido de 79,95 EUR)
- [x] Pedido de otro usuario → `404`
- [x] `orderItemId` ajeno al pedido → `404`
- [x] Línea no elegible → `409`
- [x] Motivo vacío → `400`
- [x] Listado devuelve solo las del usuario
- [x] El checkout no consulta la BD de devoluciones (`verifyNoInteractions`)

---

## Frontend ✅

### API client y tipos
- [x] `api.createReturn(orderNumber, payload)`
- [x] `api.getMyReturns(orderNumber)`
- [x] Tipo `ProductReturn` + `ReturnIneligibleReason` + `CreateReturnPayload` y ampliación de `OrderItem` con `returnEligible` / `returnIneligibleReason`
      (renombrado de `Return` a `ProductReturn` por legibilidad en TS)

### Detalle de pedido
- [x] Botón *«Devolver»* por línea, habilitado si `returnEligible`
- [x] Motivo de inelegibilidad legible si no lo es (R8: «Plazo agotado — se compró el {fecha}», «Pedido aún no entregado», «Ya devuelto»)
- [x] Fecha límite visible: *«Se compró el {fecha}»*
- [x] La sección solo se renderiza con sesión: sin token no se pide `getMyReturns` ni se ofrecen botones

### Formulario
- [x] Panel con textarea de motivo (inline en la propia línea, sin modal)
- [x] `noValidate` + validación propia con mensajes amigables (**reglas #8 y #9**)
- [x] Confirmación tras enviar (estado `Solicitada` + importe)

### Estado de devolución
- [x] Línea devuelta muestra `Solicitada` + importe reembolsado
- [x] Toast de confirmación estilo editorial (`Toast`, primer uso del componente)
- [x] Nota honesta: «El reembolso queda registrado como crédito pendiente: este establecimiento no procesa devoluciones de pago.»

### Tests (12 nuevos: 100 en total, todos verdes)
- [x] Botón visible y habilitado cuando es elegible
- [x] Motivo mostrado cuando no lo es — los tres motivos (EXPIRED con fecha, NOT_DELIVERED, ALREADY_RETURNED)
- [x] Envío del formulario con motivo (recorte de espacios incluido)
- [x] Motivo vacío → validación en cliente, sin llamada al backend
- [x] Error 409 traducido con `getFriendlyErrorMessage()` — y 4 casos nuevos en `Errors.test.ts` que cubren el discriminador `RETURN_NOT_ALLOWED`
- [x] Sin sesión no se piden devoluciones

---

## Docs

- [x] `specs/product-returns/spec.md` marcado ✅ APROBADA (+ criterios marcados y nota de la ampliación `code`)
- [x] `specs/user-orders/spec.md` — puntero a la Tarea 5.4
- [x] `CHANGELOG.md` — entrada de las devoluciones en `[Unreleased]`
- [x] `README.md` §3 — sección *Historial de Pedidos y Devoluciones* (incluye los endpoints de la Tarea 5.3, que faltaban)
- [x] `MEMORY.md` y `AGENTS.md` — estado (refrescados: se habían quedado atrás desde la Tarea 5.3)

---

*Tasks de la Tarea 5.4. Spec `specs/product-returns/spec.md` aprobada el 2026-10-01.*
