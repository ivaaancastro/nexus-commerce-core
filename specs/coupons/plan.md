# Plan — V5: Sistema de cupones promocionales

> Feature: **V5 cupones** — dentro del bloque V1–V6 (mejoras de vitrina).
> Rama: `feat/coupons` (desde `main` post-merge V4).
> Estimación: **M** (1–2 sprints).

---

## 1. Objetivo

Permitir a los administradores crear códigos promocionales (cupones) que los clientes puedan aplicar en el **carrito / checkout** para obtener descuentos:
- Porcentaje (ej. 10 %) o importe fijo (ej. 5 €).
- Con condiciones: mínimo de pedido, máximo de descuento, fecha inicio/fin, límite de usos global y por usuario.
- Validación en tiempo real en el frontend y aplicación atómica en el backend durante el checkout.

---

## 2. Alcance (In / Out)

| In | Out |
|----|-----|
| CRUD cupones en panel admin (`/admin/coupons`) | Cupones personalizados por usuario (segmentación) |
| Validación cupón en carrito (frontend + backend) | Cupones de "regalo" / saldo precargado |
| Aplicación en checkout (descuento en `Order`) | Reglas complejas: "compra 2 lleva 1", categorías específicas |
| Historial de usos por cupón | API pública de cupones (solo validación en checkout) |
| Tests unitarios + integración | Notificaciones push/email de cupones |

---

## 3. Decisiones de diseño (previas a la spec)

| Tema | Decisión | Razón |
|------|----------|-------|
| **Modelo descuento** | `type: PERCENTAGE \| FIXED` + `value` (BigDecimal) | Flexible, cubre ambos casos habituales |
| **Validación** | Endpoint `POST /api/v1/coupons/validate` (auth) → devuelve `CouponValidationResponse` con `discountAmount` calculado | Frontend muestra preview antes de confirmar pedido |
| **Aplicación en checkout** | El `CheckoutRequest` incluye `couponCode?`; servicio valida, calcula descuento y lo persiste en `Order.couponCode` + `Order.discountAmount` | Idempotencia: el mismo cupón + misma orden = mismo descuento |
| **Concurrencia** | `Coupon.usageCount` + `CouponUsage` (tabla intermedia) con `PESSIMISTIC_WRITE` al canjear | Evita over-redemption |
| **Frontend** | Input cupón en `/cart` (debounce 500 ms) + toast con resultado; en checkout muestra resumen aplicado | UX fluida, sin recarga |
| **Admin** | Tabla paginada + modal crear/editar + botón "Duplicar" | Patrón consistente con `/admin/products` |
| **Migración** | `V20__coupons.sql` (Flyway) | Secuencial tras V19 |

---

## 4. Endpoints propuestos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/v1/admin/coupons` | ADMIN | Listado paginado + filtros |
| `POST` | `/api/v1/admin/coupons` | ADMIN | Crear cupón |
| `GET` | `/api/v1/admin/coupons/{id}` | ADMIN | Detalle + historial usos |
| `PUT` | `/api/v1/admin/coupons/{id}` | ADMIN | Actualizar (no code) |
| `DELETE` | `/api/v1/admin/coupons/{id}` | ADMIN | Borrar (si `usageCount=0`) |
| `POST` | `/api/v1/coupons/validate` | USER/ADMIN | Validar código → `CouponValidationResponse` |

---

## 5. DTOs clave (backend)

```java
// Request admin
record CouponCreateRequest(
    @NotBlank @Size(max=20) @Pattern(regexp = "^[A-Z0-9-]+$") String code,
    @NotNull DiscountType type,           // PERCENTAGE | FIXED
    @NotNull @DecimalMin("0.01") BigDecimal value,
    @DecimalMin("0") BigDecimal minOrderAmount,
    BigDecimal maxDiscountAmount,
    @FutureOrPresent OffsetDateTime validFrom,
    @Future OffsetDateTime validUntil,
    int usageLimit,                       // 0 = ilimitado
    int perUserLimit                      // 0 = ilimitado
)

// Response validación
record CouponValidationResponse(
    boolean valid,
    String message,                       // "Cupón aplicado" / "Cupón expirado" / ...
    BigDecimal discountAmount,            // calculado sobre subtotal actual
    CouponSummaryResponse coupon          // datos del cupón para UI
)
```

---

## 6. Frontend — Componentes nuevos

| Componente | Ubicación | Responsabilidad |
|------------|-----------|-----------------|
| `CouponInput` | `components/CouponInput.tsx` | Input + debounce + llamada `validate` + toast |
| `CouponSummary` | `components/CouponSummary.tsx` | Muestra cupón aplicado + botón quitar |
| `AdminCouponForm` | `components/admin/AdminCouponForm.tsx` | Modal crear/editar (react-hook-form + zod) |
| `AdminCouponsPage` | `app/admin/coupons/page.tsx` | Tabla + paginación + acciones |

---

## 7. Integración checkout

1. Carrito: usuario introduce código → `validate` → si OK, guarda en `CartContext.couponCode`.
2. Checkout: `CheckoutRequest` lleva `couponCode`.
3. `OrderService.processCheckout`:
   - Valida cupón de nuevo (fuente de verdad).
   - Calcula `discountAmount` sobre `subtotal`.
   - Persiste en `Order`: `couponCode`, `couponId`, `discountAmount`.
   - Incrementa `Coupon.usageCount` + inserta `CouponUsage` (transacción única).
4. Respuesta `OrderResponse` incluye `discountAmount` y `totalAmount = subtotal - discountAmount + shipping`.

---

## 8. Tests objetivo

- **Backend**: `CouponServiceTest` (validación, límites, concurrencia), `CouponControllerTest` (admin + validate).
- **Frontend**: `CouponInput.test.tsx` (debounce, estados), `AdminCouponsPage.test.tsx` (CRUD).
- **E2E**: Flujo carrito → aplica cupón → checkout → order con descuento.

---

## 9. Gates de calidad (mismos umbrales)

- Backend: `./mvnw test` EXIT 0, JaCoCo ≥ actual.
- Frontend: `npm run test:coverage` EXIT 0, `tsc` 0, `lint` 0, `build` 0.
- Accesibilidad: axe en `/cart`, `/checkout`, `/admin/coupons`.

---

## 10. Próximos pasos

1. **Escribir `spec.md`** con requisitos funcionales detallados (API, modelo, validaciones).
2. **Escribir `tasks.md`** checklist implementación.
3. **Aprobación usuario** → implementación.","path":"/Users/ivan/nexus-commerce-core/specs/coupons/plan.md"}