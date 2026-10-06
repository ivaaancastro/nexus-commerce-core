# Spec: Tarea 5.5 — Rediseño de la página de pedido

> **Estado**: ✅ APROBADA e implementada (2026-10-05) · verificada en navegador (2026-10-06) — pendiente de `/spec-close`
> **Fecha**: 2026-10-05
> **Rama**: `feat/order-detail-redesign`
> **Plan**: `specs/order-detail-redesign/plan.md`

---

## 1. Requisitos

### R1 — Snapshot de dirección de envío

El pedido debe recordar **la dirección que se usó**, no la que el usuario tenga después.

**Criterio**: `CheckoutRequest.addressId` (obligatorio). El backend resuelve la dirección con `findByIdAndUserId(addressId, userId)` y **copia sus valores** a 5 columnas de `orders` (`shipping_full_name`, `shipping_street`, `shipping_city`, `shipping_postal_code`, `shipping_country_code`).

- Si la dirección no existe o **no es del usuario** → `400` con mensaje amigable. Nunca se acepta una dirección ajena.
- El snapshot es **inmutable**: editar o borrar la `Address` original no cambia el pedido.
- Persiste como `@Embedded ShippingAddress` en `Order`.

> 📝 **Corregido el 2026-10-05 durante la implementación**: la spec pedía
> `@AttributeOverrides` en `Order`, pero los nombres de columna van
> **directamente en los `@Column`** de `ShippingAddress`. Un solo sitio donde
> mirar, y el prefijo `shipping_` queda explícito junto a cada campo.

### R2 — Método de pago como dato declarado

**Criterio**: `CheckoutRequest.paymentMethod` (obligatorio) con enum `PaymentMethod { CARD, BIZUM, PAYPAL, BANK_TRANSFER }`, persistido como `@Enumerated(EnumType.STRING)` en la columna `payment_method`.

> ⚠️ **No procesa pagos.** No se pide número de tarjeta, no se tokeniza, no se cobra. Es una preferencia declarada, coherente con `refundAmount` (R5 de la Tarea 5.4): sin PSP no hay dinero que mover.

### R3 — Datos de producto en cada línea

El resumen debe mostrar **nombre y variantes**, no solo el código de barras.

**Criterio**: `OrderItemResponse` gana `productName`, `productFamily`, `size` y `color`, resueltos recorriendo `OrderItem → Sku → Product`.

- Las 3 consultas de detalle amplían su `@EntityGraph` a `{"items", "items.sku", "items.sku.product"}`.
- `OrderItem.sku` y `Sku.product` reciben `@BatchSize(size = 20)` para que el historial paginado (sin `@EntityGraph`) no caiga en N+1.
- El valor existente `skuCode` **se conserva**.

### R4 — Límite de devolución en el DTO

**Criterio**: `OrderResponse.returnDeadline` = `Order.createdAt + ReturnEligibilityService.WINDOW_DAYS`.

La ventana **no** se reimplementa en frontend: se expone la constante que ya usa R1 de la Tarea 5.4 para que los 30 días vivan en un solo sitio.

> 📝 **Corregido el 2026-10-05**: la constante se llama `WINDOW_DAYS`, no
> `RETURN_WINDOW_DAYS` — y ya era `public static final`, así que no hubo que
> cambiar su visibilidad.

### R5 — Volver a la pantalla anterior

**Criterio**: componente `<BackLink href>` que usa `router.back()` cuando `window.history.length > 1` y `router.push(href)` como fallback (entrada directa o F5).

Aplicado en **todas** estas pantallas, bajo el `Header` y alineado a la izquierda:

| Pantalla | Fallback | Etiqueta |
|:---|:---|:---|
| `/orders` (historial) | `/` | «Inicio» |
| `/orders/{n}` (ficha) | `/orders` | «Mis pedidos» |
| `/receipt/{n}` (recibo) | `/orders` | «Mis pedidos» |
| `/cart` | `/` | «Volver» (por defecto) |
| `/profile` | `/` | «Volver» (por defecto) |
| `/addresses` | `/profile` | «Volver al perfil» |

Copy por defecto: `← Volver` — la prop `label` lo sustituye en las pantallas
donde aporta más contexto que un «volver» genérico. Estilo editorial:
`text-xs uppercase tracking-widest text-neutral-600`.

> 📝 **Corregido el 2026-10-06 tras la prueba manual en navegador**: la spec
> fijaba `← Volver` como copy único. La implementación usa etiquetas
> contextuales que dicen **dónde** vuelve el enlace, y esa es la decisión que
> se mantiene. Los 6 `href` fallback sí coincidían ya con la tabla; lo único
> que cambia aquí es el copy.

### R6 — Número de pedido con botón copiar

**Criterio**: junto al número de pedido, un botón que ejecuta `navigator.clipboard.writeText(orderNumber)` y muestra **«Copiado ✓»** durante 2 segundos.

- Guardado con `try/catch`: en entorno sin `navigator.clipboard` (jsdom) **no debe lanzar**.
- El número va en `font-mono`, con `aria-label` descriptivo y `data-testid="copy-order-number"`.

### R7 — Ficha de pedido reestructurada

`/orders/{orderNumber}` se rehace con este orden de secciones:

1. **Barra superior**: `← Volver` · badge de estado · (R10)
2. **Cabecera**: «Pedido» + **número con botón copiar** · fecha de compra · **límite de devolución** (R4)
3. **Banner de confirmación** — solo si viene del checkout (§5.7 del plan)
4. **Dirección de envío** — solo si el snapshot existe (R1)
5. **Método de pago** — solo si el dato existe (R2)
6. **Resumen de productos**: `ProductThumb` + nombre + familia + talla/color + cantidad + importe de línea (R3)
7. **Desglose fiscal**: subtotal / impuestos / total (ya existente, se conserva)
8. **Devoluciones**: sección existente de la Tarea 5.4, **se conserva sin cambios funcionales**
9. **Acciones**: «Ver recibo»

**Criterio de datos legacy**: si `shippingAddress` o `paymentMethod` son `null` (órdenes previas a `V10`), **las secciones 4 y 5 no se pintan**. Nunca se muestra un hueco con «—».

### R8 — Placeholder visual de producto

**Criterio**: componente `<ProductThumb name family size? />` — caja `bg-neutral-100` con la familia en `text-[10px] uppercase tracking-wider text-neutral-400`, idéntico al fallback que ya usa `CartItemRow`.

Se reutiliza en **carrito, historial y ficha** para que los tres sitios se vean igual. Si más adelante hay imágenes reales, el cambio se acota a este componente.

> No se inventan fotos: el proyecto no tiene ninguna (plan §2).

### R9 — Historial de pedidos enriquecido

La tarjeta de `/orders` pasa de mostrar **solo `itemCount`** (ni siquiera `skuCode`):
a enumerar cada producto con:

- `ProductThumb` en pequeño
- **Nombre del producto** + familia
- Talla / color y cantidad
- Importe total de la línea

Se conservan el badge de estado y los enlaces «Ver pedido» / «Ver recibo» añadidos en la Tarea 5.4.

> 📝 **Ampliación de alcance detectada al implementar** (documentada en plan §5):
> `OrderSummaryResponse` no traía **ninguna línea**, así que este requisito era
> imposible con el contrato existente. Gana `items` (`OrderItemPreviewResponse`)
> y, de paso, `returnRequested` para que R10 pueda resolverse en el historial.

### R10 — Estado «devolución solicitada»

**Criterio**: derivado en frontend — si algún ítem trae `returnIneligibleReason === "ALREADY_RETURNED"`, la ficha muestra el badge **«Devolución solicitada»** junto al estado, y la tarjeta del historial lo refleja.

En la ficha funciona **sin sesión** (R3 de la Tarea 5.4 ya lo evalúa en servidor). Se le suma `returns.length > 0` para que el badge aparezca al instante tras solicitar una devolución, sin recargar.

> 📝 **Corregido el 2026-10-05**: esta sección decía «sin cambios de backend»,
> pero el historial sí los necesitaba. `OrderSummaryResponse` gana un booleano
> `returnRequested` que se resuelve con **una única consulta por página**
> (`ProductReturnRepository.findOrderItemIdIn`): con `existsByOrderItemId`
> por línea, 20 pedidos de 2 artículos serían 40 queries donde basta una.

---

## 2. Modelo de Datos (V10)

```sql
-- orders: snapshot de envío + método de pago (nullable = órdenes previas)
ALTER TABLE orders ADD COLUMN shipping_full_name    VARCHAR(100);
ALTER TABLE orders ADD COLUMN shipping_street       VARCHAR(255);
ALTER TABLE orders ADD COLUMN shipping_city         VARCHAR(100);
ALTER TABLE orders ADD COLUMN shipping_postal_code  VARCHAR(20);
ALTER TABLE orders ADD COLUMN shipping_country_code VARCHAR(5);
ALTER TABLE orders ADD COLUMN payment_method        VARCHAR(16);
```

**Sin backfill** (plan §5.4). Índice no necesario: la consulta es por `order_number`.

---

## 3. Contratos

### `CheckoutRequest` (ampliado)

```java
public record CheckoutRequest(
        @NotBlank String marketCode,
        @NotEmpty @Valid List<CheckoutItemRequest> items,
        String destinationCountryCode,
        Double destinationLatitude,
        Double destinationLongitude,
        @NotNull(message = "Debes seleccionar una dirección de envío")
        Long addressId,
        @NotNull(message = "Debes indicar un método de pago")
        PaymentMethod paymentMethod
) {}
```

### `OrderResponse` (ampliado)

```java
public record OrderResponse(
        Long id, String orderNumber, String idempotencyKey,
        String marketCode, String currency, OrderStatus status,
        BigDecimal subtotalAmount, BigDecimal taxAmount, BigDecimal totalAmount,
        Instant createdAt,
        Instant returnDeadline,              // ← R4
        ShippingAddressResponse shippingAddress,  // ← R1, null en órdenes previas
        PaymentMethod paymentMethod,             // ← R2, null en órdenes previas
        List<OrderItemResponse> items
) {}
```

### `OrderItemResponse` (ampliado)

```java
public record OrderItemResponse(
        Long id, Long skuId, String skuCode, String warehouseCode,
        Integer quantity,
        BigDecimal unitPrice, BigDecimal taxRate, BigDecimal taxAmount, BigDecimal totalAmount,
        Boolean returnEligible, String returnIneligibleReason,
        String productName, String productFamily,   // ← R3
        String size, String color                   // ← R3
) {}
```

---

## 4. Criterios de Aceptación

- [x] **R1**: el checkout guarda la dirección elegida; editarla después no altera el pedido → `OrderServiceTest.shouldKeepSnapshotWhenAddressIsEditedLater`
- [x] **R1**: `addressId` inexistente o de otro usuario → `400` → `shouldRejectCheckoutWhenAddressIsNotOwnedByUser` (verifica además que **no** se llamó a `reserveStock` ni a `save`)
- [x] **R2**: `paymentMethod` obligatorio; se persiste y se devuelve → `shouldRejectCheckoutWithoutAddressOrPaymentMethod` + `shouldProcessCheckoutSuccessfully`
- [x] **R3**: cada línea trae nombre, familia, talla y color → `OrderDetailPage.test.tsx` «R3 — pinta nombre, familia, talla, color y referencia»
- [x] **R3**: el historial no genera N+1 al traer el producto → `@BatchSize(20)` en `Sku` y `Product` + `@EntityGraph` ampliados *(por diseño, sin medición de queries: el proyecto no instrumenta SQL)*
- [x] **R4**: `returnDeadline` coincide con `createdAt + 30 días` → `shouldComputeReturnDeadlineFromPurchaseDate`
- [x] **R5**: «Volver» funciona desde las 6 pantallas; con `history` vacío hace fallback → `BackLink.test.tsx` (3 tests) + `grep BackLink` en las 6 rutas. Copy por pantalla documentado en R5
- [x] **R6**: copiar escribe el número y muestra «Copiado ✓» 2 s; sin `clipboard` no lanza → 2 tests en `OrderDetailPage.test.tsx`
- [x] **R7**: la ficha muestra las 9 secciones en orden → `orders/[orderNumber]/page.tsx`
- [x] **R7**: las órdenes previas a `V10` **no** pintan secciones de envío/pago vacías → test «R7 — las órdenes anteriores a V10…»
- [x] **R8**: carrito, historial y ficha usan el mismo `ProductThumb` → `CartItemRow.tsx`, `orders/page.tsx`, `orders/[orderNumber]/page.tsx`
- [x] **R9**: el historial muestra nombre + familia + talla/color + cantidad + importe → test «R9 — pinta nombre y variante…» (afirma `Camisas · Talla M · Blanco`)
- [x] **R10**: con devolución solicitada aparece el badge en ficha e historial → tests en `OrderDetailPage.test.tsx` y `OrderHistoryPage.test.tsx` (+ el negativo)
- [x] Tests backend y frontend en verde; ESLint sin errores nuevos → **139** backend · **125** frontend · ESLint 4 errores, todos los preexistentes de `main`
- [x] **Prueba manual en navegador** (2026-10-06): carrito sin dirección deja «TRAMITAR PEDIDO» deshabilitado → crear dirección → elegir BIZUM → checkout → ficha con las 9 secciones → copiar número → `BackLink` → historial enriquecido → órdenes previas a `V10` no pintan envío/pago. Encontró 2 desviaciones, ambas corregidas: color ausente en R9 y copy de R5 documentado

---

## 5. Trazabilidad

| Requisito | Backend | Frontend | Tests |
|:---|:---|:---|:---|
| R1 | `V10`, `ShippingAddress`, `CheckoutRequest`, `AddressRepository.findByIdAndUserId` | selector en `/cart` | `OrderServiceTest`, `UserOrderControllerTest` |
| R2 | `PaymentMethod`, columna `payment_method` | selector en `/cart` | idem |
| R3 | `OrderItemResponse` +4, `@EntityGraph`, `@BatchSize` | `ProductThumb` | `OrderServiceTest` |
| R4 | `OrderResponse.returnDeadline` | cabecera de la ficha | `OrderServiceTest` |
| R5 | — | `BackLink` + 6 páginas | `BackLink.test.tsx` |
| R6 | — | botón copiar | `OrderDetailPage.test.tsx` |
| R7 | — | reescritura de `page.tsx` | `OrderDetailPage.test.tsx` |
| R8 | — | `ProductThumb` | `ProductThumb.test.tsx` |
| R9 | — | `orders/page.tsx` | `OrderHistoryPage.test.tsx` |
| R10 | — | derivación del badge | `OrderDetailPage.test.tsx`, `OrderHistoryPage.test.tsx` |
