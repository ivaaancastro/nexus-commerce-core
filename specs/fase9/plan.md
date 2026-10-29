# Fase 9 — Pagos (Stripe PSP) 🔴 Crítica

> **Objetivo**: Integrar pasarela de pagos Stripe en modo test para habilitar checkout real.
> **Producto**: Nexus Commerce Core — ecommerce completo listo para pilotaje.
> **Referencia**: Decisión tomada en planning 2026-10-29 después de auditoría de brechas críticas (sin PSP = checkout teatro).

---

## 1. Decisiones de Diseño

| Decisión | Justificación |
|----------|---------------|
| **Stripe test mode** (no live) | El producto no se venderá en producción hasta tener PSP operativa; el modo test permite validar el flujo completo sin riesgo real. |
| **PaymentIntent + SetupIntent** | `PaymentIntent` para checkout único; `SetupIntent` para guardar métodos de pago en wallet usuario. |
| **Webhooks críticos**: `payment_intent.succeeded`, `payment_intent.failed`, `charge.refunded` | Sincronización asíncrona de estado de pedido → `CONFIRMED`/`SHIPPED`/`REFUNDED`. Usando `PESSIMISTIC_WRITE` en el servicio. |
| **Idempotencia con `Idempotency-Key`** | Cabecera `Idempotency-Key` UUID en checkout; si la clave ya existe, devolver orden existente sin duplicar reservas ni cargos. |
| **Wallet en perfil usuario** | `Customer` + `PaymentMethod` attach/detach desde el perfil; métodos guardados visibles y usable en futuros checkouts. |
| **Reembolsos parciales/totales** | Admin puede iniciar refund desde panel pedido → webhook `charge.refunded` actualiza estado a `REFUNDED`. |
| **Modo sandbox visible en demo** (Fase 14) | El admin ve "Stripe test mode active" en el dashboard de demo; keys live nunca se exponen en frontend. |

---

## 2. Ámbito de la Fase 9

### Backend (Spring Boot 3.4 / Java 21)

| Módulo | Endpoints | Descripción |
|--------|-----------|-------------|
| `POST /api/v1/orders/checkout` | Crear PaymentIntent, reservar stock, crear orden con snapshot financiero |
| `POST /api/v1/orders/{orderNumber}/refund` | Iniciar refund (parcial/total) — requiere `@Transactional` |
| `GET /api/v1/orders/{orderNumber}` | Incluir `paymentIntentId`, `paymentMethod`, `amountRefunded`, `refundStatus` |
| `GET /api/v1/payment/methods/user` | Listar PaymentMethod attachados al Customer del usuario |
| `SecurityConfig` | Sin cambios (hereda `hasRole("ADMIN")` de la 7.1) — los endpoints de pago están protegidos |

### Modelos nuevos/extendidos

| Clase | Campos nuevos |
|-------|--------------|
| `PaymentIntentRequest` | `amount` (BigDecimal), `currency` (String), `metadata` (Map), `idempotencyKey` (String) |
| `PaymentIntentResponse` | `id`, `clientSecret`, `status`, `amount`, `currency`, `created`, `chargeId` |
| `RefundRequest` | `amount` (BigDecimal, opcional — si null, reembolso total), `reason` (String) |
| `RefundResponse` | `id`, `amount`, `status`, `created`, `paymentIntentId` |
| `PaymentMethodResponse` | `id`, `type`, `brand`, `last4`, `expMonth`, `expYear`, `customerId` |
| `UserPaymentMethod` (join/table) | `userId`, `paymentMethodId`, `isDefault` |

### Servicios nuevos

| Servicio | Método clave |
|----------|--------------|
| `PaymentService` | `createPaymentIntent(PaymentIntentRequest)` — usa Stripe SDK test mode |
| `RefundService` | `initiateRefund(RefundRequest)` — crea refund en Stripe, actualiza pedido |
| `UserPaymentMethodService` | `attachCustomerMethod(String userId, String paymentMethodId)`, `setDefault(String userId, String paymentMethodId)` |

### Tests

- `PaymentServiceTest`: mock de Stripe, test crear PaymentIntent, test idempotencia
- `RefundServiceTest`: mock de Stripe, test refund parcial y total, test webhook payload
- `OrderServiceTest`: integración con mock `CouponService` (como ya hizo en V5), test checkout con PaymentIntent

---

## 3. Criterios de Aceptación (Definition of Done)

| # | Criterio | Medición |
|---|----------|----------|
| **9.1** | `POST /api/v1/orders/checkout` crea PaymentIntent en Stripe test mode y retorna `client_secret` | Response 200 + `clientSecret` presente |
| **9.2** | Al confirmar PaymentIntent en frontend, el pedido pasa a estado `CONFIRMED` y el stock se reserva atómicamente | Estado pedido = `CONFIRMED`, stock `-= quantity` en BD |
| **9.3** | `POST /api/v1/orders/{orderNumber}/refund` con `amount` parcial crea refund en Stripe y actualiza pedido a `REFUNDED` | Stripe refund creado + `refundStatus = REFUNDED` en BD |
| **9.4** | Métodos de pago guardados en wallet usuario: `GET /api/v1/payment/methods/user` lista `PaymentMethodResponse` | Response 200 + lista de métodos (vacía si ninguno) |
| **9.5** | Petición idéntica con misma `Idempotency-Key` no duplica reserva ni cargo | Mismo `orderNumber` retornado, `200` sin crear nueva fila en BD |
| **9.6** | Tests: `PaymentServiceTest` 2/2 passing, `RefundServiceTest` 2/2 passing, `OrderServiceTest` checkout con PaymentIntent mock 1/1 passing | Cobertura verde |

---

## 4. Dependencias y Orden

| Fase | Depende de | Por qué |
|------|------------|---------|
| **9** | Fase 8 (operación interna) | Health check y métricas deben estar operativos antes de añadir lógica de pago |
| **9** | Fase 5 (gestión de usuarios) | El usuario ya debe estar registrado/verificado antes de hacer checkout |
| **9 → 10** | Fase 9 completa antes de Envíos | El tracking de envíos requiere order en estado `CONFIRMED` (post-checkout) |
| **9 → 11** | Fase 9 completa antes de Devoluciones | Los reembolsos dependen de la infraestructura de PaymentIntent + webhooks. |

---

## 5. Risks y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| **Stripe API changes** | Media | Usar Stripe SDK v34.x con compatibilidad hacia atrás; hacer `mock` en tests por si la API cambia. |
| **Race condition en idempotencia** | Baja | `Idempotency-Key` único + `WHERE clave = ?` en BD + `PESSIMISTIC_WRITE` en servicio. |
| **Webhook no recibido** | Media | Stripe retry automático (máx 3 intentos con backoff exponencial); idempotencia en el servicio como última línea de defensa. |
| **Sandbox vs Live confusion** | Media | Las keys de test viven solo en `backend/.env`; nunca se commitean. El modo sandbox es visible en demo (Fase 14) pero no en producción. |

---

## 6. Checklist de Tareas (para tasks.md)

Este es el esquema; las tareas específicas se crearán en `specs/fase9/tasks.md` después de la aprobación del plan.

- [ ] 9.1 — Implementar `POST /api/v1/orders/checkout` con PaymentIntent Stripe test mode
- [ ] 9.2 — Implementar `POST /api/v1/orders/{orderNumber}/refund` con webhook `charge.refunded`
- [ ] 9.3 — Añadir modelo `PaymentIntentRequest/Response`, `RefundRequest/Response`, `PaymentMethodResponse`
- [ ] 9.4 — Implementar wallet usuario: `UserPaymentMethod` servicio + endpoints `GET /payment/methods/user`
- [ ] 9.5 — Añadir cabecera `Idempotency-Key` en checkout frontend y validación backend (única línea de defensa + BD)
- [ ] 9.6 — Crear `PaymentServiceTest` (mock Stripe): crear PaymentIntent, reintentos, idempotencia
- [ ] 9.7 — Crear `RefundServiceTest` (mock Stripe): refund parcial y total, webhook payload
- [ ] 9.8 — Actualizar `OrderServiceTest` con mock `CouponService` y checkout con PaymentIntent
- [ ] 9.9 — Actualizar `SecurityRulesTest` con nuevas 401/403 reglas para endpoints de pago
- [ ] 9.10 — Verificar `/spec-check fase9` pasa con los nuevos tests y cobertura mantenida

---

**Fin del plan de la Fase 9.**

*Próximo paso: aprobación por parte del usuario → creación de `specs/fase9/spec.md` y `specs/fase9/tasks.md` → implementación guiada por tasks.*