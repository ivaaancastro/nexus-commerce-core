# Tasks: Tarea 5.3 — Historial de Pedidos

> **Estado**: PENDIENTE DE APROBACIÓN
> **Fecha**: 2026-10-01
> **Rama**: `feat/user-orders`

⚠️ **No marcar tareas hasta que la spec esté aprobada y se cree la rama.**

---

## Backend

### Asociar usuario al pedido
- [ ] `OrderService` obtiene el usuario del contexto de seguridad
- [ ] Setear `Order.user` al crear el pedido
- [ ] Mantener `user = null` para checkout de invitado
- [ ] Test: pedido con usuario autenticado se asocia
- [ ] Test: pedido de invitado queda sin usuario

### OrderService — historial
- [ ] `listOrders(userId, page, size)` con orden descendente
- [ ] `getOrderForUser(userId, orderNumber)`
- [ ] Validar que el pedido pertenece al usuario
- [ ] Mapeo a `OrderSummaryResponse`
- [ ] Paginación con `Pageable`

### OrderController
- [ ] `GET /api/v1/users/me/orders`
- [ ] `GET /api/v1/users/me/orders/{orderNumber}`
- [ ] `ORDER BY created_at DESC`

### DTOs
- [ ] `OrderSummaryResponse` (record)
- [ ] `OrderPageResponse` (record)

### Repository
- [ ] `OrderRepository.findByUserIdOrderByCreatedAtDesc`
- [ ] `OrderRepository.findByUserIdAndOrderNumber`

### Tests
- [ ] Listar pedidos del usuario
- [ ] Orden descendente por fecha
- [ ] Pedido de otro usuario → 404
- [ ] Pedido inexistente → 404
- [ ] Paginación correcta
- [ ] Usuario sin pedidos → lista vacía

---

## Frontend

### API client
- [ ] `api.getMyOrders(page, size)`
- [ ] `api.getMyOrder(orderNumber)`

### Página de historial
- [ ] `app/orders/page.tsx`
- [ ] Tarjeta por pedido: número, fecha, estado, total
- [ ] Badge de color según estado
- [ ] Enlace "Ver recibo" → `/receipt/[orderNumber]`
- [ ] Estado vacío con enlace a la colección
- [ ] Paginación

### Tipos
- [ ] `OrderSummary` en `types/auth.ts`
- [ ] `OrderPage` en `types/auth.ts`

### Protección de rutas
- [ ] Envolver `/orders` con `ProtectedRoute`

### Header
- [ ] Enlace "Cuenta" apunta a `/orders` o menú con perfil

### Tests
- [ ] Renderizado de lista de pedidos
- [ ] Estado vacío
- [ ] Badge de estado
- [ ] Navegación al recibo

---

## Docs

- [ ] `CHANGELOG.md` actualizado
- [ ] `MEMORY.md` actualizado

---

*Tasks pendientes de aprobación de la spec.*
