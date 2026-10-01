# MEMORY.md — Nexus Commerce Core

> **Archivo de memoria persistente para agentes IA y desarrolladores.**
> Este archivo consolida todo el contexto del proyecto para mantener continuidad entre sesiones.
> Se actualiza al completar tareas o cuando hay cambios importantes.

---

## Estado Actual

| Aspecto | Valor |
|:---|:---|
| **Rama actual** | `feat/user-orders` |
| **Fase actual** | Fase 5 — Gestión de Usuarios y Autenticación |
| **Tarea actual** | Tarea 5.3 — Historial de Pedidos (implementada, pendiente commit + PR) |
| **Estado** | Specs 5.3 y 5.4 ✅ aprobadas · 106 backend + 65 frontend · e2e verificado |
| **Última actualización** | 2026-10-01 |

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
- [x] Tarea 5.3 — Historial de Pedidos (implementada, pendiente commit + PR)
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

---

## Tareas Pendiente

### Fase 5 — Gestión de Usuarios
- [ ] Tarea 5.4 — Devoluciones de Productos (`specs/product-returns/spec.md` ✅ aprobada)
  - Alcance acordado: registro contable del reembolso, sin mover dinero (no hay PSP), solo estado `REQUESTED`
- [ ] Tarea 5.3 — **commit + PR** (implementación ya terminada y verificada)

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

*Última actualización: 2026-10-01 por agente IA*
