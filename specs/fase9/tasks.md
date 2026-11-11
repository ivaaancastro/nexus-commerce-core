# Tareas — Fase 9: Pagos con Stripe (test mode) — v2

> ⛔ **Bloqueado hasta aprobar `spec.md`.** Marca cada casilla **al terminarla** (regla 4).
> Cierre: `/spec-check fase9` verde + gates medidos. Sin PR de documentación aparte (regla 13).

## 0 · Preparación
- [x] 0.1 Aprobación de `spec.md` por el usuario (D3 y D17 ya acordadas en conversación; falta el OK final de la spec revisada) — aprobada por el usuario, incluidas D3 y D17
- [x] 0.2 Rama renombrada `fase9` → `feat/stripe-payments` (2026-11-10)
- [x] 0.3 **ADR-0007** + entrada en `docs/adr/README.md`
- [x] 0.4 Descartar la implementación simulada (D15): eliminar `PaymentService`, `RefundService`, `RefundController`, `UserPaymentMethodService`, DTOs de la v1 y sus tests; restaurar `OrderController`, `UserController`, `SecurityConfig`, `OrderService`, `Order`, `OrderRepository` desde `main`; revisar si el `maven-compiler-plugin` añadido en `pom.xml` es necesario (si no, fuera)
- [x] 0.5 Verificar versiones vigentes (`stripe-java`, `@stripe/stripe-js`, `@stripe/react-stripe-js`) frente a React 19 / Next 16 y fijarlas exactas — `stripe-java` 34.1.0, `@stripe/stripe-js` 10.2.1, `@stripe/react-stripe-js` 7.0.1 (peer React <20 ✓); en el SDK 34 el campo es `allowed_payment_method_types`

- [x] 0.6 Entregar al usuario la **guía detallada de Stripe** (alta, claves de test, Stripe CLI, webhook secret) **antes de A.6/D.3**

## A · Backend
- [x] A.1 `pom.xml`: `stripe-java`; surefire fija las 3 claves vacías
- [x] A.2 `V23__stripe_payments.sql` (§4) y entidad `Order` (+`paymentStatus`, `paymentIntentId`, `amountRefunded`); entidad `StripeEvent` — verificada contra PostgreSQL (tras deshacer a mano la V23 antigua de la BD local)
- [x] A.3 `StripeGateway` (interfaz) + `StripeSdkGateway` + modo sin pasarela (R7) + `GET /payments/config`
- [x] A.4 Checkout con tarjeta (R1): T1 `PENDING` → PI tras commit → compensación; `Idempotency-Key` obligatoria; céntimos/moneda (D7)
- [x] A.5 `GET /orders/{n}/payment` (R2), sin persistir ni loguear el `clientSecret`
- [x] A.6 Webhook (R3): firma sobre cuerpo crudo, `stripe_events`, búsqueda por PI o `metadata`, los 3 eventos, `try/catch` del email
- [x] A.7 Reembolso admin (R4) + `RefundRequest` con validación
- [x] A.8 Guardas de la 7.4 (R5) y cancelación del PI
- [x] A.9 Job de expiración (R6)
- [x] A.10 `GlobalExceptionHandler` (`502`/`409`), `SecurityConfig` (webhook + config públicos, antes de `denyAll`), `OrderResponse` (+3 campos) — `SecurityRulesTest` ejecutado
- [x] A.10b Liberación del cupón al cancelar (D17): admin, expiración y compensación; con test de regresión
- [x] A.11 Gate backend: `./mvnw clean test` con PostgreSQL levantado (`docker compose up -d`) — número **medido** — **medido: 520 tests, 0 fallos** (453 → 520, +67)

## B · Tests backend (R11)
- [x] B.1 Servicio de checkout con `StripeGateway` mockeado (incl. compensación e idempotencia)
- [x] B.2 Webhook: firma, duplicado, orden de llegada, pedido cancelado, `charge.refunded`
- [x] B.3 Reembolso total/parcial/errores
- [x] B.4 Guardas 7.4 y expiración, y cupón devuelto al cancelar/expirar (incl. transaccional con `maxUsages = 1`)
- [x] B.5 Transaccionales contra PostgreSQL real (doble entrega concurrente del mismo evento, compensación libera reserva) — ejecutado: PK bajo 8 inserciones simultáneas (gana 1), mismo evento ×6 (confirma 1 vez), 2 reembolsos simultáneos (pasa 1), cupón de 1 uso vuelve a ser canjeable
- [x] B.6 `SecurityRulesTest` (refund, webhook, config) — **R8.3 declarada** para los tests existentes tocados — ejecutado

## C · Frontend
- [x] C.1 Dependencias Stripe + `api.ts` (`getPaymentConfig`, `getOrderPayment`, `refundOrder`) y tipos
- [x] C.2 `errors.ts`: reglas para `card_declined`, `PAYMENT_GATEWAY_ERROR`, `PAYMENT_CONFLICT`
- [x] C.3 `cart/page.tsx`: **eliminar el selector de método** (D3), texto «tarjeta o Apple Pay» y redirección a `/pay` según `paymentMode`; marcar `checkout-payment-grid` como superada
- [x] C.4 `app/orders/[orderNumber]/pay/page.tsx` (Payment Element, `ProtectedRoute`)
- [x] C.5 Ficha del pedido: estado de pago, sondeo y «Completar pago»
- [x] C.6 Admin: bloque «Pago» y «Reembolsar»
- [x] C.7 Tests de frontend (R11) y **R8.3 declarada** (`CartPage.test`, `Api.test`)
- [x] C.8 `tsc` 0 · ESLint 0/0 · build 0 · `test:coverage` EXIT 0 (**medido**: 585 tests, 83,49/78,43/81,02/85,58) ✅; falta **axe** de la ruta de pago (necesita un pedido `REQUIRES_PAYMENT`, es decir, claves de Stripe — se hará en D.2/D.3). Antes: `tsc` 0 · ESLint 0/0 · build 0 · `test:coverage` EXIT 0 — **medido tras el cierre: 586 tests, cobertura 83,49/78,47/81,02/85,58, EXIT 0**; el axe de la ruta de pago va en `payments.spec.ts` (necesita un pedido pendiente)

## D · Verificación end-to-end
- [x] D.1 E2E existentes **31/31 sin tocar `e2e/`** (modo sin pasarela) — **re-medido en el cierre: 31 passed + 4 skipped (`payments.spec.ts`), y Lighthouse (`audit:cwv`) en verde**
- [x] D.2 `payments.spec.ts` condicionado a claves de Stripe — `e2e/payments.spec.ts` (4 pruebas, 2 corridas seguidas verdes; se salta sin `E2E_STRIPE=1`)
- [x] D.3 **Manual con Stripe CLI**: `4242…`, 3DS `4000 0027 6000 3184`, rechazo `4000 0000 0000 9995`, reembolso parcial y total, reentrega de evento — **hecho contra Stripe real (sandbox) el 2026-11-11, ver resultados abajo**
- [ ] D.5 Apple Pay: **diferido a la Fase 10** (requiere HTTPS + dominio verificado en Stripe)
- [x] D.4 Medir en navegador: ficha tras pagar (sondeo), pago con 3DS, `409` de reembolso — hecho en el navegador integrado: sondeo «Confirmando pago…» → «Pagado», 3DS (fallo y éxito), rechazo, redirección de la ruta de pago de un pedido ya pagado

### Resultados de la verificación manual (Stripe sandbox, 2026-11-11)
| Caso | Resultado |
|:--|:--|
| a · Pago `4242…` | ✅ `PENDING/REQUIRES_PAYMENT` → «Confirmando pago…» → `CONFIRMED/PAID`; `payment_intent.succeeded` → `[200]`; evento en `stripe_events`; email «Confirmado» encolado. **El `PaymentIntent` real se creó a la primera: `allowed_payment_method_types: ["card"]` y `metadata.orderNumber` confirmados en Stripe** (el riesgo del SDK 34 queda cerrado) |
| b · 3DS `4000 0027 6000 3184` | ✅ desafío 3DS2 de prueba: «FAIL» → mensaje claro y pedido sigue `PENDING`; reintento + «COMPLETE» → `CONFIRMED/PAID` |
| c · Rechazo `4000 0000 0000 9995` | ✅ «Tu tarjeta no tiene fondos suficientes…», sigue en la página de pago, pedido `PENDING`, botón disponible para reintentar |
| d · Abandono | ✅ pedido sin pagar caducado por el job: `CANCELLED`, stock reservado 11 → 9, **PaymentIntent `canceled` en Stripe**; con cupón de 1 uso: `usageCount 1 → 0`, sin fila en `coupon_usages`, el pedido conserva `coupon_code`/`discount_amount`. (Pedidos envejecidos 31 min con un `UPDATE` sobre los pedidos de prueba) |
| e · Reembolsos desde el panel | ✅ parcial 30,50 (coma decimal + motivo) → «Reembolsado parcialmente»; resto 49,45 con importe vacío → «Reembolsado» 79,95 y sin controles; Stripe emitió `refund.created`/`charge.refunded` → `[200]` |
| f · Cancelar pedido pagado | ✅ `409 ORDER_CONFLICT` «reembolsa el pedido antes de cancelarlo»; reembolso de 999 → `400`; de −5 → `400`; de un pedido sin cobro online → `409 PAYMENT_CONFLICT` |
| g · Evento duplicado | ✅ reentrega **firmada** del mismo `event.id` (×2) → `200` sin nuevo `stripe_events` ni email. *(Reenvío firmado con el secreto del `.env`, no con `stripe events resend`.)* |
| h · Firma falsa | ✅ firma falsa, otro secreto, sin cabecera y de hace 1 h → `400` genérico y 0 efectos |

**Segunda ronda de verificación (cierre «perfecto», 2026-11-11)** — hallazgos corregidos y medidos:
| Hallazgo | Corrección | Evidencia |
|:--|:--|:--|
| El mercado **CH/CHF** daría `502` (solo se admitían EUR/GBP/USD) | `StripeAmounts` admite CHF | Vivo: `ES 7995 eur · UK 7999 gbp · US 8495 usd · CH 11900 chf`, todos `card` |
| Repetir un checkout cuyo pedido ya estaba cancelado creaba un PaymentIntent para un pedido sin stock | `CheckoutService` exige `PENDING` | 2 tests nuevos |
| `GET /orders/{n}/payment` devolvía el `clientSecret` de un pedido caducado (PI anulado) | exige `PENDING` ⇒ `409` | test nuevo |
| El **dashboard** sumaba pedidos sin pagar y no restaba reembolsos | ingresos = `total − reembolsado`, sin `REQUIRES_PAYMENT`/`REFUNDED` | test sobre PostgreSQL real + vivo: API = SQL independiente (2748,35 EUR · 33 pedidos) |
| El panel decía «Pendiente de pago» en un pedido cancelado | «Sin pagar (pedido cancelado)» | test nuevo |
| La ficha decía «este establecimiento no procesa devoluciones de pago» | copy corregido | — |
| E2E tecleando la tarjeta: **hCaptcha** de Stripe bloquea al navegador automatizado | el PaymentIntent se confirma por API (`pm_card_*`) | 4/4 verdes ×2 |
| Pago **tardío** sobre pedido caducado (vivo) | sigue `CANCELLED` + `PAID`, sin email; el admin lo reembolsa → `REFUNDED` | vivo |
| Cancelar un **pendiente** desde el panel (vivo) | PaymentIntent `canceled` en Stripe | vivo + E2E |
| Pantalla de pago en móvil | sin desborde horizontal (375 = 375) | medido |

**Revisión de código independiente (nivel alto, 8 hallazgos) — todos tratados y re-medidos (backend 527, frontend 590, E2E 31/31 + 4/4 de pago, Lighthouse en verde):**
| Hallazgo | Resolución |
|:--|:--|
| `charge.refunded` retrasado podía **bajar** el reembolso | se toma `max(local, evento)`; test |
| `charge.refunded` adelantado al cobro se descartaba y quedaba «procesado» | se rechaza (500, rollback del registro) para que Stripe reintente; test |
| Compensación dejaba un PaymentIntent huérfano si fallaba el guardado del id | se anula; test |
| Pago tardío sin señal para el admin | aviso en el panel «cancelado con dinero cobrado»; tests |
| `orderCount` del dashboard ≠ pedidos con ingreso | aclarado en el DTO (la tarjeta ya dice «Pedidos no cancelados») |
| 502 decía «No se ha cobrado nada» también en reembolsos | mensaje neutro; el carrito añade la frase donde sí es cierta; tests |
| La pantalla de pago mostraba el mensaje crudo de Stripe | solo `card_error`/`validation_error`; test |
| `GET /orders/{n}` sin comprobación de propietario | **preexistente y fuera de la Fase 9**: se deja y se recomienda como tarea aparte |

**No verificado en vivo**: solo **Apple Pay** (HTTPS + dominio verificado → Fase 10). El 3DS y la tarjeta tecleada se validaron a mano (primera ronda).

## E · Cierre
- [ ] E.1 `/spec-check fase9`
- [x] E.2 README (variables, Stripe CLI, tarjetas de prueba, `paymentMode`), `CHANGELOG`, bloque de estado en `AGENTS.md` y `MEMORY.md` **dentro de la PR**, sin números de PR ni SHA — hechos en README, CHANGELOG, `AGENTS.md` y `MEMORY.md`; el bloque de estado dice «pendiente de verificación manual» y habrá que actualizarlo al cerrar D.3
- [ ] E.3 Commits y PR (**preguntar antes**)
