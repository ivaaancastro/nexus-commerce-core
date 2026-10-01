# Tasks: Tarea 5.4 — Devoluciones de Productos

> **Estado**: ✅ APROBADA
> **Fecha**: 2026-10-01
> **Rama**: `feat/product-returns`

---

## Backend

### Enum de estados
- [ ] `ReturnStatus`: `REQUESTED`, `REJECTED`, `REFUNDED`
- [ ] `OrderStatus`: añadir `SHIPPED` y `DELIVERED` (R4 de la Tarea 5.3)

### Migración
- [ ] `V9__product_returns.sql` con `uq_return_per_item`
- [ ] Índice `idx_returns_user`

### Entidad y repositorio
- [ ] Entidad `ProductReturn`
- [ ] `ProductReturnRepository` con `existsByOrderItemId` y `findByOrderId`

### Servicio de elegibilidad
- [ ] `ReturnEligibilityService.isEligible(orderItem)` — R1 (30 días), R2 (`DELIVERED`), R3 (sin devolución previa)
- [ ] Motivo de inelegibilidad: `NOT_DELIVERED` / `EXPIRED` / `ALREADY_RETURNED`
- [ ] `Clock` inyectable para poder testear el límite de 30 días

### Servicio de devoluciones
- [ ] `ReturnService.createReturn(email, orderNumber, request)` con validación previa
- [ ] Cálculo de `refundAmount` con `BigDecimal` + `HALF_UP` escala 2 (**regla #4**)
- [ ] `ReturnService.listReturns(email, orderNumber)`
- [ ] `@Transactional` en métodos que escriben (**regla #5**)
- [ ] Excepción `ReturnNotAllowedException` → `409` en `GlobalExceptionHandler`

### Controller y DTOs
- [ ] `POST /api/v1/users/me/orders/{orderNumber}/returns`
- [ ] `GET /api/v1/users/me/orders/{orderNumber}/returns`
- [ ] DTOs `ReturnRequest`, `ReturnResponse` (records)
- [ ] `OrderItemResponse` gana `returnEligible` y `returnIneligibleReason`

### Tests
- [ ] Elegible: pedido `DELIVERED` + 29 días + sin devolución previa
- [ ] No elegible: pedido `SHIPPED`
- [ ] No elegible: 30 días exactos (límite) y 31 días
- [ ] No elegible: línea ya devuelta
- [ ] `refundAmount` correcto con `HALF_UP` (p. ej. 33,335 → 33,34)
- [ ] Pedido de otro usuario → `404`
- [ ] `orderItemId` ajeno al pedido → `404`
- [ ] Línea no elegible → `409`
- [ ] Motivo vacío → `400`
- [ ] Listado devuelve solo las del usuario

---

## Frontend

### API client y tipos
- [ ] `api.createReturn(orderNumber, payload)`
- [ ] `api.getMyReturns(orderNumber)`
- [ ] Tipo `Return` y ampliación de `OrderItem`

### Detalle de pedido
- [ ] Botón *«Devolver»* por línea, habilitado si `returnEligible`
- [ ] Motivo de inelegibilidad legible si no lo es
- [ ] Fecha límite visible: *«Se compró el {fecha}»*

### Formulario
- [ ] Panel/modal con textarea de motivo
- [ ] `noValidate` + validación propia con mensajes amigables (**reglas #8 y #9**)
- [ ] Confirmación tras enviar

### Estado de devolución
- [ ] Línea devuelta muestra `Solicitada` + importe reembolsado
- [ ] Toast de confirmación estilo editorial

### Tests
- [ ] Botón visible y habilitado cuando es elegible
- [ ] Motivo mostrado cuando no lo es
- [ ] Envío del formulario con motivo
- [ ] Error 409 traducido con `getFriendlyErrorMessage()`

---

## Docs

- [ ] `specs/product-returns/spec.md` marcado ✅ APROBADA
- [ ] `specs/user-orders/spec.md` — puntero a la Tarea 5.4
- [ ] `CHANGELOG.md` — entrada `feat(returns)`
- [ ] `MEMORY.md` y `AGENTS.md` — estado
- [ ] `README.md` §3 — nuevos endpoints

---

*Tasks pendientes de aprobación de la spec.*
