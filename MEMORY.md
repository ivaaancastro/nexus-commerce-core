# MEMORY.md — Nexus Commerce Core

> **Archivo de memoria persistente para agentes IA y desarrolladores.**
> Este archivo consolida todo el contexto del proyecto para mantener continuidad entre sesiones.
> Se actualiza al completar tareas o cuando hay cambios importantes.

---

## Estado Actual

| Aspecto | Valor |
|:---|:---|
| **Rama actual** | `main` |
| **Fase actual** | Fase 5 (**completada**) · 3.2 — Mercado y Divisa (**completada**) |
| **Tarea actual** | Sin tarea activa — pendiente definir la siguiente |
| **Estado** | **3.2 cerrada**: PR **#17** mergeado en `main` (`3214502`, 2026-10-06) · **143 backend + 147 frontend** · ESLint 4 (baseline) · CI verde |
| **Pendiente** | Definir la siguiente tarea (3.1, 3.3 o Fase 4) → escribir `plan.md` y pedir aprobación de la spec |
| **Última actualización** | 2026-10-06 |

---

## Resumen del Proyecto

**Nexus Commerce Core** es un backend transaccional de alto rendimiento para retail global, con frontend editorial en Next.js.

### Stack
- **Backend**: Spring Boot 3.4 + Java 21 + PostgreSQL 16 + pgvector
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Auth**: Spring Security + JWT + BCrypt
- **Email**: Mailtrap (desarrollo) / SendGrid (producción)

---

## Tareas Completadas

### Fase 1 — Resiliencia UI
- [x] Tarea 1.2 — Skeletons de Carga y Error Boundaries

### Fase 2 — Carrito de Compra
- [x] Tarea 2.1 — Estado Global de la Bolsa (CartContext)
- [x] Tarea 2.2 — Cajón Lateral de la Bolsa (Cart Drawer)
- [x] Tarea 2.3 — Checkout Multilínea con selección automática de almacén

### Fase 3 — Experiencia Editorial
- [x] **Tarea 3.2 — Selector Dinámico de Mercado y Divisa** — ✅ **cerrada 2026-10-06** · PR **#17** (`3214502`) · spec `specs/market-currency-selector/`
  - [x] Backend: `GET /api/v1/markets` público (`MarketController` + `MarketService` + `MarketResponse`), `permitAll()` en `SecurityConfig`
  - [x] Migración `V11__complete_market_price_matrix.sql` — completa la matriz 8/8 (los seeds de V1 solo cubrían talla M en ES/UK/CH, así que **US y la talla L devolvían 404**); `ON CONFLICT DO NOTHING` → idempotente
  - [x] Frontend: `MarketContext` (objeto completo en `localStorage["nexus-market"]`, default `ES`, reset ante JSON corrupto o código desconocido) + `<select>` accesible en `Header` que no se pinta sin lista
  - [x] Precios y checkout con el mercado activo; ficha con `Promise.allSettled` → «No disponible en {mercado}» si el SKU no tiene precio en ese mercado (el stock sigue visible)
  - [x] Re-precificado del carrito (D2) con `applyRepriceToItems` estable y `isRepricing` **derivado**; artículo sin precio **se conserva** marcado y bloquea el checkout (D6)
  - [x] Copy «IVA» → «Impuestos» (4 sitios) + **R8b aprobado**: el «50€» del envío gratuito pasó a `50 {currency}`
  - [x] Tests: **+4 backend** (143) y **+22 frontend** (147) · `/spec-check` **10/10** · prueba manual en navegador (ES/UK/US/CH, checkout real `{"marketCode":"US"}` → 201, orden `ORD-E5AD5491` inalterada al cambiar a CH)
  - ⚠️ **Impacto transversal**: el `<select>` añade un 2º `combobox` → `waitForAddressSelected()` busca por nombre accesible; la aserción R9 mira el importe completo, no la divisa suelta
  - ⚠️ **Desviación documentada**: `useMarket()` usa el valor por defecto de `createContext` en vez de lanzar error (el estado degradado es correcto: sin provider no hay lista y no se pinta el selector)
  - ⚠️ **Fuera de alcance**: `addresses/page.tsx` mantiene `countryCode` fijo por defecto (es una dirección, no de mercado)

### Fase 5 — Gestión de Usuarios (EN CURSO)
- [x] Tarea 5.1 — Registro y Login
  - [x] Backend: Entidades, repositorios, seguridad JWT, AuthService, AuthController
  - [x] Frontend: AuthContext, páginas login/register/verify-email/forgot-password
  - [x] Tests: 38 backend + 27 frontend
  - [x] Email: Mailtrap configurado
  - [x] Flujo completo verificado end-to-end: registro → email → código → login con JWT
- [x] Tarea 5.2 — Perfil de Usuario y Direcciones
  - [x] Backend: `UserService`, `AddressService`, `SizeRecommendationService`, `UserController`
  - [x] Frontend: `/profile`, `/addresses`, `ProtectedRoute`
  - [x] Tests: 84 backend + 44 frontend
  - [x] Specs: `specs/user-profile/` completa (plan, spec, tasks)
  - [x] Commit `0cf6116` + PR #10 — CI 2/2 green (backend 84, frontend 44)
  - [x] Cobertura: UserController 100%, UserService 100%, AddressService 98,6%, SizeRecommendationService 88,6%
  - [x] PR #11 — fix de puntos de entrada de verificación de email (`fix/verify-email-entry-points`)
    - [x] Enlaces en ambos emails + `app.base-url`, enlace directo y botón contextual en `/login`
    - [x] Reglas #7 y #9 corregidas, `htmlFor`/`id` en los 16 labels de auth
    - [x] 90 backend + 54 frontend · `EmailService` 100% líneas y ramas
- [x] Tarea 5.3 — Historial de Pedidos — **PR #12 mergeado en `main`** (`cd9ca74`, 2026-10-05)
  - [x] Specs: `specs/user-orders/` (plan, spec, tasks) ✅ aprobada el 2026-10-01
  - [x] Backend: `UserOrderController`, `OrderSummaryResponse`, `OrderPageResponse`, `listOrders` / `getOrderForUser`
  - [x] Asociación de usuario al checkout: `OrderController` pasa `Authentication`, `OrderService.resolveUser()` setea `Order.user`
  - [x] `OrderStatus` gana `SHIPPED` y `DELIVERED` (sin migración: la columna es `VARCHAR(32)`)
  - [x] Pertenencia comprobada en la consulta → «no existe» y «es de otro usuario» devuelven ambos `404`
  - [x] Frontend: `/orders` con tarjetas, `OrderStatusBadge`, paginación, `ProtectedRoute`, enlace «Pedidos» en el header
  - [x] Tests: 90 → **106** backend, 54 → **65** frontend · cobertura **82,6 %**
  - [x] e2e verificado contra la BD: checkout deja `user_id`, historial ordenado, `404` ajeno, `401` sin token
  - [x] Bugs preexistentes corregidos: `403`→`401` sin credencial, `500`→`401` con token malformado
  - [x] `globals.css`: eliminado el bloque `prefers-color-scheme: dark` heredado de create-next-app (dejaba `--foreground: #ededed` sobre fondos claros → textos invisibles; afectaba al logo del header en todas las páginas)
  - [x] Specs 5.4 (`specs/product-returns/`) escritas y aprobadas en paralelo
- [x] Fix de checkout 401 (`specs/checkout-auth/`) — **PR #13 mergeado en `main`** (`8704dff`, 2026-10-05)
  - [x] **Decisión: el checkout requiere sesión** — sin `permitAll` en `/api/v1/orders/checkout`; el carrito no emite la petición y muestra «Inicia sesión para completar tu compra»
  - [x] `api.checkout()` / `api.getOrder()` no enviaban `Authorization` (bug preexistente desde su creación)
  - [x] 9 páginas pintaban `err.message` crudo → traducidas con `getFriendlyErrorMessage()`
  - [x] `getFriendlyErrorMessage()` anclado al prefijo `API Error [n]` con `isHttpStatus()`, y reglas nuevas para `401/403/404/409`
  - [x] Código muerto de checkout en la PDP eliminado (`handleCheckout`, `checkoutLoading`, imports residuales)
  - [x] Tests: backend 106 · frontend 88
- [x] Tarea 5.4 — Devoluciones de Productos (`specs/product-returns/`) — **mergeada en `main` (PR #14, `136c584`, 2026-10-05)**
  - [x] Specs: `specs/product-returns/` (plan, spec, tasks) ✅ aprobada el 2026-10-01
  - [x] Backend: migración `V9__product_returns.sql`, `ProductReturn`, `ReturnStatus`, `ReturnEligibilityService` (con `Clock` inyectable), `ReturnService`, `ReturnNotAllowedException` → `409`, endpoints `POST/GET …/{orderNumber}/returns`
  - [x] `OrderItemResponse` gana `returnEligible` + `returnIneligibleReason`
  - [x] Orden de elegibilidad `NOT_DELIVERED → ALREADY_RETURNED → EXPIRED`: el checkout (pedido `PENDING`) sale sin consultar la BD y una línea ya devuelta no muestra «plazo agotado»
  - [x] `refundAmount = unitPrice × quantity`, `BigDecimal` + `HALF_UP` escala 2 — **registro contable, no mueve dinero** (no hay PSP)
  - [x] **Bug de la spec corregido** (aprobado el 2026-10-05): la fórmula original sumaba `taxAmount`, pero `unit_price` ya es bruto con IVA incluido → declaraba 93,83 EUR por una línea pagada a 79,95 EUR. Test de regresión `shouldNotAddTaxAgain()`
  - [x] Carrera sobre el `UNIQUE (order_item_id)` → `DataIntegrityViolationException` → `409`, nunca `500`
  - [x] **Ampliación de spec** (anotada en §5): el `409` de devoluciones añade `code: RETURN_NOT_ALLOWED`, porque `getFriendlyErrorMessage()` traducía *todo* `409` a «No queda stock suficiente…»
  - [x] Frontend: sección «Devoluciones» en `/orders/[orderNumber]` con botón «Devolver», motivo legible (R8), formulario `noValidate`, estado `Solicitada` + importe y toast. Solo con sesión
  - [x] Tests: 106 → **134** backend, 88 → **101** frontend
  - [x] **«Ver pedido»** en el historial — la sección era *inalcanzable* desde la UI: el listado solo enlazaba al recibo
  - [x] Docs: `CHANGELOG.md`, `README.md` §3 (añadidos también los endpoints de la 5.3, que faltaban), puntero en `specs/user-orders/spec.md`
- [x] Tarea 5.5 — **Rediseño de la página de pedido** (`specs/order-detail-redesign/`) — **mergeada en `main` (PR #15, `e23b86c`, 2026-10-06)**
  - [x] Specs: `specs/order-detail-redesign/` (plan, spec, tasks) ✅ aprobada el 2026-10-05
  - [x] Decidido con el usuario el 2026-10-05: **placeholder editorial** para las fotos (el proyecto no tiene ni una imagen), **snapshot de dirección** en la orden + paso en el checkout, y **método de pago como dato declarado** sin procesar
  - [x] Backend: migración `V10__order_shipping_payment.sql` (6 columnas nullable, sin backfill), `ShippingAddress` `@Embeddable`, `PaymentMethod` enum, `AddressRepository.findByIdAndUserId`
  - [x] `CheckoutRequest` + `addressId` y `paymentMethod` con `@NotNull`; la dirección se resuelve **antes del bucle de reserva** para no tocar inventario con una dirección inválida
  - [x] ⚠️ **Consecuencia registrada**: `addressId` obligatorio + verificar propiedad ⇒ **ya no existe checkout de invitado** (plan §5.10)
  - [x] `OrderResponse` + `returnDeadline` (desde `ReturnEligibilityService.WINDOW_DAYS`, fuente única), `shippingAddress`, `paymentMethod`; `OrderItemResponse` + `productName`, `productFamily`, `size`, `color`
  - [x] **Ampliación de alcance detectada al implementar**: `OrderSummaryResponse` no traía **ninguna línea** (solo `itemCount`), así que R9/R10 eran imposibles → gana `items` (`OrderItemPreviewResponse`) y `returnRequested`, con **una única consulta por página** (`ProductReturnRepository.findOrderItemIdIn`), no 40 queries. Plan §5 corregido **antes** de tocar código
  - [x] `@BatchSize(size = 20)` a nivel de **clase** en `Sku` y `Product` — en `@ManyToOne` Hibernate lanza *«Property may not be annotated '@BatchSize'»* (rompía `contextLoads`)
  - [x] Frontend: `BackLink` (6 pantallas), `ProductThumb` (placeholder compartido), ficha reescrita en 9 secciones, historial con nombre + variante + badge, carrito con selectores de dirección y pago
  - [x] Banner «Gracias por tu compra» **solo** al llegar del checkout (`sessionStorage["nexus-just-checked-out"]` en `src/lib/checkout.ts`, consumido al leerlo)
  - [x] `/addresses`: el botón «Volver al perfil» existente llamaba a `window.history.back()` **sin fallback** → sustituido por `BackLink href="/profile"`
  - [x] `CartItemRow` delega su caja en `ProductThumb`; su rama `<img>` era código muerto (`imageUrl` nunca se asigna)
  - [x] **Sin ADR**: no cambia stack ni arquitectura (plan §3)
  - [x] Tests: 134 → **139** backend, 101 → **125** frontend · `tsc --noEmit` limpio · `next build` OK · ESLint **9 problems (4 errors, 5 warnings)**, los 4 errores los preexistentes de `main`
  - [x] Cobertura backend **86 %** vs **85 %** de `main` (medida en worktree aparte): sin regresión
  - [x] Verificación final: `/spec-check order-detail-redesign` ✅ **APROBADO (10/10)** + prueba manual en navegador (2026-10-06, R1–R10) + CI verde. Detectó 2 desviaciones y ambas se corrigieron: la tarjeta del historial no pintaba el `color` que ya traía el DTO (test R9 reforzado) y el copy de `BackLink` es contextual en 4 pantallas (documentado en spec R5)

---

## Tareas Pendiente

### Fase 5 — Gestión de Usuarios
- [x] **Tarea 5.5 cerrada** — PR #15 mergeado en `main` (`e23b86c`, 2026-10-06). ✅ La Fase 5 no tiene pendientes

### Fase 3 — Experiencia Editorial
- [ ] Tarea 3.1 — Navegación por Familias y Filtros
- [x] **Tarea 3.2 cerrada** — PR **#17** mergeado en `main` (`3214502`, 2026-10-06) · 10/10 · CI verde ✅ Quedan 3.1 y 3.3
- [ ] Tarea 3.3 — Galería de Imágenes Responsive

### Fase 4 — Calidad Enterprise
- [ ] Tarea 4.1 — Suite de Pruebas Unitarias de Componentes
- [ ] Tarea 4.2 — Test E2E con Playwright
- [ ] Tarea 4.3 — Auditoría Core Web Vitals y Accesibilidad

---

## Decisiones Importantes

| Decisión | Detalle |
|:---|:---|
| **Flujo de trabajo** | GitHub Flow con Pull Requests |
| **Commits/Pushes** | Preguntar siempre antes |
| **Ramas** | Una por tarea, merge a rama padre |
| **Estilo UI** | Estilo editorial Zara (neutral-*, uppercase, tracking-widest) |
| **Auth** | JWT + BCrypt, roles: solo USER por ahora |
| **Email** | Mailtrap (desarrollo), SendGrid (producción) |
| **Validación** | Frontend: simple y robusta; Backend: completa |
| **Mercado 3.2** | Se persiste el **objeto entero** en `localStorage["nexus-market"]` (no solo el código) para pintar con divisa y tasa correctas desde el primer render |
| **Precios 3.2** | Sin FX ni conversión: cada mercado tiene su precio sembrado a mano; `V11` es re-ejecutable (`ON CONFLICT DO NOTHING`) |
| **D6 — sin precio** | Un artículo sin precio **nunca se borra** del carrito: se marca `priceUnavailable` y bloquea el checkout |
| **Copy fiscal** | «Impuestos» en vez de «IVA» (UK es VAT, US *sales tax*); el envío gratuito traduce la **moneda**, no el valor |
| **ADR 3.2** | No hace falta (D8): no cambia stack ni arquitectura |

---

## Estructura de Documentación

| Archivo | Contenido |
|:---|:---|
| `AGENTS.md` | Convenciones completas para agentes IA |
| `MEMORY.md` | Este archivo — estado actual del proyecto |
| `docs/constitution.md` | Visión, principios, arquitectura, stack |
| `docs/adr/` | Architecture Decision Records |
| `specs/` | Planes y especificaciones por feat |
| `CHANGELOG.md` | Registro de cambios |

---

## Notas de Contexto

- **Usuario**: Iván Castro
- **Proyecto**: Nexus Commerce Core
- **Inicio**: 2026-09-25
- **Convenciones**: Ver `AGENTS.md` en la raíz del proyecto
- **Repo movido a `~/nexus-commerce-core`** (2026-10-01): estaba en `~/Documents/proyects/`, carpeta sincronizada con iCloud Drive. El file provider (`fileproviderd`) restauraba duplicados `" 2.*"` ya borrados y llegó a romper compilación y builds. Verificado tras el movimiento: sin `com.apple.file-provider-domain-id`, 0 duplicados. **Al escanear duplicados usa un patrón que cubra ficheros sin extensión** (`LOG 2`), p. ej. `find . -not -path "./.git/*" -not -path "*/node_modules/*" -type f -regex '.* [0-9][0-9]*\(\.[^./]*\)\?$'` — el patrón `* [0-9]*.*` exige un punto y pasa por alto esos ficheros.
- **`backend/target/` y `frontend/.next/`**: si el build falla con `Unexpected file in persistence directory`, hay un duplicado en la caché → `rm -rf backend/target frontend/.next`.

---

*Última actualización: 2026-10-05 por agente IA — Tarea 5.4 mergeada (PR #14, `136c584`); abierta la Tarea 5.5 en `feat/order-detail-redesign`.*
