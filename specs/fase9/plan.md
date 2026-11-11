# Fase 9 — Pagos con Stripe (test mode) 🔴 — plan (v2)

> **Estado**: **spec pendiente de aprobación** (reescrita 2026-11-10).
> **Por qué se reescribe**: la v1 se marcó «completada» pero el código era **simulado** (sin SDK de Stripe, IDs
> `pi_test_<uuid>` inventados, sin webhook, frontend sin tocar, `Idempotency-Key` degradada a opcional y
> `clientSecret` en logs). Esa implementación **se descarta** (ver D15). Esta v2 no reutiliza sus decisiones por
> inercia: cada una se justifica de nuevo.
> **Contexto del proyecto**: ya no se vende; es un **portfolio**. El valor está en demostrar un flujo de pago
> **real y correcto** (webhook firmado, idempotencia, concurrencia), no en cubrir métodos de pago.

## 1. Objetivo

Cobrar de verdad con **Stripe en test mode**: el pedido con tarjeta nace `PENDING` con el stock reservado, el
cliente paga con **Stripe Payment Element** y el pedido pasa a `CONFIRMED` **solo** cuando llega el webhook
`payment_intent.succeeded` verificado por firma. El admin puede **reembolsar** (total/parcial) desde el panel.

## 2. Situación de partida (medida en el código, 2026-11-10)

| Hecho | Consecuencia para el diseño |
|:---|:---|
| El pedido nace `CONFIRMED` sin cobro (`OrderService.processCheckout`) | Hay que introducir `PENDING` como «reservado, sin pagar» **sin romper** los pedidos ya existentes |
| `PaymentMethod` (`CARD`, `BIZUM`, `PAYPAL`, `BANK_TRANSFER`) es solo un dato declarativo y el carrito muestra un selector de 4 métodos | Decisión del usuario (2026-11-10): **solo tarjeta y Apple Pay**; el selector desaparece (D3) |
| `CheckoutRequest`/`OrderResponse` los consume `cart/page.tsx` y `api.ts` como `Order` plano | **Se mantiene el contrato** (D6): no se introduce un `CheckoutResponse` anidado |
| La máquina de estados de la 7.4 permite al admin `PENDING→CONFIRMED` a mano | Hay que cerrar ese atajo para pedidos de tarjeta (D10) |
| **Cancelar un pedido (7.4) solo libera el stock** (`AdminOrderService.liberarReservas`); el uso del cupón **no se devuelve** (medido en el código) | Con pagos que caducan, el cupón quedaría consumido por ventas que no ocurrieron (D17) |
| E2E (31) y CI compran con `CARD` por defecto y **sin claves de Stripe** | Sin claves ⇒ modo sin pasarela (D4); los E2E existentes no cambian |
| `OrderEmailNotifier` se invoca al crear el pedido `CONFIRMED` | En el flujo Stripe se invoca al confirmar por webhook |
| Existe el planificador del outbox (`@Scheduled`) | La expiración de pendientes reutiliza el patrón (D11) |

## 3. Decisiones de diseño

| # | Decisión | Justificación / alternativa descartada |
|:--|:---|:---|
| **D1** | **`stripe-java` oficial** tras una interfaz **`StripeGateway`** (`createPaymentIntent`, `retrievePaymentIntent`, `cancelPaymentIntent`, `createRefund`, `verifyWebhook`) | Tests deterministas sin red ni mocks de métodos estáticos del SDK. Alternativa descartada: llamar al SDK desde los servicios |
| **D2** | **El webhook es la fuente de verdad del pago.** El pedido pasa a `CONFIRMED` solo con `payment_intent.succeeded` **con firma válida**; el `return_url` del navegador no confirma nada | Un cliente puede cerrar la pestaña tras pagar, o falsear la redirección |
| **D3** | **Solo tarjeta y Apple Pay** (decisión del usuario). Ambos se cobran con el **Payment Element**: Apple Pay es una *wallet* dentro del método `card` (`payment_method_types = ["card"]`), no un método aparte. **Se elimina el selector de método del carrito** (la elección ocurre en la pantalla de pago) y el checkout **solo acepta `CARD`** (`400` con otro valor). Los valores `BIZUM`/`PAYPAL`/`BANK_TRANSFER` **se conservan en el enum** solo para poder leer pedidos antiguos (`EnumType.STRING`) | **Apple Pay exige HTTPS y verificar el dominio en Stripe**: no aparece en `localhost`. Se prueba en la **Fase 10** sobre el dominio desplegado; en local se verifica con tarjeta. Esto deja obsoleta la spec `checkout-payment-grid` (R8.3) |
| **D4** | **Sin `STRIPE_SECRET_KEY` ⇒ «modo sin pasarela»**: `CARD` se comporta como hoy (nace `CONFIRMED`) y se expone `paymentMode = DISABLED`, con `warn` en el arranque | Mismo patrón que `searchMode` y el «MODO DESARROLLO» del email. Mantiene verdes CI y los 31 E2E sin secretos. Surefire fija la clave **vacía** (como `spring.mail.username`) para que ningún test llame a Stripe |
| **D5** | **Nunca se llama a Stripe dentro de la transacción con bloqueos.** T1: reserva de stock + pedido `PENDING` (commit). Después: se crea el PaymentIntent con **idempotency key de Stripe = `Idempotency-Key`**. Si falla ⇒ **compensación** (cancelar pedido + liberar reserva) y `502` | Una llamada de red con `PESSIMISTIC_WRITE` abierto bloquea el inventario durante la latencia de Stripe |
| **D6** | **Contrato del checkout intacto**: `POST /orders/checkout` sigue devolviendo `OrderResponse` (gana `paymentStatus`, `amountRefunded`, `refundStatus`). El `clientSecret` se pide aparte: `GET /orders/{n}/payment` (solo el dueño) | Evita el `CheckoutResponse` anidado de la v1, que rompía `api.ts`. **El `clientSecret` no se guarda en BD ni se loguea** |
| **D7** | Importes a Stripe en céntimos con `movePointRight(2).intValueExact()` y validación de **moneda de 2 decimales** (EUR/GBP/USD/**CHF** — las de los 4 mercados; añadida CHF al descubrir en la verificación que el mercado CH daría `502`) | Nunca `double`; si se añadiera una moneda de 0/3 decimales, falla en voz alta |
| **D8** | **Idempotencia en 3 capas**: cabecera `Idempotency-Key` **obligatoria** (`400` sin ella — se restaura §4.3) + `UNIQUE` en BD + idempotency key de Stripe. El webhook es idempotente con tabla **`stripe_events`** (`event_id` PK) | Reintentos de red, doble clic y reentregas de Stripe |
| **D9** | **Reembolso admin** en `POST /api/v1/admin/orders/{n}/refund` (hereda `hasRole("ADMIN")` de `/admin/**`), parcial o total, con idempotency key de Stripe. El estado se fija con el valor **absoluto** `amount_refunded` del cargo (webhook `charge.refunded` y respuesta del refund) ⇒ reentrante. **Reembolsar es dinero: no cambia el estado del pedido ni repone stock** | Valor absoluto evita doble suma si llegan webhook y respuesta |
| **D10** | **Guardas de coherencia con la 7.4**: (a) el admin **no puede** pasar a mano a `CONFIRMED` un pedido de tarjeta sin pagar; (b) **no puede cancelar** un pedido pagado sin reembolso total (`409`); (c) cancelar un `PENDING` de tarjeta **cancela también el PaymentIntent** | Evita pedidos confirmados sin cobro y cancelados con el dinero retenido |
| **D11** | **Expiración**: job `@Scheduled` (cada 5 min) cancela los `PENDING` de tarjeta sin pagar a los **30 min**, cancela el PaymentIntent y libera la reserva | Si no, un carrito abandonado retiene stock indefinidamente |
| **D12** | **Fuera de alcance**: guardar tarjetas (`SetupIntent`, opcional futuro), Bizum/PayPal/transferencia (retirados), 3DS personalizado (lo gestiona el Payment Element), facturación, Stripe live, checkout de invitado | Se declara aquí para no reabrirlo a mitad de obra |
| **D13** | **ADR-0007**: «Integración con Stripe: gateway + webhook como fuente de verdad» | AGENTS.md regla 6: cambia la arquitectura (dependencia externa + flujo asíncrono) |
| **D14** | Frontend: **Stripe Payment Element** en `/orders/[orderNumber]/pay`; tras `confirmPayment` redirige a `/orders/[n]?redirect_status=…` y la ficha **sondea** hasta `CONFIRMED` (máx. 30 s) | La confirmación es asíncrona (D2): la UI no puede suponer el éxito |
| **D15** | **Se descarta la implementación simulada** de la rama: se eliminan `PaymentService`, `RefundService`, `RefundController`, `UserPaymentMethodService`, los DTO de la v1, y se restauran `OrderController`/`UserController`/`SecurityConfig`. Se reescribe `V23` (aún sin mergear a `main`) | Es código que finge cobrar; mantenerlo «por si acaso» es deuda |
| **D16** | Rama **`feat/stripe-payments`** (renombrada desde `fase9`, convención §8.4; nunca se había subido a `origin`) | ✅ hecho 2026-11-10 |
| **D17** | **El cupón se devuelve al cancelar**: cualquier transición a `CANCELLED` (admin, expiración o fallo de Stripe) **libera el uso del cupón** — `usageCount − 1` con `PESSIMISTIC_WRITE` (`findByCodeForUpdate`) y borrado de la fila de `coupon_usages` del pedido. El pedido **conserva** `coupon_code`/`discount_amount` como histórico. Un reembolso (parcial o total) **no** lo libera: el pedido sigue existiendo | Un cupón con `maxUsages` se agotaría con pedidos que caducan sin pagar. Es un **cambio de comportamiento también para pedidos sin Stripe** (R8, declarado) y se cubre con test de regresión |

## 4. Riesgos

| Riesgo | Mitigación |
|:---|:---|
| Webhook sin firma válida aceptado | `Webhook.constructEvent` sobre el **cuerpo crudo**; `400` genérico; test negativo obligatorio |
| Cobro sin pedido / pedido sin cobro por fallo entre T1 y Stripe | D5: compensación + idempotency key de Stripe + reintento con la misma clave devuelve el pedido existente y recrea/recupera el PI |
| Webhook llega **antes** de que el pedido tenga `payment_intent_id` guardado | Buscar por `metadata.orderNumber` además de por `payment_intent_id` |
| Carrera webhook ↔ expiración ↔ cancelación admin | Fila del pedido con `PESSIMISTIC_WRITE` en las tres rutas; el estado terminal gana |
| Cupón consumido por un pedido que expira | Resuelto con D17 (verificado: hoy la cancelación no lo devuelve) |
| Compatibilidad SDK/React 19/Next 16 | Verificar con la documentación vigente (context7) antes de fijar versiones; fijar versiones exactas |
| Secretos en el repo | Solo `backend/.env` (no versionado); el frontend recibe la clave **publicable** desde el backend |

## 5. Estimación y orden

1. ADR-0007 + limpieza de la rama simulada (D15) — 0,5 d
2. Backend: gateway, migración, checkout PENDING, webhook, expiración — 2 d
3. Backend: reembolsos y guardas 7.4 — 1 d
4. Frontend: pago, sondeo, reembolso en admin — 1,5 d
5. Tests, E2E opcional con claves reales, verificación manual con Stripe CLI — 1 d
6. Docs (README, CHANGELOG, estado) — 0,5 d

Total ≈ **6,5 días**. Cierre con `/spec-check fase9` y sin PR de documentación aparte (regla 13).
