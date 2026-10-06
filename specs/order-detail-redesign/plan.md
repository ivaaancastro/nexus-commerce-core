# Plan: Tarea 5.5 — Rediseño de la página de pedido

> **Estado**: ⏳ PENDIENTE DE APROBACIÓN
> **Fecha**: 2026-10-05
> **Rama**: `feat/order-detail-redesign` (a crear desde `main`)
> **Origen**: requisito añadido por el usuario tras verificar la Tarea 5.4 en vivo. Referencia visual: la ficha de pedido de Zara (no se copia el diseño, solo la **información** que debe contener).

---

## 1. Objetivos

Rehacer **`/orders/{orderNumber}`** como una ficha de pedido completa y dar navegación de vuelta a toda la app:

- **Volver** a la pantalla anterior desde cada pantalla.
- **Resumen de productos** con foto, nombre, variantes y precio.
- **Dirección de envío** y **método de pago** usados.
- **Fecha de compra** y **límite de devolución**.
- **Número de pedido con botón copiar**.
- Estado del pedido indicando si hay **devolución solicitada**.

---

## 2. Diagnóstico inicial (por qué esto es más de lo que parece)

Auditoría hecha el 2026-10-05 sobre el estado real del repositorio:

| Requisito | Estado | Trabajo |
|:---|:---|:---|
| Botón «volver» | ❌ solo `addresses` y `products` lo tienen | Frontend |
| Número de pedido + copiar | ✅ `orderNumber` ya en el DTO | Frontend |
| Fecha de compra | ✅ `createdAt` | Frontend |
| Límite de devolución | ⚠️ derivable, pero hay que no duplicar la constante 30 | Backend + frontend |
| Estado «devolución solicitada» | ⚠️ derivable de `returnIneligibleReason` | Frontend |
| **Nombre y variantes del producto** | ❌ `OrderItem` no los expone (hoy solo `skuCode` = código de barras) | Backend |
| **Foto del producto** | ❌ **No existe ni una imagen en todo el proyecto**: `Product` no tiene campo, `public/` solo tiene los SVG de Next, y `CartItem.imageUrl` **nunca se asigna en ningún sitio** | Frontend (placeholder) |
| **Dirección de envío usada** | ❌ `Address` existe en el usuario, pero **la orden no guarda cuál se usó** y el checkout la tiene *hardcodeada* a `"ES"` | Backend + checkout |
| **Método de pago** | ❌ cero rastro: ni entidad, ni columna, ni campo en `CheckoutRequest` | Backend + checkout |

Las tres filas ❌ más pesadas obligan a migración y a tocar el checkout.

---

## 3. Alcance

### Incluido

- **Migración `V10`**: snapshot de dirección + método de pago en `orders`.
- **`CheckoutRequest`** acepta `addressId` y `paymentMethod`.
- **`OrderItemResponse`** expone nombre de producto, familia, talla y color.
- **`OrderResponse`** expone `returnDeadline`.
- **Página de detalle reescrita** con las secciones pedidas.
- **Componente `ProductThumb`** (placeholder editorial) compartido.
- **Componente `BackLink`** reutilizable.
- **Historial de pedidos** enriquecido con nombre + variante + placeholder.
- Tests backend y frontend.

### Excluido explícitamente

| Excluido | Motivo |
|:---|:---|
| **Almacenar imágenes reales** | No hay dataset de imágenes. Se usa placeholder editorial; si llega un dataset, solo hay que tocar `ProductThumb` |
| **Procesar el pago** | Siguen sin existir PSP. `paymentMethod` es un **dato declarado** por el usuario, igual que `refundAmount` es un registro contable (R5 de la Tarea 5.4) |
| **Cálculo de envío / portes** | No existe cálculo de envío en el proyecto |
| **Cambiar `/receipt`** | El recibo sigue siendo el documento fiscal; solo recibe el botón de volver |
| **Estados de pedido nuevos** | `OrderStatus` no crece: la devolución se deriva por línea, no cambia el estado de la orden |

---

## 4. Decisiones de Diseño

### 5.1. Foto: placeholder editorial, no columna de imagen

Aprobado por el usuario el 2026-10-05. Motivos: el proyecto **no tiene ni una sola imagen** (`grep imageUrl:` → *jamás* se asigna; `public/` solo tiene SVGs de Next), así que una columna `image_url` quedaría vacía y la página se vería igual. El placeholder reutiliza lo que ya hace `CartItemRow` (caja `bg-neutral-100` con la familia), garantizando coherencia visual con el resto de la app.

### 5.2. Dirección: snapshot inmutable en la orden

Aprobado por el usuario el 2026-10-05. Es lo correcto históricamente: si el usuario edita su dirección después, el pedido **sigue mostrando la que se usó**. Alternativa descartada —mostrar la `default_address` actual—, porque miente sobre pedidos antiguos.

### 5.3. Método de pago: dato declarado, sin procesar

Aprobado por el usuario el 2026-10-05. El usuario elige cómo pagaría (tarjeta, Bizum, PayPal, transferencia) y se guarda en la orden. **No se pide ningún número de tarjeta, no se tokeniza, no se cobra.** Consistente con el planteamiento de la Tarea 5.4: sin PSP no hay dinero que mover.

### 5.4. Columnas nullable, sin backfill

`V10` añade columnas **NULLABLE** y no rellena nada. Las 8 órdenes existentes quedan con `NULL` y **las secciones no se renderizan** (no se pinta «—» ni un hueco vacío).

### 5.5. `returnDeadline` lo calcula el backend

`OrderResponse.returnDeadline = createdAt + ReturnEligibilityService.RETURN_WINDOW_DAYS`. Exponer la constante que ya usa R1 evita que el frontend reimplemente los 30 días y los dos sitios acaben divergiendo.

### 5.6. El estado de devolución no toca `OrderStatus`

Se deriva en frontend: si algún ítem trae `returnIneligibleReason === "ALREADY_RETURNED"` → hay devolución solicitada. Cero cambios de backend, y funciona incluso sin sesión (R3 se evalúa en servidor).

### 5.7. Confirmación solo al llegar del checkout

La página vale como confirmación **y** como ficha histórica. El carrito marca `sessionStorage["nexus-just-checked-out"]` con el número de pedido; la ficha muestra el banner «Gracias por tu compra» solo si coincide — un pedido de hace 20 días no debe dar las gracias.

### 5.8. `router.back()` con fallback

`history.length > 1` → `router.back()`; si no (entrada directa o refresh) → `router.push(href)` destino. Sin esto, «volver» se queda mudo.

### 5.9. Anti-N+1 en el historial

El listado paginado **no** puede llevar `@EntityGraph` (trunca la colección en el corte de página), así que la carga por lotes va por `@BatchSize(size = 20)`. Hoy `OrderItem.sku` ya es `LAZY` **sin** batch — el historial ya sufre N+1 al leer `skuCode`; el batch lo arregla de paso.

> ⚠️ **Corregido el 2026-10-05 durante la implementación**: el plan original decía
> poner `@BatchSize` en los campos `OrderItem.sku` y `Sku.product`, pero **Hibernate
> lo prohíbe en `@ManyToOne`** — lanza
> *`AnnotationException: Property 'sku' may not be annotated '@BatchSize'`*.
>
> La semántica correcta es **a nivel de clase**: aplicado sobre `Sku` agrupa la
> carga de los proxies *de* `Sku` (la referencia `OrderItem → Sku`), y aplicado
> sobre `Product` la de `Sku → Product`. Las colecciones (`Order.items`) sí
> admiten el `@BatchSize` de campo, que es como ya estaba.

### 5.10. El checkout deja de admitir invitados

Consecuencia **no anticipada** de R1 + `@NotNull addressId`: si la dirección es
obligatoria y hay que verificar que pertenece al usuario, un checkout sin sesión
o con un email que no resuelva **no puede validar ninguna dirección** → `400`.

- Antes: `processCheckout(..., null)` creaba un pedido sin usuario asociado.
- Ahora: se rechaza con *«La dirección de envío seleccionada no es válida.»*

En producción **no es un cambio observable**: desde el fix del checkout (PR #13)
`/api/v1/orders/checkout` exige sesión, así que siempre hay usuario. Sí obligó a
reescribir `shouldProcessCheckoutSuccessfully`, que antes cubría el caso invitado.

---

## 5. API Endpoints

**No se crea ningún endpoint nuevo.** Cambian cuatro contratos existentes:

| Endpoint | Cambio |
|:---|:---|
| `POST /api/v1/orders/checkout` | `CheckoutRequest` + `addressId`, `paymentMethod` (obligatorios) |
| `GET /api/v1/orders/{orderNumber}` | `OrderResponse` + `returnDeadline`, `shippingAddress`, `paymentMethod`; `OrderItemResponse` + `productName`, `productFamily`, `size`, `color` |
| `GET /api/v1/users/me/orders/{orderNumber}` | idéntico al de arriba (misma consulta y mismo mapeo) |
| `GET /api/v1/users/me/orders` | `OrderSummaryResponse` + `items` (`OrderItemPreviewResponse`) y `returnRequested` |

> 📝 **Corregido el 2026-10-05 durante la implementación**: el plan inicial agrupaba
> los tres GET bajo `OrderResponse`/`OrderItemResponse`, pero el historial devuelve
> `OrderSummaryResponse`, que **no traía ninguna línea** —solo `itemCount`—, así que
> la tarjeta no podía mostrar el nombre del producto (R9) ni el badge (R10).
> Por eso aparece `OrderItemPreviewResponse` y el campo `returnRequested`.
>
> El badge se resuelve con **una única consulta por página**
> (`ProductReturnRepository.findOrderItemIdIn`), no con `existsByOrderItemId` por
> línea: 20 pedidos × 2 artículos serían 40 queries donde basta una.

`GET /api/v1/users/me/addresses` **ya existe** y es el que usa el carrito para poblar el selector.

---

## 6. Criterios de Aceptación

- [x] El checkout exige dirección y método de pago, y los guarda en la orden
- [x] Cambiar la dirección del usuario después **no** altera el pedido antiguo
- [x] Las órdenes previas a `V10` siguen mostrándose sin secciones vacías
- [x] Cada pantalla de pedidos, carrito y perfil tiene un «Volver» funcional
- [x] El número de pedido se copia al portapapeles con feedback visible
- [x] La ficha muestra productos con nombre y variante, dirección, pago, ambas fechas y desglose fiscal
- [x] Si hay devolución solicitada, la ficha y la tarjeta del historial lo indican
- [x] El historial no degrada a N+1 al traer el nombre de producto
- [x] Tests pasando (backend y frontend) y ESLint en baseline

> 📝 **Verificado el 2026-10-05**: backend **139 tests** y frontend **125 tests**
> en verde; `tsc --noEmit` limpio; `next build` OK; ESLint **9 problems
> (4 errors, 5 warnings)** — los 4 errores son los preexistentes de `main`.
>
> Sobre el N+1: se resuelve **por diseño** (`@BatchSize(size = 20)` a nivel de
> clase en `Sku` y `Product`, más los 3 `@EntityGraph` ampliados a
> `items.sku.product`), no con una medición de queries — el proyecto no tiene
> instrumentación de SQL. Nota de cobertura: backend al **86 %**, medido frente
> al **85 %** de `main`, sin regresión.

---

## 7. Estimación

- **Backend**: 3-4 horas (migración, DTOs, checkout, batch)
- **Frontend**: 4-5 horas (ficha completa, `BackLink`, `ProductThumb`, checkout con selector)
- **Tests**: 3 horas (hay que tocar **todos** los tests de checkout que hoy no pasan `addressId`)
- **Total**: 10-12 horas

---

## 8. Riesgos

| Riesgo | Mitención |
|:---|:---|
| Romper los tests de checkout existentes al hacer obligatorios los campos nuevos | Aumento de fixtures en `OrderServiceTest` + `UserOrderControllerTest`; está previsto en la estimación |
| N+1 en el historial al añadir `product` | `@BatchSize` en `OrderItem.sku` y `Sku.product` (§5.9) |
| Usuario sin direcciones se queda sin poder comprar | El carrito bloquea «Tramitar pedido» y enlaza a `/addresses` |
