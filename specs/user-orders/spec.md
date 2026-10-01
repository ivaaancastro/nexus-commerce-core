# Spec: Tarea 5.3 — Historial de Pedidos

> **Estado**: PENDIENTE DE APROBACIÓN
> **Fecha**: 2026-10-01
> **Rama**: `feat/user-orders`

---

## 1. Requisitos

### R1 — Pedidos asociados a usuario
Los pedidos deben quedar registrados con su usuario.

**Criterio**: `Order.user_id` se rellena al hacer checkout con usuario autenticado. Los pedidos de invitados quedan con `user_id` nulo.

### R2 — Listar pedidos del usuario
El usuario debe ver su historial de pedidos.

**Criterio**: `GET /api/v1/users/me/orders` devuelve solo los pedidos del usuario autenticado, ordenados por fecha descendente.

### R3 — Detalle de pedido
Desde el historial se accede al detalle de un pedido.

**Criterio**: `GET /api/v1/users/me/orders/{orderNumber}` devuelve el pedido con sus líneas. Un pedido de otro usuario devuelve `404`.

### R4 — Estados del pedido
El historial muestra el estado de cada pedido.

**Criterio**: Estados posibles: `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`.

### R5 — Resumen económico
Cada pedido muestra su desglose financiero.

**Criterio**: Subtotal, impuestos y total, con la moneda del pedido.

### R6 — Enlace al recibo
Desde el historial se accede al recibo del pedido.

**Criterio**: Enlace a `/receipt/[orderNumber]`.

### R7 — Página de historial
Debe existir una interfaz con la lista de pedidos.

**Criterio**: Ruta `/orders` con tarjetas por pedido: número, fecha, estado, total.

### R8 — Estado vacío
Si el usuario no tiene pedidos, se muestra un mensaje.

**Criterio**: Mensaje con enlace a la colección.

### R9 — Ruta protegida
El historial requiere autenticación.

**Criterio**: Sin sesión, redirige a `/login`.

### R10 — Paginación
El historial debe paginar cuando hay muchos pedidos.

**Criterio**: Paginación por páginas de 20 con navegación.

---

## 2. API

### Endpoints

| Método | Endpoint | Auth | Descripción |
|:---|:---|:---:|:---|
| `GET` | `/api/v1/users/me/orders` | ✅ | Historial paginado |
| `GET` | `/api/v1/users/me/orders/{orderNumber}` | ✅ | Detalle de pedido |

### DTOs

```java
public record OrderSummaryResponse(
    Long id,
    String orderNumber,
    OrderStatus status,
    String currency,
    BigDecimal totalAmount,
    Instant createdAt,
    int itemCount
) {}

public record OrderPageResponse(
    List<OrderSummaryResponse> orders,
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
```

El detalle reutiliza el `OrderResponse` existente.

---

## 3. Modelo de Datos

No hay cambios de esquema. La relación `Order.user_id` ya existe desde Tarea 5.1 (migración `V7__orders_user_id.sql`).

Cambio de comportamiento: `OrderService.processCheckout` debe asociar el usuario autenticado al pedido.

---

## 4. Criterios de Aceptación

- [ ] Los pedidos se asocian al usuario al hacer checkout
- [ ] El historial muestra solo los pedidos del usuario
- [ ] Los pedidos están ordenados por fecha descendente
- [ ] Un pedido de otro usuario devuelve 404
- [ ] Cada pedido muestra estado y total
- [ ] Desde el historial se accede al recibo
- [ ] La paginación funciona con muchos pedidos
- [ ] El estado vacío muestra mensaje con enlace

---

## 5. Casos de Error

| Caso | Respuesta |
|:---|:---|
| Sin token | `401 Unauthorized` |
| Token inválido | `401 Unauthorized` |
| Pedido de otro usuario | `404 Not Found` |
| Pedido inexistente | `404 Not Found` |
| Página fuera de rango | Página vacía, no error |

---

*Spec pendiente de aprobación. No implementar hasta tener el OK del usuario.*
