# Tasks: Tarea 5.5 — Rediseño de la página de pedido

> **Estado**: ✅ IMPLEMENTADO — pendiente de `/spec-check` y commit
> **Rama**: `feat/order-detail-redesign`

---

## 0. Preparación

- [x] `git checkout main && git pull`
- [x] `git checkout -b feat/order-detail-redesign`
- [x] Verificar baseline verde: `cd backend && ./mvnw test` · `cd frontend && npx vitest run`

---

## 1. Backend

### 1.1 Migración y entidades

- [x] `V10__order_shipping_payment.sql` — 6 columnas **nullable** en `orders` (spec §2)
- [x] Clase embebida `ShippingAddress` (`@Embeddable`) con los 5 campos
- [x] `Order` + `@Embedded ShippingAddress` con `@AttributeOverrides` (prefijo `shipping_`)
- [x] `Order` + `paymentMethod` (`@Enumerated(STRING)`, `VARCHAR(16)`, **nullable**)
- [x] Enum `PaymentMethod { CARD, BIZUM, PAYPAL, BANK_TRANSFER }`
- [x] `AddressRepository` + `Optional<Address> findByIdAndUserId(Long id, Long userId)` (spec R1)
- [x] `Sku.product` + `@BatchSize(size = 20)` — evita N+1 en el historial (plan §5.9)
- [x] `OrderItem.sku` + `@BatchSize(size = 20)` — arregla el N+1 **preexistente** al leer `skuCode`

> Decisión: los nombres de columna van **directamente en `@Column`** de
> `ShippingAddress`, sin `@AttributeOverrides` en `Order` — un solo sitio donde
> mirar y el prefijo `shipping_` queda explícito junto a cada campo.

### 1.2 Checkout

- [x] `CheckoutRequest` + `addressId` y `paymentMethod` con `@NotNull` y mensajes amigables
- [x] `OrderService.checkout` valida la dirección con `findByIdAndUserId` → si falla, `400`
- [x] `OrderService.checkout` copia los 5 valores de la dirección al `Order` (snapshot inmutable)
- [x] `OrderService.checkout` persiste el `paymentMethod`
- [x] Confirmar que `spring.jpa.hibernate.ddl-auto=validate` sigue en verde con `V10`

> **La dirección se resuelve ANTES del bucle de reserva de stock** — si es inválida
> se falla sin haber tocado inventario.
>
> ⚠️ **Consecuencia**: `addressId` obligatorio + verificar propiedad implica que
> **ya no existe checkout de invitado**. El test `shouldProcessCheckoutSuccessfully`
> pasó de «checkout de invitado» a sesión con dirección. Documentado en §5.10 del plan.

### 1.3 DTOs de lectura

- [x] `ShippingAddressResponse` (record inmutable, 5 campos)
- [x] `OrderResponse` + `returnDeadline`, `shippingAddress`, `paymentMethod`
- [x] `OrderItemResponse` + `productName`, `productFamily`, `size`, `color`
- [x] `ReturnEligibilityService.RETURN_WINDOW_DAYS` hacerlo `public static final` (fuente única, spec R4) — ya lo era: `WINDOW_DAYS`
- [x] `OrderService.mapToOrderResponse` rellena `returnDeadline` desde esa constante
- [x] `OrderService.mapToOrderItemResponse` resuelve el producto recorriendo `sku → product`
- [x] `OrderRepository`: los 3 `@EntityGraph` pasan a `{"items", "items.sku", "items.sku.product"}`

> **`createdAt` puede ser `null`** justo tras `save()` — `@CreationTimestamp` se
> fija en el flush. `returnDeadline` lleva guardia para no reventar con NPE.

---

## 2. Frontend

### 2.1 Componentes reutilizables

- [x] `src/components/BackLink.tsx` — `router.back()` si `history.length > 1`, si no `router.push(href)` (spec R5)
- [x] `src/components/ProductThumb.tsx` — caja `bg-neutral-100` + familia, calco del fallback de `CartItemRow` (spec R8)
- [x] `src/__tests__/ProductThumb.test.tsx`
- [x] `src/__tests__/BackLink.test.tsx`

> 📝 Los tests van en `src/__tests__/` (donde ya vive el resto de la suite),
> no junto al componente.

### 2.2 Checkout con dirección y pago

- [x] `types/commerce.ts` — `ShippingAddress`, `PaymentMethod`, `Order`, `OrderItem`, `OrderItemPreview` y `OrderSummary` ampliados (+ `PAYMENT_METHODS` / `PAYMENT_METHOD_LABELS`)
- [x] `lib/api.ts` — **sin cambios**: `checkout()` ya recibía un `CheckoutRequest`, y los dos campos nuevos viajan dentro de ese objeto
- [x] `/cart` — cargador de direcciones con `api.getAddresses()` — **ya existía**, no hizo falta añadir método
- [x] `/cart` — selector de dirección con la `defaultAddress` preseleccionada (si no hay, la primera)
- [x] `/cart` — selector de método de pago (CARD / BIZUM / PAYPAL / BANK_TRANSFER)
- [x] `/cart` — **sin direcciones**: bloquear «Tramitar pedido» y enlazar a `/addresses`
- [x] `/cart` — marcar `sessionStorage["nexus-just-checked-out"]` tras el éxito (plan §5.7) — clave centralizada en `src/lib/checkout.ts`
- [x] `/cart` — `destinationCountryCode` derivado de la dirección elegida
- [x] Inputs con `text-neutral-900` (**regla #7**)

> 📝 **Limitación conocida**: no existe geocodificación, así que
> `destinationLatitude/Longitude` siguen siendo las de siempre. Cambiarlas por
> `null` alteraría cómo se elige almacén hoy, fuera del alcance de esta spec.

### 2.3 Página de ficha reescrita

- [x] `orders/[orderNumber]/page.tsx` — reordenado en las 9 secciones de spec R7
- [x] `<BackLink href="/orders">` en la barra superior
- [x] **Cabecera**: número con `<button>` de copiar + `navigator.clipboard` en `try/catch` (R6)
- [x] **Cabecera**: fecha de compra + `returnDeadline` con `toLocaleDateString("es-ES")` (R4)
- [x] **Banner** «Gracias por tu compra» solo si `sessionStorage` coincide (plan §5.7) — el `sessionStorage` se lee en `try/catch` por si no existe
- [x] **Dirección de envío** — renderizar solo si `order.shippingAddress` no es `null` (R7)
- [x] **Método de pago** — renderizar solo si `order.paymentMethod` no es `null` (R2)
- [x] **Productos**: `ProductThumb` + nombre + familia + talla/color + cantidad + importe (R3)
- [x] **Badge «Devolución solicitada»** derivado de `ALREADY_RETURNED` (R10) — suma también `returns.length` para que aparezca al instante tras solicitarla
- [x] Conservar sin cambios la sección de Devoluciones y el Toast de la Tarea 5.4
- [x] Estado de carga y «Pedido no encontrado» conservan `<BackLink>`

### 2.4 Historial enriquecido

- [x] `orders/page.tsx` — tarjeta con `ProductThumb` + nombre + variante + importe (R9)
- [x] `orders/page.tsx` — badge «Devolución solicitada» si `returnRequested` (R10)
- [x] `CartItemRow.tsx` — delegar su caja en `ProductThumb` (mismo componente en los 3 sitios)

> 📝 **Ampliación de alcance detectada durante la implementación**: la tarjeta
> necesitaba las líneas y `OrderSummaryResponse` no traía ninguna (solo
> `itemCount`). Se añadieron `items` (`OrderItemPreviewResponse`) y
> `returnRequested`, con **una única consulta por página** para el badge.
> Corregido en plan §5, antes de tocar código.

### 2.5 Volver en el resto de pantallas

- [x] `/receipt/[orderNumber]` → `<BackLink href="/orders">`
- [x] `/cart` → `<BackLink href="/">`
- [x] `/profile` → `<BackLink href="/">`
- [x] `/addresses` → `<BackLink href="/profile">` — sustituye al botón antiguo,
      que llamaba a `window.history.back()` **sin fallback**
- [x] `/orders` → `<BackLink href="/">`

---

## 3. Tests

### Backend

- [x] `CheckoutRequest` con `addressId` inexistente o de otro usuario → `400`
- [x] `addressId` / `paymentMethod` ausentes → `400` por validación
- [x] Snapshot: editar la `Address` tras el checkout **no** cambia el pedido
- [x] `paymentMethod` se persiste y se devuelve como enum (no como ordinal)
- [x] `returnDeadline = createdAt + 30 días`
- [x] `OrderItemResponse` trae `productName`, `productFamily`, `size`, `color`
- [x] Las órdenes antiguas devuelven `shippingAddress` y `paymentMethod` en `null`
- [x] **Actualizar todos los tests de checkout existentes** — fixtures con `addressId` + `paymentMethod` *(riesgo del plan §8)*

> **`@BatchSize` en `@ManyToOne` NO existe**: Hibernate lanza
> *«Property 'sku' may not be annotated '@BatchSize'»*. Se aplica a nivel de
> **clase** sobre `Sku` y `Product`, que es lo que agrupa los proxies de esos
> tipos. Corregido en la implementación y anotado en §5.9 del plan.

### Frontend

- [x] `BackLink` — `history.length > 1` llama a `back()`, si no a `push()`
- [x] `BackLink` — respeta el `href` de fallback de cada pantalla y se puede operar con teclado
- [x] `ProductThumb` — pinta la familia, añade la talla y respeta `className`
- [x] Ficha — muestra número con botón copiar y feedback «Copiado ✓»
- [x] Ficha — **sin** `navigator.clipboard` no lanza (guard `try/catch`)
- [x] Ficha — pinta dirección y método de pago **solo** si existen
- [x] Ficha — con `shippingAddress: null` **no** aparece la sección (spec R7)
- [x] Ficha — pinta nombre + talla/color + referencia de cada producto
- [x] Ficha — con `ALREADY_RETURNED` aparece el badge de devolución (sin sesión)
- [x] Ficha — banner de confirmación solo con la clave de `sessionStorage`, y se consume al leerlo
- [x] Ficha — `returnDeadline` se muestra en castellano (R4)
- [x] Historial — tarjeta muestra nombre + variante + placeholder
- [x] Historial — conserva los tests «Ver pedido» / «Ver recibo» de la Tarea 5.4
- [x] Carrito — sin direcciones bloquea y enlaza a `/addresses` (R1)
- [x] Carrito — envía `addressId` y `paymentMethod`, y permite cambiar de pago (R1/R2)

---

## 4. Verificación

- [x] `cd backend && ./mvnw test` en verde → **139 tests** (134 previos + 5 nuevos)
- [x] Cobertura backend → **86 %** de instrucciones, frente al **85 %** de `main`
      (medido en un worktree aparte): **sin regresión**. El objetivo de 90 % de
      `AGENTS.md` no se alcanzaba ya en `main`; no hay `jacoco:check` en el build
- [x] `cd frontend && npx vitest run` en verde → **125 tests** (101 previos + 24 nuevos)
- [x] `npx tsc --noEmit` sin errores
- [x] `npx eslint src` → **9 problems (4 errors, 5 warnings)**; los 4 errores son los
      preexistentes de `main` (`app/page.tsx:22`, `components/Toast.tsx:21`,
      `context/AuthContext.tsx:36`, `hooks/useLocalStorage.ts:17`) → **0 nuevos**
- [x] `npm run build` OK (Next.js 16.3.7, 13 rutas)
- [x] `/spec-check order-detail-redesign` en verde → ✅ **APROBADO (10/10 requisitos, 0 shortfall)**
- [x] Prueba manual: checkout con dirección + pago → ficha completa → copiar número → volver — **2026-10-06**, en navegador contra backend real (R1-R10; ver hallazgos en spec §4)

---

## 5. Documentación

- [x] `CHANGELOG.md` — entrada bajo *Añadido*
- [x] `README.md` — `POST /orders/checkout` (🔒, `addressId` + `paymentMethod`, snapshot) y `GET /orders/{n}` (🔒, campos nuevos); historial con `items` y `returnRequested`
- [x] `AGENTS.md` + `MEMORY.md` — estado actualizado (139 backend · 125 frontend)
- [x] `specs/order-detail-redesign/plan.md` §6 — criterios de aceptación marcados
- [x] **No** hace falta ADR: no cambia stack ni arquitectura (plan §3)
