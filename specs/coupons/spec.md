# Spec — V5: Sistema de cupones promocionales

> Feature V5 dentro del bloque V1–V6 (mejoras de vitrina).
> Rama: `feat/coupons`.
> Estado: plan aprobado, spec pendiente de aprobación usuario.
> Aprobación requerida antes de implementar código.

---

## 1. Contexto y objetivos

Permitir a administradores crear códigos promocionales y a clientes aplicarlos en carrito / checkout para obtener descuentos porcentuales o fijos con restricciones de validez y uso.

Objetivos medibles:
- CRUD cupones en `/admin/coupons`.
- Validación en tiempo real en carrito: `POST /api/v1/coupons/validate`.
- Aplicación atómica en checkout: descuento persistido en `Order` y registro en `coupon_usages`.
- Concurrencia segura: sin over-redemption (PESSIMISTIC_WRITE).
- UX coherente con el estilo editorial del proyecto.

---

## 2. Requisitos funcionales

### 2.1. Modelo de dominio

**Coupon**
- `id` Long PK autogenerado.
- `code` VARCHAR(20) UNIQUE NOT NULL, pattern `^[A-Z0-9-]+$`, mayúsculas.
- `type` ENUM STRING {PERCENTAGE, FIXED}.
- `value` DECIMAL(10,2) NOT NULL >= 0.01.
  - PERCENTAGE: 1-100.
  - FIXED: importe en la moneda del mercado del pedido (sin conversión, snapshot en pedido).
- `minOrderAmount` DECIMAL(10,2) nullable. Pedido debe ser >= este valor para aplicar.
- `maxDiscountAmount` DECIMAL(10,2) nullable. Tope del descuento calculado.
- `validFrom` TIMESTAMPTZ NOT NULL.
- `validUntil` TIMESTAMPTZ NOT NULL. Debe ser > validFrom.
- `usageLimit` INTEGER DEFAULT 0. 0 = ilimitado.
- `usageCount` INTEGER DEFAULT 0. Incremento atómico.
- `perUserLimit` INTEGER DEFAULT 0. 0 = ilimitado.
- `active` BOOLEAN DEFAULT TRUE.
- `createdAt`, `updatedAt`.

**CouponUsage**
- `id` PK.
- `coupon_id` FK → coupons ON DELETE CASCADE.
- `user_id` FK → users ON DELETE CASCADE.
- `order_id` FK → orders ON DELETE SET NULL.
- `discountAmount` DECIMAL(10,2) NOT NULL.
- `usedAt` TIMESTAMPTZ NOT NULL DEFAULT NOW().

**Order**
- Nuevo campo `coupon_code VARCHAR(20)`.
- Nuevo campo `coupon_id BIGINT` FK nullable a coupons ON DELETE SET NULL.
- Nuevo campo `discount_amount DECIMAL(10,2) DEFAULT 0`.

Migraciones Flyway:
- V20__coupons.sql crea `coupons` y `coupon_usages`.
- V21__orders_coupon_fields.sql añade campos a `orders`.

### 2.2. Validaciones backend

1. Código único. Código inmutable tras creación.
2. Fechas: `validFrom <= now <= validUntil` para aplicar.
3. Activo: `active = true`.
4. Límites: `usageCount < usageLimit` si `usageLimit > 0`.
5. Límite por usuario: `COUNT(coupon_usages WHERE coupon_id AND user_id) < perUserLimit` si `perUserLimit > 0`.
6. Importe mínimo: `subtotal >= minOrderAmount` si definido.
7. Cálculo descuento:
   - PERCENTAGE: `discount = subtotal * value / 100`. Aplicar `maxDiscountAmount` si definido. `discount = min(discount, maxDiscountAmount)`.
   - FIXED: `discount = value`. Tope `min(value, subtotal, maxDiscountAmount?)`.
8. Descuento nunca excede subtotal. `discount >= 0`.

Excepciones de dominio mapeadas a HTTP:
- 409 CouponCodeExistsException
- 404 CouponNotFoundException
- 400 CouponInactiveException / Expired / NotYetValid
- 400 CouponUsageLimitExceededException / PerUserLimitExceeded
- 400 CouponMinOrderNotMetException
- 409 CouponHasUsagesException al borrar.

### 2.3. API

#### Admin

`GET /api/v1/admin/coupons?page=0&size=20[&code=&type=&active]`
- 200 AdminCouponPageResponse
- Auth: ADMIN.

`POST /api/v1/admin/coupons`
- Body CouponCreateRequest.
- 201 CouponDetailResponse.

`GET /api/v1/admin/coupons/{id}`
- 200 CouponDetailResponse con últimos 50 usos.

`PUT /api/v1/admin/coupons/{id}`
- Body CouponUpdateRequest (code no mutable).
- 200 CouponDetailResponse.

`DELETE /api/v1/admin/coupons/{id}`
- 204 si usageCount = 0; 409 si ya usado.

#### Cliente

`POST /api/v1/coupons/validate`
- Auth: USER/ADMIN (session).
- Body: `{ code: string, subtotal: number }` (subtotal en menor unidad del mercado).
- 200 CouponValidationResponse
  - `valid: boolean`
  - `message: string`
  - `discountAmount: number`
  - `coupon: CouponSummary`

#### Checkout integración

`POST /api/v1/orders/checkout`
- `CheckoutRequest` incluye `couponCode?: string`.
- `OrderService.processCheckout`:
  - Revalida cupón bajo PESSIMISTIC_WRITE.
  - Calcula descuento.
  - Persiste order con `coupon_code`, `coupon_id`, `discount_amount`.
  - Incrementa `coupon.usageCount`.
  - Inserta `CouponUsage`.
  - Idempotencia preservada.

`OrderResponse` incluye `discountAmount`, `totalAmount`.

### 2.4. Frontend

Tipos TS:
- `CouponType = 'PERCENTAGE' | 'FIXED'`
- `CouponSummary`, `CouponValidationResponse`, `CouponValidateRequest`.

API client:
- `api.validateCoupon(data: CouponValidateRequest): Promise<CouponValidationResponse>`

Componentes:
- **CouponInput** `components/CouponInput.tsx`
  - Input texto con debounce 500 ms.
  - Llama a `validate`.
  - Muestra mensaje valid/invalid.
  - Estilo: `text-neutral-900` input, focus ring neutral-900.
- **CouponSummary** en carrito/checkout muestra cupón aplicado y botón quitar.
- **AdminCouponForm** con react-hook-form + zod.
- **AdminCouponsPage** tabla paginada, crear/editar/eliminar.

Estado global:
- `CartContext` añade `couponCode?: string` y `couponDiscount?: number`.
- Integración en `/cart` y `/checkout`.

### 2.5. Reglas de negocio críticas

- La validación en frontend es solo preview; la fuente de verdad es la validación en checkout bajo transacción.
- Un mismo cupón puede usarse múltiples veces por usuario si `perUserLimit = 0`.
- `usageCount` y `CouponUsage` deben quedar consistentes en transacción.
- El descuento se calcula sobre subtotal antes de impuestos? Según decisiones de pricing existentes: descuento sobre subtotal sin impuestos, impuestos calculados sobre base reducida. (Ver spec pricing existente).
- No aplicar cupón si pedido ya con cupón. El checkout puede sobrescribir? Decisión: un pedido solo un cupón.

---

## 3. Criterios de aceptación

### Backend
- [ ] Migraciones V20 y V21 aplican sin error.
- [ ] `POST /admin/coupons` crea cupón y valida constraints.
- [ ] `GET /admin/coupons` lista paginado con filtros.
- [ ] `PUT /admin/coupons/{id}` actualiza sin cambiar code.
- [ ] `DELETE /admin/coupons/{id}` devuelve 409 si usageCount > 0.
- [ ] `POST /coupons/validate` devuelve valid=false con mensajes correctos para: inactivo, expirado, no válido aún, límite global, límite usuario, mínimo no alcanzado.
- [ ] Cálculo descuento correcto para PERCENTAGE y FIXED con maxDiscountAmount.
- [ ] Checkout con cupón válido persiste descuento, incrementa usageCount e inserta CouponUsage dentro de transacción.
- [ ] Concurrencia: dos peticiones simultáneas con mismo cupón al límite solo permiten el número permitido.
- [ ] Idempotencia: mismo idempotencyKey + mismo cupón → mismo descuento, sin duplicar uso.

### Frontend
- [ ] `CouponInput` debounce 500 ms, no dispara con <3 caracteres.
- [ ] Muestra mensaje y descuento tras validación.
- [ ] `CartContext` actualiza `couponCode` tras validación exitosa.
- [ ] En `/cart` se muestra `CouponSummary` con opción quitar.
- [ ] En checkout, el total refleja descuento.
- [ ] Panel admin lista CRUD funcional.
- [ ] Accesibilidad axe pasa en /cart, /checkout, /admin/coupons.
- [ ] `tsc` 0, `lint` 0, `build` 0.

### Tests
- [ ] `CouponServiceTest` cubre validaciones y canje atómico.
- [ ] `CouponControllerTest` cubre endpoints admin y validate.
- [ ] `CouponInput.test.tsx` cubre debounce y estados.
- [ ] E2E flujo carrito → cupón → checkout → pedido con descuento.

---

## 4. Non-functional

- BigDecimal con HALF_UP para dinero.
- @Transactional en servicios de escritura.
- Sin exponer entidades JPA.
- Logs informativos al aplicar cupón: "Cupón {code} aplicado a orden {number}. Descuento: {amount}".
- Cumplir umbrales de cobertura existentes.

---

## 5. Dependencias

- V4 Reviews mergeado.
- Backend Spring Boot 3.4, Java 21, PostgreSQL.
- Frontend Next.js 16, TypeScript.

---

Aprobación requerida antes de implementar.
