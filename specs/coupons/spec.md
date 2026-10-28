# Spec — V5: Sistema de cupones promocionales

> Feature V5 dentro del bloque V1–V6 (mejoras de vitrina).
> Rama: `feat/coupons`.
> **Estado: ✅ APROBADA por el usuario el 2026-10-28, con las dos aclaraciones
> de §2.6 incorporadas** (el código previo de la rama se escribió antes de esta
> aprobación — incumplimiento SDD heredado de la sesión anterior, registrado
> aquí; a partir de este punto, spec y código avanzan juntos).

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
- **Las fechas NO exigen vigencia en edición** (decisión 2026-10-28, medida en
  navegador): la ventana de un cupón creado es un hecho histórico, así que el
  PUT acepta `validFrom` pasado (re-guardar sin mover fechas) y `validUntil`
  pasado (cerrar un cupón antes). La exigencia `@FutureOrPresent`/`@Future`
  vive sólo en la **creación** (`CouponCreateRequest`). Derivada UX: el
  `datetime-local` del form sólo tiene precisión de minuto, así que la
  creación empuja un `validFrom` ya vencido al presente con margen de 5 s
  (`isoVigente`), la misma regla que el E2E.
- 200 CouponDetailResponse.

`DELETE /api/v1/admin/coupons/{id}`
- 204 si usageCount = 0; 409 si ya usado.

#### Cliente

`POST /api/v1/coupons/validate`
- Auth: USER/ADMIN (session).
- Body: `{ code: string, subtotal: number }` (**subtotal = total del carrito en
  unidades mayores, GROSS con impuestos incluidos** — ver §2.6; el hardcode
  `10000` en céntimos que tenía el frontend era erróneo y se corrige).
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
- **AdminCouponForm** con validación manual espejo de la jakarta (patrón
  `AdminProductForm`, decisión D8 de 7.2 — **decidido con el usuario
  2026-10-28**: la redacción original pedía react-hook-form + zod y se
  descarta por consistencia y para no añadir dependencias de runtime por un
  formulario).
- **AdminCouponsPage** tabla paginada, crear/editar/eliminar.

Estado global:
- `CartContext` añade `couponCode?: string` y `couponDiscount?: number`.
- Integración en `/cart` y `/checkout`.

### 2.5. Reglas de negocio críticas

- La validación en frontend es solo preview; la fuente de verdad es la validación en checkout bajo transacción.
- Un mismo cupón puede usarse múltiples veces por usuario si `perUserLimit = 0`.
- `usageCount` y `CouponUsage` deben quedar consistentes en transacción.
- **Base del descuento: el total del carrito con impuestos incluidos (GROSS)** — ver §2.6.
- **Un pedido solo un cupón** (el checkout no aplica cupón sobre pedido ya descontado).

### 2.6. Aclaraciones aprobadas por el usuario (2026-10-28)

Dos ambigüedades de la redacción original se resolvieron en la aprobación:

**A. Unidades: siempre unidades mayores (BigDecimal, 2 decimales).**
El enunciado original decía «subtotal en menor unidad del mercado» (céntimos):
**queda descartado**. El sistema entero maneja unidades mayores
(`market_prices`, `orders`, `min_order_amount DECIMAL(10,2)`) y una mezcla
obligaría a conversiones ×100 con dos sitios donde fallar. En consecuencia:
- `CouponValidateRequest.subtotal` = total del carrito en euros/dólares
  (p. ej. `79.95`), tal cual lo calcula `CartContext.subtotal`.
- `minOrderAmount` y `maxDiscountAmount` se comparan en esa misma unidad.
- `discountAmount` persistido en `Order` y `CouponUsage` = misma unidad.
- El frontend envía el subtotal real del carrito (el `10000` hardcodeado era
  un placeholder erróneo) redondeado a 2 decimales con `toFixed(2)` antes del
  `JSON.stringify` para no arrastrar ruido de punto flotante.

**B. Base del descuento: total del carrito GROSS (con impuestos incluidos).**
El enunciado decía «subtotal antes de impuestos» con cita a la spec de
pricing: **queda sustituido** por el total que el usuario ve en el carrito.
Razones: (1) `CartContext.subtotal` es *final price* con impuestos dentro
(spec `final-price-display`, D3), (2) el número que se muestra
(`discountAmount`) debe ser el que el usuario ve descontado, sin traducciones
entre neto y bruto, y (3) `minOrderAmount` —«pedido mínimo 50 €»— se compara
con lo que el carrito muestra, no con una base interna.

Consecuencia en checkout (`processCheckout`):
- El descuento se calcula sobre `totalAccumulator` (bruto).
- `Order.totalAmount = totalAccumulator − discountAmount`.
- La parte imponible se **deriva del nuevo total** con la inversa del cálculo
  de `PricingService` (`net = total / (1 + rate)`, `tax = total − net`,
  HALF_UP escala 2), de modo que `subtotalAmount + taxAmount = totalAmount`
  sigue cuadrando — «impuestos sobre la base reducida» se cumple en su forma
  bruta: el descuento reduce el bruto y el neto se re-extrae de él.
- `Order.discountAmount` guarda el descuento tal cual (el número del
  carrito).

---

## 3. Criterios de aceptación

### Backend
- [x] Migraciones V20 y V21 aplican sin error. *(medido: aplicadas; BD local alineada al fichero 2026-10-28)*
- [x] `POST /admin/coupons` crea cupón y valida constraints.
- [x] `GET /admin/coupons` lista paginado con filtros.
- [x] `PUT /admin/coupons/{id}` actualiza sin cambiar code.
- [x] `DELETE /admin/coupons/{id}` devuelve 409 si usageCount > 0.
- [x] `POST /coupons/validate` devuelve valid=false con mensajes correctos para: inactivo, expirado, no válido aún, límite global, límite usuario, mínimo no alcanzado.
- [x] Cálculo descuento correcto para PERCENTAGE y FIXED con maxDiscountAmount, **sobre el total GROSS en unidades mayores (§2.6)**.
- [x] Checkout con cupón válido persiste descuento, incrementa usageCount e inserta CouponUsage dentro de transacción.
- [x] Concurrencia: dos peticiones simultáneas con mismo cupón al límite solo permiten el número permitido.
- [x] Idempotencia: mismo idempotencyKey + mismo cupón → mismo descuento, sin duplicar uso.

### Frontend
- [x] `CouponInput` debounce 500 ms, no dispara con <3 caracteres.
- [x] Muestra mensaje y descuento tras validación.
- [x] `CartContext` actualiza `couponCode` tras validación exitosa.
- [x] En `/cart` se muestra `CouponSummary` con opción quitar.
- [x] En checkout, el total refleja descuento.
- [x] Panel admin lista CRUD funcional.
- [x] Accesibilidad axe pasa en /cart, /checkout, /admin/coupons.
- [x] `tsc` 0, `lint` 0, `build` 0.

### Tests
- [x] `CouponServiceTest` cubre validaciones y canje atómico.
- [x] `CouponControllerTest` cubre endpoints admin y validate.
- [x] `CouponInput.test.tsx` cubre debounce y estados.
- [x] E2E flujo carrito → cupón → checkout → pedido con descuento.

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

**Aprobación: concedida por el usuario el 2026-10-28** (con §2.6).
