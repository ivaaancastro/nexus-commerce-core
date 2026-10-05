# Spec: Tarea 5.4 — Devoluciones de Productos

> **Estado**: ✅ APROBADA
> **Fecha**: 2026-10-01
> **Rama**: `feat/product-returns`
> **Aprobada por el usuario**: 2026-10-01

---

## 1. Requisitos

### R1 — Ventana de 30 días desde la compra

Un producto solo puede devolverse si han pasado **menos de 30 días** desde la compra.

**Criterio**: `Order.createdAt.plus(30 días) > now`. La referencia es la **fecha de compra**, no la de entrega. Al superar el plazo la línea pasa a no devolvible de forma permanente.

### R2 — Pedido entregado

No se puede devolver algo que no se ha recibido.

**Criterio**: `Order.status == DELIVERED`. Cualquier otro estado (`PENDING`, `CONFIRMED`, `SHIPPED`, `CANCELLED`) hace la línea no devolvible.

### R3 — Una devolución por línea

Cada línea de producto admite **como mucho una** devolución.

**Criterio**: si ya existe un `ProductReturn` para ese `orderItemId` —sea cual sea su estado— la línea deja de ser devolvible. Reforzado con `UNIQUE (order_item_id)` en BD.

### R4 — Solicitud de devolución

El usuario puede solicitar la devolución de una línea indicando un motivo.

**Criterio**: `POST /api/v1/users/me/orders/{orderNumber}/returns` con body `{ orderItemId, reason }`. Valida R1, R2 y R3 **antes** de persistir. Si alguna falla → `409 Conflict`.

### R5 — Importe del reembolso (registro contable)

Cada devolución guarda el importe que se devolvería.

**Criterio**: `refundAmount = unitPrice × quantity` de la línea. `BigDecimal` con `RoundingMode.HALF_UP` y escala 2 (**regla #4**). Se calcula y persiste en el momento de la solicitud.

> **Fórmula corregida el 2026-10-05, aprobada por el usuario.** La original era
> `unitPrice × quantity + taxAmount` y **sumaba el IVA dos veces**: `unit_price`
> guarda el PVP **con IVA ya incluido** (en el checkout,
> `unitPrice = finalPrice()` y `subtotal += unitPrice×qty − taxAmount`), así que
> `unitPrice × quantity` ya es el bruto pagado — es el `totalAmount` de la línea.
> Para la línea de 79,95 EUR (66,07 + 13,88) la fórmula vieja declaraba
> **93,83 EUR**, es decir, devolver 13,88 EUR que nunca se cobraron de más.
> Regresión cubierta por `ReturnServiceTest.shouldNotAddTaxAgain()`.

> ⚠️ **No mueve dinero.** El proyecto no tiene pasarela de pago. Este campo es un registro contable; el reembolso real queda fuera de alcance hasta existir un PSP.

### R6 — Ciclo de vida del estado

**Criterio**: enum `ReturnStatus` con `REQUESTED`, `REJECTED`, `REFUNDED`.

- **Alcanzable hoy**: solo `REQUESTED`, asignado al crear la solicitud.
- **Fuera de alcance**: las transiciones a `REJECTED`/`REFUNDED` — requieren backoffice, que no existe.

### R7 — Listado de devoluciones del pedido

Desde el detalle del pedido se ven sus devoluciones.

**Criterio**: `GET /api/v1/users/me/orders/{orderNumber}/returns` devuelve solo las devoluciones de ese pedido y ese usuario.

### R8 — Elegibilidad visible en la UI

El usuario debe ver **por qué** una línea no puede devolverse, no solo que no puede.

**Criterio**: cada línea del detalle muestra el botón *«Devolver»* habilitado, o bien el motivo: *«Plazo agotado — se compró el {fecha}»*, *«Pedido aún no entregado»* o *«Ya devuelto»*.

### R9 — Formulario de solicitud

**Criterio**: al pulsar *«Devolver»* se abre un formulario con el motivo. Tras confirmar, la línea muestra el estado `Solicitada` y el importe.

### R10 — Pertenencia y seguridad

**Criterio**: todos los endpoints van bajo `/api/v1/users/me/...` con JWT. Un pedido de otro usuario → `404` (nunca `403`). Sin token → `401`.

---

## 2. API

### Endpoints

| Método | Endpoint | Auth | Descripción |
|:---|:---|:---:|:---|
| `POST` | `/api/v1/users/me/orders/{orderNumber}/returns` | ✅ | Solicitar devolución |
| `GET` | `/api/v1/users/me/orders/{orderNumber}/returns` | ✅ | Devoluciones del pedido |

La elegibilidad **no** tiene endpoint propio: viaja enriquecida en el detalle de pedido (§2.2).

### 2.1. DTOs

```java
public record ReturnRequest(
    @NotNull(message = "La línea es obligatoria")
    Long orderItemId,

    @NotBlank(message = "El motivo es obligatorio")
    @Size(max = 500, message = "El motivo no puede superar 500 caracteres")
    String reason
) {}

public record ReturnResponse(
    Long id,
    Long orderItemId,
    String skuCode,
    ReturnStatus status,
    String reason,
    String currency,
    BigDecimal refundAmount,
    Instant requestedAt
) {}
```

### 2.2. Enriquecimiento del detalle de pedido

`OrderItemResponse` gana dos campos, presentes también en el resto de respuestas que lo incluyan:

```java
public record OrderItemResponse(
    // ... campos existentes ...
    Boolean returnEligible,          // true solo si cumple R1 + R2 + R3
    String returnIneligibleReason    // NOT_DELIVERED | EXPIRED | ALREADY_RETURNED, o null
) {}
```

`returnEligible` es `false` en el checkout (el pedido está `PENDING`), sin efecto práctico.

### 2.3. Regla de elegibilidad

```
returnEligible = status == DELIVERED
              && createdAt + 30d > now
              && !existsReturn(orderItemId)
```

---

## 3. Modelo de Datos

### Migración `V9__product_returns.sql`

```sql
CREATE TABLE product_returns (
    id            BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id),
    user_id       BIGINT REFERENCES users(id),
    status        VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    reason        VARCHAR(500) NOT NULL,
    currency      VARCHAR(3) NOT NULL,
    refund_amount NUMERIC(12, 2) NOT NULL,
    requested_at  TIMESTAMP NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMP,
    CONSTRAINT uq_return_per_item UNIQUE (order_item_id)
);

CREATE INDEX idx_returns_user ON product_returns(user_id);
```

**`uq_return_per_item`** es la línea de defensa de R3: aunque la validación de aplicación fallara, la BD rechazaría la duplicada.

### Ampliación de `OrderStatus`

`status VARCHAR(32)` es `VARCHAR` plano → **sin migración**. Solo se añaden `SHIPPED` y `DELIVERED` al enum Java (requisito R4 de la Tarea 5.3).

---

## 4. Criterios de Aceptación

- [x] Solo las líneas de pedidos `DELIVERED` con menos de 30 días son devolvibles
- [x] Al pasar los 30 días la línea deja de ser devolvible
- [x] Una línea ya devuelta no vuelve a ofrecerse
- [x] El importe usa `BigDecimal` con `HALF_UP` y escala 2
- [x] La solicitud persiste con estado `REQUESTED`
- [x] Pedido de otro usuario → `404`
- [x] Línea no elegible → `409`
- [x] Motivo vacío → `400`
- [x] La UI explica el motivo de no elegibilidad
- [x] Ningún movimiento de dinero real
- [x] Tests pasando (backend y frontend)

---

## 5. Casos de Error

| Caso | Respuesta |
|:---|:---|
| Sin token | `401 Unauthorized` |
| Token inválido | `401 Unauthorized` |
| Pedido inexistente | `404 Not Found` |
| Pedido de otro usuario | `404 Not Found` |
| `orderItemId` que no pertenece al pedido | `404 Not Found` |
| Pedido no `DELIVERED` | `409 Conflict` |
| Plazo de 30 días superado | `409 Conflict` |
| Línea ya devuelta | `409 Conflict` |
| Motivo vacío o > 500 caracteres | `400 Bad Request` |

> **Ampliación durante la implementación** (2026-10-05, **aprobada por el usuario
> el 2026-10-05**): el `409` de devoluciones añade `"code": "RETURN_NOT_ALLOWED"`
> al cuerpo. El backend ya usaba `409` para *stock insuficiente*, y
> `getFriendlyErrorMessage()` traducía todo `409` a «No queda stock suficiente…»,
> lo que habría mostrado un mensaje falso al usuario. El `code` es el
> discriminador explícito: si está, se muestra el `message` del backend (ya
> redactado para el usuario); si no, se mantiene la traducción de stock.

---

## 6. Fuera de Alcance

| Excluido | Motivo |
|:---|:---|
| Reembolso real de dinero | No hay PSP en el proyecto |
| Aprobación / rechazo de devoluciones | No existe backoffice |
| Etiqueta de devolución | Requiere transportista |
| Reembolso parcial por unidades | Se devuelve la línea completa |
| Historial global de devoluciones del usuario | Puede ser tarea futura |

---

## 7. Trazabilidad de Requisitos

| Requisito | Backend | Frontend | Tests |
|:---|:---:|:---:|:---:|
| R1 — 30 días | ✅ | ✅ | ✅ |
| R2 — DELIVERED | ✅ | ✅ | ✅ |
| R3 — una por línea | ✅ | ✅ | ✅ |
| R4 — solicitud | ✅ | ✅ | ✅ |
| R5 — importe contable | ✅ | ✅ | ✅ |
| R6 — estados | ✅ | ✅ | ✅ |
| R7 — listado | ✅ | ✅ | ✅ |
| R8 — elegibilidad visible | ✅ | ✅ | ✅ |
| R9 — formulario | — | ✅ | ✅ |
| R10 — seguridad | ✅ | ✅ | ✅ |

---

*Spec aprobada por el usuario el 2026-10-01. La Tarea 5.4 puede implementarse.*
