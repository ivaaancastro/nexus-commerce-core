# MEMORY.md — Nexus Commerce Core

> **Archivo de memoria persistente para agentes IA y desarrolladores.**
> Este archivo consolida todo el contexto del proyecto para mantener continuidad entre sesiones.
> Se actualiza al completar tareas o cuando hay cambios importantes.

---

## Estado Actual

| Aspecto | Valor |
|:---|:---|
| **Rama actual** | `feat/order-detail-redesign` |
| **Fase actual** | Fase 5 — Gestión de Usuarios y Autenticación |
| **Tarea actual** | Tarea 5.5 — Rediseño de la página de pedido (**implementada, sin commitear**) |
| **Estado** | 5.3 (PR #12), fix de checkout (PR #13) y **5.4 (PR #14, `136c584`)** mergeadas · **139 backend + 125 frontend** · pendiente commit + PR de la 5.5 |
| **Última actualización** | 2026-10-05 |

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
- [ ] Tarea 5.5 — **Rediseño de la página de pedido** (`specs/order-detail-redesign/`) — **implementada, sin commitear**
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
  - [ ] **Pendiente**: commit + push + PR + `/spec-check order-detail-redesign`

---

## Tareas Pendiente

### Fase 5 — Gestión de Usuarios
- [ ] **Cerrar la Tarea 5.5**: commit + push + PR de `feat/order-detail-redesign` y `/spec-check order-detail-redesign` en verde (el código ya está implementado; ver *Tareas Completadas*)

### Fase 3 — Experiencia Editorial
- [ ] Tarea 3.1 — Navegación por Familias y Filtros
- [ ] Tarea 3.2 — Selector Dinámico de Mercado y Divisa
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
