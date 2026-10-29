# Spec — Fase 9: Pagos (Stripe PSP)

> **Validado contra**: `specs/fase9/plan.md` — decisiones y criterios de aceptación.
> **Referencia de patterns**: `specs/coupons/` (canje atómico PESSIMISTIC_WRITE), `specs/admin-roles/` (security rules), `specs/wishlist/` (API idempotente).

---

## 1. Endpoints API

Todos los endpoints están bajo `/api/v1/` y heredan `hasRole("ADMIN")` para administración y `hasRole("USER")` para checkout de usuario logueado (reutiliza SecurityConfig de la 7.1).

### 1.1 `POST /api/v1/orders/checkout`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `amount` | `BigDecimal` | ✅ | Monto total en la moneda más pequeña (ej. cents para USD, para BigDecimal escala 2). |
| `currency` | `String` | ✅ | Código ISO 4217 (ej. `usd`, `eur`, `gbp`). |
| `idempotencyKey` | `String` (UUID) | ✅ | Clave idempotente del cliente. Se genera en frontend con `crypto.randomUUID()`. |
| `metadata` | `Map<String,String>` | opcional | Metadatos adicionales (ej. `cartId`, `userId`). |

**Response 200**:
```json
{
  "orderNumber": "ORD-987654A1",
  "paymentIntentId": "pi_1ABC2D3E4F5G6H7I8J9K",
  "clientSecret": "pi_1ABC2D3E4F5G6H7I8J9K_secret_abcdefghij",
  "status": "PENDING",
  "amount": 7995,
  "currency": "eur",
  "statusUrl": "/orders/ORD-987654A1?payment_intent=pi_1ABC2D3E4F5G6H7I8J9K"
}
```

**Response 400**: `amount` inválido (negativo o cero), `currency` no soportado.
**Response 409**: Stock insuficiente (`InsufficientStockException`), `Idempotency-Key` already in use (retorna orden existente 200).

---

### 1.2 `POST /api/v1/orders/{orderNumber}/refund`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `amount` | `BigDecimal` | opcional | Si es `null` → refund total. Si viene valor → refund parcial. |
| `reason` | `String` | opcional | Motivo del refund (ej. `customer_request`, `duplicate_charge`). |

**Response 200**:
```json
{
  "refundId": "re_1ABC2D3E4F5G6H7I8J9K",
  "amount": 7995,
  "currency": "eur",
  "status": "succeeded",
  "charge": "ch_1ABC2D3E4F5G6H7I8J9K"
}
```

**Response 400**: `amount` mayor que el total del pedido, `amount` negativo.
**Response 409**: Pedido no está en estado `CONFIRMED` o `SHIPPED` (solo `CONFIRMED` permite reembolso; `DELIVERED` requiere análisis adicional).

---

### 1.3 `GET /api/v1/orders/{orderNumber}`

**Response 200**: `OrderResponse` extendido con campos de pago:
```json
{
  "orderNumber": "ORD-987654A1",
  "status": "CONFIRMED",
  "paymentIntentId": "pi_1ABC2D3E4F5G6H7I8J9K",
  "paymentMethod": {
    "brand": "visa",
    "last4": "4242"
  },
  "amountTotal": 7995,
  "amountPaid": 7995,
  "amountRefunded": 0,
  "currency": "eur",
  "createdAt": "2026-10-29T14:30:00Z",
  "userEmail": "usuario@ejemplo.com"
}
```

**Response 404**: Pedido no encontrado.

---

### 1.4 `GET /api/v1/payment/methods/user`

**Response 200**: Lista de métodos de pago del usuario autenticado:
```json
{
  "paymentMethods": [
    {
      "id": "pm_1ABC2D3E4F5G6H7I8J9K",
      "type": "card",
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2030,
      "customerId": "cus_1ABC2D3E4F5G6H7I8J9K"
    }
  ]
}
```

**Response 200** (vacío): Si el usuario no tiene métodos de pago guardados.

---

### 1.5 `POST /api/v1/webhooks/stripe`

**Propósito**: Recibir eventos asíncronos de Stripe. **No es un endpoint público**; se configura en el dashboard de Stripe.

| Evento | Acción |
|--------|--------|
| `payment_intent.succeeded` | Marcar pedido `PENDING` → `CONFIRMED`, liberar reserva de stock (ya hecha en el checkout transaccional), actualizar `paymentIntentId` y `clientSecret` en la orden. |
| `payment_intent.failed` | Marcar pedido `PENDING` → `CANCELLED`, liberar reserva de stock (releaseReservedStock), log error. |
| `charge.refunded` | Actualizar pedido: `amountRefunded`, `refundStatus = REFUNDED`, posible cambio de estado dependiendo de la transición actual. |

**Response 200**: `Evento recibido` — Stripe requiere respuesta `200 OK` en <3 segundos para dejar de reintentar.

---

## 2. Modelos de DTO (Java Records)

Todos los DTOs son `record` inmutables con validación `@Valid` en los controladores.

### 2.1 `PaymentIntentRequest`

```java
public record PaymentIntentRequest(
    @NotNull @DecimalMin("0.01") BigDecimal amount,
    @NotNull @Size(max = 3) String currency,
    @NotNull @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String idempotencyKey,
    Map<String,String> metadata
) {}
```

### 2.2 `PaymentIntentResponse`

```java
public record PaymentIntentResponse(
    String orderNumber,
    String paymentIntentId,
    String clientSecret,
    String status,
    int amount, // en la unidad más pequeña (cents equivalent con BigDecimal escala 2)
    String currency,
    String statusUrl
) {}
```

### 2.3 `RefundRequest`

```java
public record RefundRequest(
    @NotNull BigDecimal amount, // null = reembolso total
    @Size(max = 100) String reason
) {}
```

### 2.4 `RefundResponse`

```java
public record RefundResponse(
    String refundId,
    BigDecimal amount,
    String currency,
    String status,
    String charge
) {}
```

### 2.5 `PaymentMethodResponse`

```java
public record PaymentMethodResponse(
    String id,
    String type,
    String brand,
    String last4,
    Integer expMonth,
    Integer expYear,
    String customerId
) {}
```

---

## 3. Excepciones de Dominio

| Excepción | HTTP | Mensaje al usuario |
|-----------|------|-------------------|
| `InsufficientStockException` | 409 | `No hay suficiente stock para este SKU. Disponible: {available}, solicitado: {solicitado}.` |
| `PaymentIntentCreationException` | 400 | `No se pudo crear el PaymentIntent en Stripe. Inténtalo de nuevo o contacta con soporte.` |
| `InvalidIdempotencyKeyException` | 409 | `La clave de idempotencia ya fue utilizada. Se retornó la orden existente.` |
| `RefundNotAllowedException` | 409 | `No se pueden reembolsar pedidos en el estado actual: {currentState}.` |
| `UserNotFoundException` | 404 | `Usuario no encontrado.` |

Todas las excepciones se traducen centralmente en `GlobalExceptionHandler` a respuestas estructuradas con `timestamp`, `status`, `error`, `message`.

---

## 4. Seguridad

| Endpoint | Rol requerido | Comentario |
|----------|---------------|------------|
| `POST /api/v1/orders/checkout` | `USER` (cualquier usuario logueado) | El checkout requiere sesión activa (decisión Fase 8: sin `permitAll`). |
| `POST /api/v1/orders/{orderNumber}/refund` | `ADMIN` | Solo administrador puede iniciar reembolsos. |
| `GET /api/v1/orders/{orderNumber}` | `USER` (el dueño del pedido) o `ADMIN` | El usuario ve sus propios pedidos; admin ve cualquier pedido. |
| `GET /api/v1/payment/methods/user` | `USER` | Solo el usuario autenticado puede ver sus métodos guardados. |
| `POST /api/v1/webhooks/stripe` | — | Interno de Stripe, no pasa por SecurityConfig. |

---

## 5. Tests Unitarios (esquema mínimo)

| Test | Clase | Mock | Verification |
|------|-------|------|-------------|
| `PaymentServiceTest#createPaymentIntent_success` | `PaymentServiceTest` | `StripePaymentConnector` | Retorna `PaymentIntentResponse` con `clientSecret` |
| `PaymentServiceTest#createPaymentIntent_idempotent` | `PaymentServiceTest` | `StripePaymentConnector` | Misma clave → retorna orden existente 200 |
| `RefundServiceTest#initiateRefund_partial` | `RefundServiceTest` | `StripeRefundConnector` | Crea refund en Stripe + actualiza pedido a `REFUNDED` |
| `RefundServiceTest#initiateRefund_full` | `RefundServiceTest` | `StripeRefundConnector` | Igual que parcial pero `amount = null` |
| `OrderServiceTest#checkout_with_stripe_mock` | `OrderServiceTest` | `CouponService` mock (como V5) | Order creada con `status = CONFIRMED`, stock reservado |

---

## 6. Flujo de Datos (Secuencia)

```
Usuario logueado → POST /checkout
  ↘
   Stripe SDK test mode → create PaymentIntent
   ↘
   Backend: reservar stock @ PESSIMISTIC_WRITE → crear orden PENDING con snapshot financiero
   ↘
   Response 200 → clientSecret al frontend
   ↘
   Frontend: Stripe.js Elements → confirmar PaymentIntent
   ↘
   Frontend: retorna confirmation state → llamar a GET /orders/{orderNumber}
   ↘
   Backend: estado actualizado a CONFIRMED (si no había webhook previo)
   ↘
   Usuario ve pedido confirmado en la UI
```

---

## 7. Flujo de Reembolso (Secuencia)

```
Admin → POST /orders/{orderNumber}/refund
  ↘
   Backend: validar estado pedido (solo CONFIRMED → refund) → Stripe SDK → create refund
   ↘
   Stripe → webhook `charge.refunded` → Backend actualiza pedido
   ↘
   Backend: order status → REFUNDED (o mantener estado actual con amountRefunded anotado)
   ↘
   Response 200 → admin ve refund confirmado en la UI
```

---

## 8. Idempotencia

- **Cabecera**: `Idempotency-Key: <UUID>` en `POST /checkout`.
- **Única línea de defensa**: `SELECT order_number FROM orders WHERE idempotency_key = ?` en el servicio.
- **Capa BD**: restricción única `UNIQUE(idempotency_key)` en tabla `orders` (migración futura, por ahora validación en servicio).
- **Comportamiento**: si la clave ya existe → retornar orden existente (200) sin efecto secundario (no duplicar reservas ni cargos).

---

## 9. Dependencias con otras fases

| Fase | Dependencia | Sentido |
|------|-------------|---------|
| **5** | Usuarios registrados/verified | El checkout requiere usuario autenticado (ya resuelto). |
| **8** | Health check / métricas | Deben estar operativos antes de añadir lógica transaccional nueva. |
| **9 → 10** | Envíos y Logística | El tracking de envíos requiere order en estado `CONFIRMED` (post-checkout). |
| **9 → 11** | Devoluciones RMA | Los reembolsos dependen de la infraestructura de PaymentIntent + webhooks (creada en esta fase). |
| **9 → 14** | Landing/Docs | La demo sandbox muestra "Stripe test mode active" pero keys never expuestas. |

---

**Fin del spec de la Fase 9.**

*Próximo paso: aprobación del usuario → creación de `specs/fase9/tasks.md` → implementación guiada por tasks → `/spec-check fase9` verde.*