# ADR-0007: Pagos con Stripe — Gateway Aislado y Webhook como Fuente de Verdad

* **Estado:** Aprobado
* **Fecha:** 2026-11-10
* **Decisores:** Equipo Nexus Core
* **Spec:** `specs/fase9/` (plan D1–D17, spec R1–R11)

---

## 1. Contexto y Problema

Hasta la Fase 8 el pedido nacía `CONFIRMED` **sin cobrar**: `PaymentMethod` era un dato declarativo y el checkout no hablaba con ninguna pasarela. Una primera versión de la Fase 9 simuló Stripe (IDs inventados, sin SDK, sin webhook) y se descartó por fingir un cobro que no existía.

Introducir un cobro real cambia la arquitectura de tres maneras:

1. **Dependencia externa con red** dentro de un flujo que reserva stock con `PESSIMISTIC_WRITE` (ADR-0001, ADR-0003).
2. **Confirmación asíncrona**: el resultado de un pago llega por webhook, no en la respuesta del checkout.
3. **Nuevo estado a conciliar** (el dinero) junto al del pedido, con reintentos de red, entregas duplicadas y condiciones de carrera.

---

## 2. Decisiones Tomadas

### 2.1 `StripeGateway`: toda la red detrás de una interfaz
* **Decisión:** el dominio habla con la interfaz `StripeGateway`; `StripeSdkGateway` (stripe-java) es la única clase que toca el SDK. Importes en unidades menores (`StripeAmounts`, sin `double`, sólo monedas de 2 decimales).
* **Razón:** tests deterministas sin red ni mocks de métodos estáticos; un único punto donde se traducen los errores de Stripe a `PaymentGatewayException` (`502`).

### 2.2 El webhook es la fuente de verdad del cobro
* **Decisión:** el pedido pasa a `CONFIRMED` **sólo** con `payment_intent.succeeded` verificado por firma (`Webhook.constructEvent` sobre el cuerpo **crudo**). La redirección del navegador no confirma nada; la ficha del pedido sondea hasta ver el cambio.
* **Razón:** el cliente puede cerrar la pestaña tras pagar o falsear la redirección.

### 2.3 Nunca una llamada de red con bloqueos de inventario abiertos
* **Decisión:** T1 (reserva + pedido `PENDING` + cupón) hace commit; **después** `CheckoutService` crea el PaymentIntent con la `Idempotency-Key` del cliente como idempotency key de Stripe. Si falla: compensación (pedido cancelado, stock y cupón liberados) y `502`.
* **Alternativa descartada:** crear el PaymentIntent dentro de T1 — retiene `PESSIMISTIC_WRITE` sobre `stock_items` durante la latencia de Stripe.

### 2.4 Idempotencia en capas
* Cabecera `Idempotency-Key` obligatoria (§4.3 de AGENTS.md) + `UNIQUE` en BD + idempotency key de Stripe. El webhook se registra con `INSERT … ON CONFLICT DO NOTHING` en `stripe_events` **en la misma transacción** que su efecto: PK como última línea de defensa, sin carrera «existe/guarda».

### 2.4b El `clientSecret` no se persiste
* Se recupera de Stripe cuando el dueño del pedido va a pagar (`GET /orders/{n}/payment`); no está en BD, ni en logs, ni en el cuerpo del checkout.

### 2.5 Coherencia con la máquina de estados de la 7.4
* El admin no puede confirmar a mano un pedido de tarjeta sin pagar, ni cancelar uno pagado sin reembolsarlo; cancelar anula el PaymentIntent. Un job caduca los pendientes a los 30 min. **Toda cancelación devuelve el uso del cupón** (idempotente, con el mismo bloqueo del canje).

### 2.6 «Modo sin pasarela» y sólo claves de test
* Sin `STRIPE_SECRET_KEY` la app arranca y se comporta como antes de la fase (patrón `searchMode`); los tests la fijan vacía. Una clave `sk_live_` hace fallar el arranque: el proyecto es un portfolio y nunca cobra de verdad.

---

## 3. Alternativas Descartadas

| Alternativa | Motivo |
| :--- | :--- |
| Confirmar el pedido en el `return_url` del navegador | Falseable y frágil ante cierres de pestaña |
| Guardar `clientSecret` en BD | Secreto innecesariamente persistido; Stripe lo devuelve al pedirlo |
| Dejar Bizum/PayPal/transferencia «declarativos» | Decisión del usuario: sólo tarjeta y Apple Pay (ambos por el Payment Element) |
| Reembolso incremental por webhook | Doble suma si llegan webhook y respuesta; se fija el valor **absoluto** del cargo |

---

## 4. Consecuencias

* **Positivas:** cobro real en test mode, concurrencia y reentregas cubiertas (tests contra PostgreSQL real), sin secretos en el repo, CI sin Stripe.
* **Negativas / límites:** Apple Pay exige HTTPS y dominio verificado (no se prueba en `localhost`; Fase 10); reembolsar no repone stock ni cambia el estado del pedido; un pago tardío sobre un pedido caducado queda `PAID` + `CANCELLED` y exige reembolso manual (se registra `error` en el log).
