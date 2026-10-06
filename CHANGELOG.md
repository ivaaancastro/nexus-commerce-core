# Changelog

Todos los cambios notables en este proyecto se documentarán en este archivo.
El formato sigue las directrices de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- **Rediseño de la página de pedido** (Tarea 5.5, spec `specs/order-detail-redesign/`):
  - **Dirección de envío como snapshot**: migración `V10__order_shipping_payment.sql` con 6 columnas **nullable** en `orders`, clase embebida `ShippingAddress` (`@Embeddable`, prefijo `shipping_`) y `Order.paymentMethod` (`@Enumerated(STRING)`). `CheckoutRequest` gana `addressId` y `paymentMethod` con `@NotNull`; la dirección se resuelve con `findByIdAndUserId` **antes del bucle de reserva de stock**, de modo que una dirección inválida no toca inventario. Como `addressId` obligatorio implica verificar propiedad, **ya no existe checkout de invitado** (plan §5.10).
  - **Método de pago declarado, no procesado**: `PaymentMethod { CARD, BIZUM, PAYPAL, BANK_TRANSFER }`. Sin número de tarjeta, sin tokenización, sin cobro — coherente con que `refundAmount` es solo un registro contable.
  - **`returnDeadline`** calculado en el backend desde `ReturnEligibilityService.WINDOW_DAYS` (fuente única de los 30 días), para que el cliente no reimplemente la ventana.
  - `OrderResponse` + `shippingAddress`, `paymentMethod`, `returnDeadline`; `OrderItemResponse` + `productName`, `productFamily`, `size`, `color`, recorriendo `OrderItem → Sku → Product`.
  - **Historial enriquecido**: `OrderSummaryResponse` + `items` (`OrderItemPreviewResponse`) y `returnRequested` — antes no traía **ninguna línea**, solo `itemCount`, así que la tarjeta no podía mostrar el nombre del producto. El badge de devolución se resuelve con **una única consulta por página** (`ProductReturnRepository.findOrderItemIdIn`), no con `existsByOrderItemId` por línea: 20 pedidos × 2 artículos serían 40 queries donde basta una.
  - **Ficha de pedido reescrita al completo** en 9 secciones: barra superior con «Volver» y badges, cabecera con número copiable (R6, `navigator.clipboard` en `try/catch`), fecha de compra y límite de devolución, dirección y método de pago **solo si existen** (las órdenes anteriores a `V10` no pintan secciones vacías), productos con nombre y variante, desglose fiscal, sección de devoluciones **conservada sin cambios** de la Tarea 5.4 y acciones.
  - **Banner «Gracias por tu compra» solo al llegar del checkout**: el carrito marca `sessionStorage["nexus-just-checked-out"]` (clave en `src/lib/checkout.ts`) y la ficha la consume al leerla, de modo que un pedido de hace 20 días no da las gracias ni una recarga repite el mensaje.
  - Componente **`BackLink`** en las 6 pantallas de la spec: `router.back()` con historial y `router.push(href)` como fallback, que es justo lo que faltaba en el botón «Volver al perfil» de `/addresses` — llamaba a `window.history.back()` a secas y se quedaba mudo al entrar directamente en la URL.
  - Componente **`ProductThumb`**: placeholder editorial compartido por carrito, historial y ficha. El proyecto **no tiene ni una imagen** (`Product` no tiene campo de imagen y `public/` solo contiene los SVG de Next), así que `CartItemRow` pasó a delegar su caja en este componente — su rama `<img>` era código muerto, `imageUrl` nunca llegaba a asignarse.
  - **24 tests nuevos de frontend**: `BackLink.test.tsx` (5), `ProductThumb.test.tsx` (4), `OrderDetailPage.test.tsx` (+10, de 10 a 20), `OrderHistoryPage.test.tsx` (+3, de 8 a 11) y `CartPage.test.tsx` (+3, de 4 a 7). El frontend queda en **125 tests** en 17 ficheros.
  - **5 tests nuevos de backend**: dirección de otro usuario → `400` sin tocar inventario, snapshot inmutable ante ediciones, `returnDeadline` desde la fecha de compra, órdenes legacy en `null` y checkout sin dirección/pago → `400`. El backend queda en **139 tests**.
  - **Sin ADR**: no cambia stack ni arquitectura (plan §3).
  - ⚠️ **Limitación anotada**: no existe geocodificación, así que `destinationLatitude/Longitude` siguen siendo las de siempre en el checkout. Cambiarlas a `null` alteraría cómo se elige almacén hoy, fuera del alcance de esta spec.
- **Devoluciones de productos** (Tarea 5.4, spec `specs/product-returns/`):
  - Endpoints 🔒 `POST /api/v1/users/me/orders/{orderNumber}/returns` (`201 Created`) y `GET …/returns` en `UserOrderController`.
  - `ReturnEligibilityService` con `Clock` inyectable (`ClockConfig`): R1 (menos de 30 días **desde la compra**, ventana estricta), R2 (solo pedidos `DELIVERED`) y R3 (una devolución por línea). Se evalúa en orden `NOT_DELIVERED → ALREADY_RETURNED → EXPIRED`, de modo que el checkout sale sin consultar la BD y una línea ya devuelta no muestra «plazo agotado».
  - `ReturnService.createReturn` valida R1/R2/R3 **antes** de persistir y calcula `refundAmount = unitPrice × quantity` con `BigDecimal` + `HALF_UP` escala 2 (regla #4). **Es un registro contable: no mueve dinero** — el proyecto no tiene pasarela de pago.
  - **Fórmula de R5 corregida** (aprobada por el usuario, 2026-10-05): la spec decía `unitPrice × quantity + taxAmount`, que **sumaba el IVA dos veces** — `unit_price` guarda el PVP con IVA ya incluido, así que para una línea de 79,95 EUR declaraba devolver 93,83 EUR. Regresión cubierta por `ReturnServiceTest.shouldNotAddTaxAgain()`.
  - Migración `V9__product_returns.sql` con la restricción `uq_return_per_item` (última línea de defensa de R3) y `idx_returns_user`. Una carrera sobre el `UNIQUE` se traduce a `409`, no a `500`.
  - Excepción `ReturnNotAllowedException` → `409 Conflict`, con `code: "RETURN_NOT_ALLOWED"` en el cuerpo.
  - `OrderItemResponse` gana `returnEligible` y `returnIneligibleReason` (`NOT_DELIVERED` | `EXPIRED` | `ALREADY_RETURNED`), presente en el detalle y en el checkout (donde es siempre `false`, sin efecto práctico).
  - Sección **Devoluciones** en `/orders/[orderNumber]`: botón «Devolver» habilitado por línea, motivo legible cuando no lo está («Plazo agotado — se compró el {fecha}», «Pedido aún no entregado», «Ya devuelto»), formulario con `noValidate` y validación propia, estado `Solicitada` con el importe reembolsado y toast de confirmación. La sección solo se renderiza con sesión.
  - Tipo `ProductReturn`, `ReturnIneligibleReason`, `CreateReturnPayload` y `ReturnStatus` en `frontend/src/types/commerce.ts`, y métodos `getMyReturns` / `createReturn` en la capa de API.
  - **28 tests nuevos de backend**: 106 → **134**. Nuevas suites `ReturnEligibilityServiceTest` (9) y `ReturnServiceTest` (11), más `UserOrderControllerTest` (+6) y `OrderServiceTest` (+2).
- **12 tests nuevos de frontend** para las devoluciones: `OrderDetailPage.test.tsx` (+8, de 2 a 10) y `Errors.test.ts` (+4). El frontend queda en **100 tests** en 15 ficheros.
- `getFriendlyErrorMessage()` distingue el `409` de devoluciones del `409` de stock mediante el campo `code`. El backend ya emitía `409` para ambos y la traducción única decía «No queda stock suficiente…», mensaje falso para quien intenta devolver. Detalle en §5 de la spec.
- **23 tests nuevos de frontend** para el fix de checkout: `Errors.test.ts` (12), `ApiAuthHeaders.test.ts` (7) y `CartPage.test.tsx` (4). `frontend/src/lib/errors.ts` no tenía ni un solo test. Con la Tarea 5.3, el frontend queda en **88 tests** en 15 ficheros.
- **Historial de pedidos** (Tarea 5.3, spec `specs/user-orders/`):
  - Endpoints `GET /api/v1/users/me/orders` (paginado) y `GET /api/v1/users/me/orders/{orderNumber}` en el nuevo `UserOrderController`.
  - La propiedad del pedido se comprueba **en la propia consulta** (`findByUserIdAndOrderNumber`), de modo que «no existe» y «es de otro usuario» devuelven lo mismo: `404`.
  - DTOs `OrderSummaryResponse` y `OrderPageResponse`.
  - Estados `SHIPPED` y `DELIVERED` en el enum `OrderStatus` (sin migración: la columna es `VARCHAR(32)`).
- **Página `/orders`** con tarjeta por pedido (número, fecha, artículos, total), badge de estado, enlace al recibo, estado vacío con acceso a la colección y paginación anterior/siguiente. Protegida con `ProtectedRoute`.
- Componente `OrderStatusBadge` con etiquetas en español y paleta restringida a `neutral-*`.
- Enlace **Pedidos** en el header para que el historial sea accesible.
- Tipos `OrderSummary`, `OrderPage` y `OrderStatus` en `frontend/src/types/commerce.ts`, y métodos `getMyOrders` / `getMyOrder` en la capa de API.
- `JsonAuthenticationEntryPoint`: `401` con el mismo cuerpo estructurado (`timestamp`, `status`, `error`, `message`) que `GlobalExceptionHandler`.
- **Specs de la Tarea 5.4** (`specs/product-returns/`): plan, spec y tasks de las devoluciones de productos, aprobadas y pendientes de implementar.
- **21 tests nuevos**: 90 backend → **106**, 54 frontend → **65**. Cobertura del proyecto **82,6 %**.
- Propiedad `app.base-url` (default `http://localhost:3000`) para construir los enlaces absolutos que viajan dentro de los emails transaccionales.
- Helper `isUnverifiedEmailError()` en `frontend/src/lib/errors.ts` para detectar el error de cuenta sin verificar y ofrecerle salida.
- **16 tests nuevos**: 84 backend → **90**, 44 frontend → **54**. `EmailService` con cobertura del **100 %** de líneas y ramas.
- **Perfil de usuario** `/profile` con edición de datos personales, validación en cliente y confirmación de guardado. El email se muestra en solo lectura.
- **Gestión de direcciones** `/addresses` con alta, edición, borrado con confirmación en línea, badge "Principal" y límite de 2 direcciones.
- **Protección de rutas** mediante el componente `ProtectedRoute`, que redirige a `/login` y muestra un estado de carga mientras se resuelve el token.
- **Recomendación de talla** según las medidas del perfil: `POST /api/v1/users/me/size-recommendation`, con servicio `SizeRecommendationService` y confianza Alta/Media/Baja.
- Endpoints de perfil y direcciones: `GET/PUT /api/v1/users/me` y CRUD en `/api/v1/users/me/addresses`.
- DTOs `ProfileUpdateRequest`, `AddressRequest`, `AddressResponse`, `SizeRecommendationRequest` y `SizeRecommendationResponse`.
- Excepción `ResourceNotFoundException` con manejo centralizado a `404` en `GlobalExceptionHandler`.
- Método `refreshUser()` en `AuthContext` para refrescar el usuario global tras editar el perfil.
- Métodos `getProfile`, `updateProfile`, `getAddresses`, `createAddress`, `updateAddress`, `deleteAddress` y `recommendSize` en `frontend/src/lib/api.ts`.
- **27 tests nuevos**: 44 backend → **84**, 27 frontend → **44**. Cobertura de las clases de la feature entre 88,6 % y 100 %.
- Página de recibo y comprobante de compra `/orders/[orderNumber]` con desglose fiscal y auditoría de `Idempotency-Key`.
- Método `getOrder` en la capa de API de TypeScript (`frontend/src/lib/api.ts`).
- Suite de pruebas unitarias y de componentes para frontend con **Vitest**, **React Testing Library** y **jsdom**.
- Componentes **Skeleton** con animación de pulso sutil para el grid del catálogo (`ProductCardSkeleton`) y la ficha de producto (`ProductDetailSkeleton`), evitando layout shifts (CLS).
- **ErrorBoundary** con fallback editorial elegante y botón de reintento para capturar errores de renderizado sin mostrar pantallas en blanco.
- Utility `cn()` para combinación inteligente de clases Tailwind (clsx + tailwind-merge).
- **Carrito de compra** con estado global (`CartContext`), persistencia en `localStorage`, icono con badge en header y botón "Añadir a la bolsa" (modelo Zara).
- Confirmación visual temporal (toast) al añadir items al carrito.
- **Drawer lateral del carrito** con animación suave, controles de cantidad y acceso a página completa (`/cart`).
- **Checkout multilínea** con selección automática de almacén óptimo por distancia geográfica (Haversine).
- **Página de confirmación de pedido** estilo Zara con resumen y acceso al recibo.
- **Página de recibo** `/receipt/[orderNumber]` con descarga PDF funcional.

### Changed
- El checkout asocia el pedido al usuario autenticado: `OrderController` pasa `Authentication.getName()` y `OrderService.resolveUser()` setea `Order.user`. Un checkout sin sesión sigue quedando con `user_id` nulo.
- `Order.items` declara `@BatchSize(size = 20)`: el historial cuenta los artículos de una página completa con una sola consulta extra en lugar de una por pedido (N+1).
- `OrderRepository.findByUserIdOrderByCreatedAtDesc` va deliberadamente **sin** `@EntityGraph`: hacer fetch de una colección junto a una paginación truncaría los items en el corte de página. El detalle sí lo lleva, al no paginar.
- La cabecera del header muestra «Pedidos» y «Cuenta» por separado.
- Migración de la lectura de parámetros dinámicos en PDP y Recibo hacia el hook síncrono `useParams` de Next.js.
- Redirección automática desde la PDP hacia la URL persistente del pedido tras el checkout exitoso.
- Los formularios de perfil y direcciones usan `noValidate` para que la validación custom (mensajes amigables en español) sea quien controla el envío, conservando `required`/`min`/`max` como pistas de accesibilidad.
- `refresh()` en la página de direcciones recarga mediante clave de estado en lugar de una llamada directa dentro del efecto, cumpliendo `react-hooks/set-state-in-effect`.

### Fixed
- **Código muerto en la ficha de producto**: `ProductDetailPage` declaraba `handleCheckout` y `checkoutLoading` que ningún botón ejecutaba —la PDP nunca tuvo «Comprar ahora», solo «Añadir a la bolsa»— junto con imports y tipos residuales (`use`, `Order`, `PageProps`, `useRouter`, `useAuth`). Se eliminan; 5 warnings de ESLint de ese fichero pasan a 0 y el componente pierde 55 líneas que no podían ejecutarse.
- **El checkout siempre devolvía `401` con la sesión iniciada**: `api.checkout()` y `api.getOrder()` montaban sus cabeceras a mano sin incluir `getAuthHeaders()`, y como `/api/v1/orders/**` es `authenticated()` en `SecurityConfig`, el backend rechazaba la petición. El fallo era **anterior a la Tarea 5.3** (se reproducía igual en `main`, donde respondía `403`); la Tarea 5.3 solo cambió el código al correcto `401`. Ahora ambas llamadas envían `Authorization`, y el recibo y la confirmación de pedido vuelven a ser consultables.
- **Guard de sesión antes de comprar**: pulsar «Tramitar pedido» sin sesión no emite ninguna petición al backend; muestra *«Inicia sesión para completar tu compra»* con enlace a `/login` en el carrito y en la ficha de producto.
- **9 páginas pintaban el error técnico en crudo** (`err.message` → `API Error [401]: {…}` con timestamps y campos internos), incumpliendo la regla #9 de `AGENTS.md`: home (catálogo y búsqueda semántica), carrito, ficha de producto (carga y checkout), `forgot-password` (2), recibo y confirmación de pedido. Todas pasan ya por `getFriendlyErrorMessage()`.
- `getFriendlyErrorMessage()` no cubría los códigos HTTP del proyecto (AGENTS.md §4.5): añadidos `401`, `403`, `404` y `409`. El matching va **anclado al prefijo** `API Error [n]` —nunca al número suelto— porque `401.00` o `500.00` en un importe activaban el mensaje equivocado.
- `getFriendlyErrorMessage()` aplicaba `includes("500")`: un `409` con un cuerpo que contuviera `500.00` devolvía *«Inténtalo de nuevo en unos minutos»*. Ahora también anclado; el mensaje visible no cambia, solo desaparece el falso positivo.
- **Sin credencial se respondía `403` en lugar de `401`**: en una API sin login por formulario, Spring Security devolvía *prohibido* cuando en realidad faltaba la credencial. Ahora `SecurityConfig` declara `JsonAuthenticationEntryPoint`. Afectaba por igual a `/users/me`, `/users/me/addresses`, `/orders/...` y el nuevo historial.
- **Un token inválido o malformado rompía la petición con `500`**: `JwtAuthenticationFilter` dejaba propagar `MalformedJwtException` desde `extractEmail()`. Ahora el token se descarta, la petición sigue sin autenticar y el entry point responde `401`. Test que lo reproduce: `JwtAuthenticationFilterTest#shouldIgnoreMalformedTokenInsteadOfFailing`.
- **Textos invisibles en modo oscuro**: `globals.css` conservaba el bloque `@media (prefers-color-scheme: dark)` heredado de create-next-app, que cambiaba `--foreground` a `#ededed` mientras **todas** las páginas fijan fondos claros (`bg-neutral-50`, `bg-white`). Cualquier elemento sin color propio salía `rgb(237,237,237)` sobre blanco — le pasaba al logo «Nexus Core» en **todas** las páginas y a «Ver recibo» y «Reintentar» en `/orders`. Se elimina el bloque (la paleta clara es fija por diseño) y los tres elementos pasan a declarar color explícito. Guardia: `GlobalsCss.test.ts`.
- **Acceso al código de verificación de email**: la pantalla `/verify-email` existía pero no tenía puntos de entrada alcanzables. El email llegaba sin enlace y `/login` solo permitía llegar tras un reenvío exitoso, dejando al usuario atrapado en el bucle *login → "revisa tu bandeja" → email sin enlace → login sin botón*. Ahora:
  - Los emails de verificación y de recuperación incluyen enlace absoluto con el email ya precargado (`EmailService` + nueva propiedad `app.base-url`).
  - `/login` muestra un enlace directo *«¿Ya tienes un código? Verifica tu cuenta»*.
  - `/login` muestra un botón *«Verificar ahora»* cuando el fallo es *email no verificado*, precargando el email introducido.
- `/verify-email` traducía los errores con `err.message` en crudo; ahora usa `getFriendlyErrorMessage()` (regla #9 de `AGENTS.md`).
- Los dos inputs de `/verify-email` no llevaban `text-neutral-900`, dejando el texto casi invisible (regla #7 de `AGENTS.md`). Igual que los 3 inputs de `/forgot-password`.
- Los 16 `label` de `/login`, `/register`, `/verify-email` y `/forgot-password` no estaban asociados a su control (`htmlFor`/`id`), por lo que pulsar el texto no enfocaba el campo y los lectores de pantalla no los anunciaban.
- Código muerto en `/register`: `useRouter` se importaba y declaraba sin usarse.
- Limpieza reactiva de estado en `ProductDetailPage` al cambiar de talla para evitar el arrastre de inventario de otros SKUs.
- Tratamiento editorial y silencioso del estado "Agotado" sin exponer errores técnicos JSON 400 al usuario.
- Label del campo email en `/profile` sin asociación `htmlFor`/`id`, inaccesible para lectores de pantalla.
- 238 ficheros duplicados con sufijo `" 2"` generados por la resolución de conflictos de git (incluidas migraciones Flyway duplicadas que impedían arrancar el backend).