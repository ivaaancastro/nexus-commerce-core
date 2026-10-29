# Tareas — Fase 9: Pagos (Stripe PSP) 🔴 Críticas

> **Orden de ejecución**: 9 → 10 → 11 → 12 → 13 → 14 → 15
> **Hecho cuándo**: `/spec-check fase9` verde + cobertura >= umbrales congelados

## ✅ Tareas Pendientes (checklist)

| # | Tarea | Componente | Hecho |
|---|-------|------------|-------|
| **9.1** | Implementar `POST /api/v1/orders/checkout` con PaymentIntent Stripe test mode | `PaymentService`, `OrderController` | [ ] |
| **9.2** | Implementar `POST /api/v1/orders/{orderNumber}/refund` con webhook `charge.refunded` | `RefundService`, `OrderService`, webhook configurador | [ ] |
| **9.3** | Añadir modelos: `PaymentIntentRequest/Response`, `RefundRequest/Response`, `PaymentMethodResponse` | `dto/` package, `record` inmutables | [ ] |
| **9.4** | Implementar wallet usuario: `UserPaymentMethod` servicio + endpoints `GET /payment/methods/user` | `UserPaymentMethodService`, `UserController` | [ ] |
| **9.5** | Añadir cabecera `Idempotency-Key` en checkout frontend y validación backend (única línea de defensa + BD) | `api.ts` `handleResponse()`, `OrderService` `@Lock(PESSIMISTIC_WRITE)` | [ ] |
| **9.6** | Crear `PaymentServiceTest` (mock Stripe): crear PaymentIntent, reintentos, idempotencia | `src/test/java/.../PaymentServiceTest` | [ ] |
| **9.7** | Crear `RefundServiceTest` (mock Stripe): refund parcial/total, webhook payload | `src/test/java/.../RefundServiceTest` | [ ] |
| **9.8** | Actualizar `OrderServiceTest` con mock `CouponService` y checkout con PaymentIntent | Ya existe mock `CouponService` (V5) — reutilizar patrón | [ ] |
| **9.9** | Actualizar `SecurityRulesTest` con nuevas reglas 401/403 para endpoints de pago | Nuevos endpoints bajo `hasRole("ADMIN")` | [ ] |
| **9.10** | Verificar `/spec-check fase9` pasa con los nuevos tests + cobertura mantenida | `npx vitest run --project backend` + `JaCoCo report` | [ ] |

## 📊 Gates de Verificación

| Gate | Comando | Éxito si |
|------|---------|----------|
| **Cobertura backend** | `./mvnw jacoco:report` + revisar `target/site/jacoco/index.html` | >= umbrales congelados (ver `AGENTS.md`) |
| **Cobertura frontend** | `npm run test:coverage` en `frontend/` | >= umbrales congelados (77/76/74/79) |
| **`/spec-check fase9`** | (pendiente de implementar `spec-check` para fase 9) | Verde — todos los tests nuevos pasan |
| **ESLint** | `cd frontend && npx eslint .` | 0 errores, 0 warnings |
| **TypeScript** | `cd frontend && npx tsc --noEmit` | 0 errores |
| **Build** | `cd frontend && npm run build` | 0 errores |

## ⚠️ Notas y Consideraciones

- **Stripe keys** (`STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`) van en `backend/.env` — **nunca versionar**.
- **Modo sandbox** es el modo por defecto del Stripe SDK cuando se usa la key de test; no se necesita configuración adicional.
- **Idempotencia**: la cabecera `Idempotency-Key` debe ser UUID v4 generado en frontend; si el backend recibe una clave ya usada, debe retornar la orden existente sin efecto secundario.
- **Webhooks**: configurar en el dashboard de Stripe el endpoint `https://<dominio>/api/v1/webhooks/stripe` (después en producción); en test mode, usar el endpoint que Stripe provee para reenviar eventos.
- **Reembolsos**: el admin puede iniciar refund desde el panel de pedido; el webhook `charge.refunded` actualiza `refund_status` y `amount_refunded` en la BD. Si el usuario intenta refundar dos veces la misma orden, el segundo debe ser idempotente (Stripe lo maneja con el mismo `charge.id` + `refund.id`).
- **Wallet**: los métodos de pago guardados se asocian al `Customer` de Stripe creado al primer checkout. El usuario puede ver y seleccionar métodos guardados en futuros checkouts.
- **Seguridad**: todos los endpoints de pago están protegidos con `hasRole("ADMIN")` + `hasRole("USER")` para el checkout del usuario logueado. El checkout de invitado está fuera de scope para esta fase.

---

*Ultima actualización: 2026-10-29 — Fase 9 plan approved, ready for spec implementation.*