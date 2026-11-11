# Fase 9 — Pagos con Stripe (test mode) — spec (v2)

> **Estado**: ⛔ **pendiente de aprobación del usuario** — no se escribe código hasta que se apruebe (AGENTS.md regla 1).
> Decisiones y justificación: `plan.md` (D1–D16). Esta spec fija **qué** se construye y cómo se comprueba.

## 1. Máquina de estados y modelo de pago

### 1.1. Estado del pago (`orders.payment_status`, nuevo)

| Valor | Significado |
|:---|:---|
| `NONE` | Sin cobro online: pedidos anteriores a la fase, métodos distintos de `CARD` y **modo sin pasarela** |
| `REQUIRES_PAYMENT` | PaymentIntent creado, pendiente de pago |
| `PAID` | `payment_intent.succeeded` recibido y verificado |
| `PARTIALLY_REFUNDED` | `0 < amount_refunded < total` |
| `REFUNDED` | `amount_refunded == total` |

`OrderStatus` **no cambia** (`PENDING→CONFIRMED→SHIPPED→DELIVERED`, `CANCELLED`).

### 1.2. Flujo con tarjeta (Stripe configurado)

```
POST /orders/checkout (CARD)
   T1 (una transacción): reserva stock + pedido PENDING + payment_status=REQUIRES_PAYMENT   ──commit──
   Stripe: PaymentIntent (idempotency key = Idempotency-Key)  → guarda payment_intent_id
        └─ fallo ⇒ compensación (CANCELLED + libera reserva) ⇒ 502
GET /orders/{n}/payment  → clientSecret (Payment Element)
   navegador paga (3DS si procede)
Webhook payment_intent.succeeded (firmado) → PENDING→CONFIRMED, payment_status=PAID, email, ──fuente de verdad──
Webhook payment_intent.payment_failed     → sigue PENDING (el cliente puede reintentar con el mismo PI)
Job de expiración (30 min sin pagar)      → CANCELLED + cancela PI + libera reserva
```

## 2. Requisitos

### R1 · Checkout con tarjeta
1. Con Stripe configurado y `paymentMethod = CARD`, el pedido nace **`PENDING`** + `REQUIRES_PAYMENT` con el stock reservado y el cupón canjeado (misma T1 que hoy).
2. `Idempotency-Key` es **obligatoria**: sin ella `400` con `message`. Con una clave ya usada se devuelve el pedido existente **sin** duplicar reserva ni PaymentIntent; si ese pedido aún no tiene PI (corte previo) **y sigue `PENDING`**, se crea con la **misma** idempotency key de Stripe. *(Corrección de la verificación: un pedido ya `CANCELLED` —p. ej. compensado tras un fallo de Stripe— nunca recibe un PaymentIntent.)*
3. La llamada a Stripe ocurre **después del commit de T1**, nunca con bloqueos abiertos (D5). Si falla: pedido `CANCELLED`, reserva liberada, respuesta `502` `PAYMENT_GATEWAY_ERROR`.
4. Importe: `total_amount` en céntimos con `movePointRight(2).intValueExact()`; moneda fuera de {EUR, GBP, USD, CHF} (las de los 4 mercados) ⇒ error explícito (D7). `metadata`: `orderNumber`.
5. **Solo tarjeta y Apple Pay** (D3): el checkout solo acepta `paymentMethod = CARD` (Apple Pay es una *wallet* del Payment Element, no un método aparte); `BIZUM`/`PAYPAL`/`BANK_TRANSFER` ⇒ `400` con `message`. El PaymentIntent se crea restringido a tarjeta (en `stripe-java` 34 el campo se llama `allowed_payment_method_types = [CARD]`; Apple Pay va incluido en `card`). Los valores antiguos del enum siguen existiendo **solo** para leer pedidos históricos.
6. `POST /orders/checkout` sigue devolviendo **`OrderResponse`** (contrato de la 5.5/V5 intacto) más `paymentStatus` y `amountRefunded`. *(Ajuste de implementación: `refundStatus` se elimina por redundante — `PARTIALLY_REFUNDED`/`REFUNDED` ya lo dicen.)*

### R2 · Datos para pagar
`GET /api/v1/orders/{orderNumber}/payment` (autenticado, **solo el dueño**; otro usuario ⇒ `404`, patrón de `/orders/{n}`):
```json
{ "clientSecret": "pi_..._secret_...", "publishableKey": "pk_test_...", "paymentStatus": "REQUIRES_PAYMENT" }
```
- Solo se paga un pedido **`PENDING`**: uno cancelado/caducado conserva `REQUIRES_PAYMENT` pero su PaymentIntent está anulado ⇒ `409`. *(Corrección de la verificación.)*
- El `clientSecret` se **recupera de Stripe** (`retrievePaymentIntent`); **no se persiste ni se loguea** (D6).
- Pedido sin PI (`NONE`) o ya pagado ⇒ `409 PAYMENT_CONFLICT`.

### R3 · Webhook
`POST /api/v1/webhooks/stripe` — público en `SecurityConfig` **solo para esta ruta y método**; la seguridad es la **firma**.
1. Se lee el **cuerpo crudo** (`@RequestBody String`) y la cabecera `Stripe-Signature`; se verifica con `STRIPE_WEBHOOK_SECRET`. Firma inválida/ausente ⇒ `400` **sin detalle**; **ningún** efecto en BD.
2. **Idempotencia**: se inserta `event.id` en `stripe_events` (PK) en la misma transacción que el efecto; un evento repetido ⇒ `200` sin efecto.
3. Búsqueda del pedido por `payment_intent_id` **o** `metadata.orderNumber` (el webhook puede llegar antes de guardar el id). Fila con `PESSIMISTIC_WRITE`.
4. Eventos:
   | Evento | Efecto |
   |:---|:---|
   | `payment_intent.succeeded` | `PENDING→CONFIRMED`, `payment_status=PAID`, `OrderEmailNotifier` (en `try/catch`: el email nunca cambia el resultado). Si el pedido ya está `CANCELLED` (expiró) ⇒ **se registra `error` y se marca para reembolso manual**; no se resucita |
   | `payment_intent.payment_failed` | Solo `log.warn`; el pedido sigue `PENDING` |
   | `charge.refunded` | `amount_refunded` = valor **absoluto** del cargo; recalcula `payment_status` (D9) |
   | otros | `200` ignorado |
5. Responde `200` salvo firma inválida (`400`) o error interno (`500` ⇒ Stripe reintenta; la idempotencia lo hace seguro).

### R4 · Reembolso (admin)
`POST /api/v1/admin/orders/{orderNumber}/refund` — hereda `hasRole("ADMIN")`; cuerpo `{ "amount": 12.50 | null, "reason": "..." }`.
1. Solo pedidos con `payment_status ∈ {PAID, PARTIALLY_REFUNDED}`; otro ⇒ `409 PAYMENT_CONFLICT`.
2. `amount = null` ⇒ reembolso del **resto** (`total − amount_refunded`); con valor: `0 < amount ≤ resto` (`@Positive @Digits(8,2)` + comprobación en servicio ⇒ `400`).
3. Se crea en Stripe con idempotency key propia (`refund-{orderNumber}-{amount_refunded}-{amount}`), se actualiza el estado con el valor absoluto devuelto y la respuesta es el `AdminOrderDetailResponse` actualizado.
4. **No cambia `OrderStatus` ni repone stock** (D9).
5. Error de Stripe ⇒ `502 PAYMENT_GATEWAY_ERROR` sin cambios en BD.

### R5 · Guardas sobre la 7.4 (D10)
En `AdminOrderService.updateStatus`, antes de la escritura (todas `409 ORDER_CONFLICT`):
- `PENDING→CONFIRMED` con `payment_status = REQUIRES_PAYMENT` ⇒ «El pedido está pendiente de pago».
- `→CANCELLED` con `payment_status ∈ {PAID, PARTIALLY_REFUNDED}` ⇒ «Reembolsa el pedido antes de cancelarlo».
- `PENDING→CANCELLED` con PI abierto ⇒ se cancela el PaymentIntent (best-effort con `warn`; un fallo no impide cancelar y liberar stock).
- **Cupón (D17)**: toda transición a `CANCELLED` —admin, expiración (R6) o compensación de R1.3— **libera el uso del cupón** en la misma transacción que la liberación de stock: `usageCount − 1` (nunca por debajo de 0) con `PESSIMISTIC_WRITE` y borrado de la fila de `coupon_usages` del pedido; el pedido conserva `coupon_code`/`discount_amount`. Un reembolso no lo libera.
- Pedidos `payment_status = NONE`: comportamiento **idéntico al actual salvo la devolución del cupón** (R8.2).

### R6 · Expiración
Job `@Scheduled(fixedDelay = 5 min)`: pedidos `PENDING` + `REQUIRES_PAYMENT` con `created_at < now − 30 min` ⇒ cancelar (misma liberación de reserva **y de cupón** que la 7.4/R5), cancelar PI. **Nunca lanza** al planificador. Cada pedido en su propia transacción.

### R7 · Modo sin pasarela
`stripe.secret-key` vacía ⇒ no se construye el SDK; `CARD` crea pedidos `CONFIRMED` + `NONE` exactamente como hoy (la UI sigue sin selector de método); `GET /orders/{n}/payment` ⇒ `409`; el webhook ⇒ `404`. Aviso único en el arranque (patrón `searchMode`). `GET /api/v1/payments/config` (público; en el frontend lo consume el carrito sólo para el texto informativo — la redirección al pago se decide por `order.paymentStatus === "REQUIRES_PAYMENT"`) → `{ "paymentMode": "STRIPE" | "DISABLED" }` para que el frontend elija flujo.

### R8 · No regresión
1. Esquema: `V23` **solo añade** (columnas con `IF NOT EXISTS`, reejecutable); sin `UPDATE` de filas existentes (todas quedan `payment_status = 'NONE'` por `DEFAULT`).
2. Los pedidos y flujos sin Stripe se comportan **idénticos**: ficha, `/receipt`, emails, panel 7.4, cupones, wishlist. **Dos excepciones declaradas**: (a) cancelar un pedido ahora **devuelve el uso del cupón** (D17); (b) el carrito **ya no muestra el selector de método de pago** (D3), con lo que la spec `checkout-payment-grid` queda superada.
3. **R8.3**: los tests existentes que hay que tocar se **declaran explícitamente** y sus aserciones originales se conservan (`OrderServiceTest`, `OrderControllerTest`, `AdminOrderServiceTest`, `SecurityRulesTest`, `CartPage.test`, `Api.test`).
4. Los **31 E2E existentes** pasan **sin modificar `e2e/`** (modo sin pasarela).

### R9 · Frontend
1. `api.ts`: `checkout` sigue devolviendo `Order`; nuevos `getPaymentConfig`, `getOrderPayment(orderNumber)`, `refundOrder(orderNumber, body)` (admin). `handleResponse()` sigue tolerando respuestas vacías.
2. `cart/page.tsx`: **se elimina el selector de método de pago** (y su estado `paymentMethod`; el request envía siempre `CARD`). Con `paymentMode = STRIPE`, bajo el botón se muestra «Pagarás con tarjeta o Apple Pay en el siguiente paso» y, tras el checkout, `router.push("/orders/{n}/pay")`; con `DISABLED`, el flujo actual a `/orders/{n}`.
3. Nueva `app/orders/[orderNumber]/pay/page.tsx` (`ProtectedRoute`): `Elements` + **Payment Element**, botón «Pagar», `confirmPayment` con `return_url = /orders/{n}`. Errores con `getFriendlyErrorMessage()` (reglas nuevas para `card_declined`, `PAYMENT_GATEWAY_ERROR`, `PAYMENT_CONFLICT`). Estilo editorial (`neutral-*`, uppercase). Si el pedido ya está `PAID` ⇒ redirige a la ficha.
4. Ficha `/orders/[n]`: muestra estado de pago; con `redirect_status=succeeded` y pedido `PENDING`, **sondea** cada 2 s hasta `CONFIRMED` (máx. 30 s) con mensaje «Confirmando pago…» y, si se agota, «Tu pago se está procesando» (sin afirmar éxito ni fallo). Pedido `REQUIRES_PAYMENT` ⇒ botón «Completar pago».
5. Admin `/admin/orders/[n]`: bloque «Pago» (estado, reembolsado) y botón **«Reembolsar»** con importe opcional (vacío = resto), `window.confirm`, toast + panel actualizado con la respuesta, `409` bajo el bloque sin toast (patrón 7.4/7.5). Cancelar un pedido pagado: el `409` del servidor se muestra tal cual.
6. Sin importes ni claves en `localStorage`; la clave publicable llega del backend (R2).
7. `TaxCopy.test` y la guarda de símbolos de moneda siguen verdes (formato con `Intl.NumberFormat`).

### R9b · Dashboard (7.6) coherente con los pagos *(añadido en la verificación)*
Los ingresos del dashboard son **dinero que se queda**: no suman los pedidos `REQUIRES_PAYMENT` (sin pagar) ni los `REFUNDED` (devueltos del todo), y a los `PARTIALLY_REFUNDED` se les resta lo devuelto (`total − amountRefunded`). Los pedidos `NONE` y los `CANCELLED` se tratan como siempre. `byStatus` y `orderCount` no cambian. Medido contra un cálculo SQL independiente: coincide.

### R10 · Seguridad y secretos
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` en `backend/.env` (no versionado); `application.properties` con fallback **vacío**; documentadas en el README con el paso de Stripe CLI.
- Ningún secreto ni `clientSecret` en logs, respuestas de error ni tests; surefire fija las tres claves **vacías** (RT9).
- `SecurityConfig`: **una** línea nueva (`POST /api/v1/webhooks/stripe` `permitAll`) y `GET /api/v1/payments/config` público, **antes** de `anyRequest().denyAll()`; `/admin/**` y `/orders/**` heredan sin cambios.

### R11 · Pruebas y verificación
| Capa | Cobertura obligatoria |
|:---|:---|
| Servicio (mock de `StripeGateway`) | checkout tarjeta → `PENDING`; fallo de Stripe → compensación; idempotencia (mismo key sin segundo PI); método distinto de `CARD` ⇒ 400; modo sin pasarela; importe en céntimos y moneda no soportada |
| Cupón (D17) | cancelar (admin), expirar y compensar **devuelven** el uso (`usageCount` y `coupon_usages`) y nunca bajan de 0; el reembolso **no**; transaccional contra PostgreSQL real con cupón de `maxUsages = 1` que vuelve a ser canjeable |
| Webhook | firma inválida/ausente ⇒ 400 y 0 efectos; `succeeded` confirma + email; **evento repetido sin efecto**; webhook antes del `payment_intent_id`; `succeeded` sobre pedido ya `CANCELLED`; `charge.refunded` absoluto |
| Reembolso | total, parcial, parcial+resto, mayor que el resto ⇒ 400, estado no pagado ⇒ 409, error de Stripe ⇒ 502 sin cambios |
| Guardas 7.4 / expiración | R5 completo; job expira solo lo vencido y no lanza |
| Transaccional (PostgreSQL real) | `stripe_events` PK bajo doble entrega concurrente; `UNIQUE(idempotency_key)`; compensación libera la reserva |
| Seguridad | `SecurityRulesTest`: refund 401/403/200-admin; webhook accesible sin JWT pero 400 sin firma; `payments/config` público |
| Frontend | `api.ts` (3 métodos nuevos, 100 % del umbral de `api.ts`), página de pago, sondeo de la ficha, bloque de reembolso, `errors.ts`, flujo de `cart` por `paymentMode` |
| E2E | Existentes **intactos**. Nuevo `payments.spec.ts` **solo con `E2E_STRIPE=1`** (claves + `stripe listen`; se salta si no): compra, rechazo + reintento, cancelación de un pendiente desde el panel y reembolso parcial/total; **axe sobre la pantalla de pago**. El PaymentIntent se **confirma por API** con métodos de prueba (`pm_card_visa`…) porque Stripe lanza **hCaptcha a los navegadores automatizados** y bloquea el «Pagar» (medido). La tarjeta tecleada y el 3DS se validan a mano y con los tests de `PayPage` |
| **Verificación manual (obligatoria)** | Stripe CLI `stripe listen --forward-to localhost:8080/api/v1/webhooks/stripe`: `4242…` (éxito), `4000 0027 6000 3184` (3DS), `4000 0000 0000 9995` (fondos insuficientes), reembolso parcial y total, reentrega del mismo evento. **Apple Pay no es verificable en `localhost`** (exige HTTPS + dominio verificado): se comprueba en la Fase 10 sobre el despliegue |

**Gates**: backend `./mvnw clean test` · frontend `npx tsc --noEmit`, ESLint 0/0, `npm run build`, `npm run test:coverage` (umbrales congelados) · `npm run test:e2e:quick` · axe incluyendo la ruta de pago. Los números del cierre **se miden**, no se heredan de ninguna cifra previa (la v1 afirmaba 466/551 sin respaldo; línea base real: **453 backend · 549 frontend**).

## 3. API (resumen)

| Método y ruta | Auth | Respuesta |
|:---|:---|:---|
| `POST /api/v1/orders/checkout` | usuario, `Idempotency-Key` obligatoria | `201`/`200` `OrderResponse` (+3 campos de pago) |
| `GET /api/v1/orders/{n}/payment` | dueño | `200` `PaymentSessionResponse` · `404` · `409` |
| `POST /api/v1/webhooks/stripe` | firma Stripe | `200` · `400` firma inválida |
| `POST /api/v1/admin/orders/{n}/refund` | ADMIN | `200` `AdminOrderDetailResponse` · `400` · `409` · `502` |
| `GET /api/v1/payments/config` | público | `{ paymentMode }` |

DTOs (todos `record`, nunca entidades): `PaymentSessionResponse`, `PaymentConfigResponse`, `RefundRequest(amount, reason)`; `OrderResponse` gana `paymentStatus` y `amountRefunded`.
Excepciones → `GlobalExceptionHandler`: `PaymentGatewayException` → `502 PAYMENT_GATEWAY_ERROR`; `PaymentConflictException` → `409 PAYMENT_CONFLICT`.

## 4. Modelo de datos — `V23__stripe_payments.sql` (reescribe la V23 de la v1; no estaba en `main`)

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status    VARCHAR(24) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS amount_refunded   NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id ON orders(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created ON orders(payment_status, created_at);
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     VARCHAR(128) PRIMARY KEY,
  type         VARCHAR(64)  NOT NULL,
  processed_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```
**Sin** `client_secret` ni `refund_status` persistido (se deriva de `amount_refunded` y `total_amount`).

## 5. Fuera de alcance
Guardar tarjetas (`SetupIntent`), Bizum/PayPal/transferencia (retirados por decisión del usuario), checkout de invitado, facturación, Stripe live, reposición de stock al reembolsar, reembolso automático al expirar un pago tardío (se registra para revisión manual), panel de disputas.
