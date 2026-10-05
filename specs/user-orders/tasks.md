# Tasks: Tarea 5.3 — Historial de Pedidos

> **Estado**: ✅ APROBADA
> **Fecha**: 2026-10-01
> **Rama**: `feat/user-orders`

---

## Backend

### Asociar usuario al pedido
- [x] `OrderController` pasa `Authentication.getName()` al servicio
- [x] Setear `Order.user` al crear el pedido (`OrderService.resolveUser`)
- [x] Mantener `user = null` para checkout de invitado
- [x] Test: pedido con usuario autenticado se asocia
- [x] Test: pedido de invitado queda sin usuario

### OrderService — historial
- [x] `listOrders(email, page, size)` con orden descendente
- [x] `getOrderForUser(email, orderNumber)`
- [x] Validar que el pedido pertenece al usuario (en la consulta)
- [x] Mapeo a `OrderSummaryResponse`
- [x] Paginación con `Pageable`

### Controller
- [x] `GET /api/v1/users/me/orders` → `UserOrderController`
- [x] `GET /api/v1/users/me/orders/{orderNumber}`
- [x] `ORDER BY created_at DESC` (derivado del nombre `findByUserIdOrderByCreatedAtDesc`)

### DTOs
- [x] `OrderSummaryResponse` (record)
- [x] `OrderPageResponse` (record)

### Repository
- [x] `OrderRepository.findByUserIdOrderByCreatedAtDesc` — **sin** `@EntityGraph` (el fetch de colección con paginación truncaría los items; se cargan en lote con `@BatchSize`)
- [x] `OrderRepository.findByUserIdAndOrderNumber` — con `@EntityGraph` (sin paginación)

### Tests
- [x] Listar pedidos del usuario
- [x] Orden descendente por fecha
- [x] Pedido de otro usuario → 404
- [x] Pedido inexistente → 404
- [x] Paginación correcta
- [x] Usuario sin pedidos → lista vacía

---

## Frontend

### API client
- [x] `api.getMyOrders(page, size)`
- [x] `api.getMyOrder(orderNumber)`

### Página de historial
- [x] `app/orders/page.tsx`
- [x] Tarjeta por pedido: número, fecha, estado, total
- [x] Badge de color según estado → `components/OrderStatusBadge.tsx`
- [x] Enlace "Ver recibo" → `/receipt/[orderNumber]`
- [x] Estado vacío con enlace a la colección
- [x] Paginación (anterior/siguiente con indicador de página)

### Tipos
- [x] `OrderSummary` — en `types/commerce.ts` (junto a `Order`, no en `auth.ts`: el dominio es commerce)
- [x] `OrderPage` — en `types/commerce.ts`
- [x] `Order.status` ampliado a `OrderStatus` con `SHIPPED` y `DELIVERED`

### Protección de rutas
- [x] Envolver `/orders` con `ProtectedRoute`

### Header
- [x] Enlace **Pedidos** → `/orders`; **Cuenta** sigue apuntando a `/profile`

### Tests
- [x] Renderizado de lista de pedidos
- [x] Estado vacío
- [x] Badge de estado (4 estados distintos)
- [x] Navegación al recibo (incluye URL-encoded)
- [x] Paginación cambia de página
- [x] Error traducido con `getFriendlyErrorMessage()` + botón reintentar

---

## Docs

- [x] `CHANGELOG.md` actualizado
- [x] `MEMORY.md` actualizado

---

## Verificación

| Suite | Antes | Después |
|:---|:---:|:---:|
| Backend | 90 ✅ | **106 ✅** |
| Frontend | 54 ✅ | **65 ✅** |
| Cobertura backend | 81,9 % | **82,6 %** |
| Lint (archivos tocados) | — | **0 errores** |
| `npm run build` | — | **✅ `/orders` generada** |
| e2e contra la BD | — | **✅ checkout → `user_id`, historial, `404` ajeno, `401` sin/basura** |

---

## Bugs encontrados durante la verificación (corregidos en esta tarea)

| # | Problema | Causa | Test |
|:--|:---|:---|:---|
| 1 | Sin credencial → `403`, no `401` | Spring Security sin `authenticationEntryPoint` en una API sin login por formulario. Preexistente y app-wide | `JsonAuthenticationEntryPointTest` |
| 2 | Token malformado → `500` | `MalformedJwtException` se propagaba desde `JwtService.extractEmail()`. Preexistente y app-wide | `JwtAuthenticationFilterTest#shouldIgnoreMalformedTokenInsteadOfFailing` |
| 3 | Textos invisibles en modo oscuro | `globals.css` tenía el bloque `prefers-color-scheme: dark` de create-next-app: `--foreground` → `#ededed` sobre fondos claros fijados en `neutral-50`/`white`. Afectaba al logo del header en **todas** las páginas | `GlobalsCss.test.ts`, `Header.test.tsx`, `OrderHistoryPage.test.tsx` |
