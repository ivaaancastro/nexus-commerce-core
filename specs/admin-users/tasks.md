# Tasks — Tarea 7.5: Gestión de usuarios (ver, suspender, cambiar rol)

> **Fase 7 · Panel de administración** · spec `spec.md` (R1–R9) · plan `plan.md` (D1–D10).
> Un checkbox por unidad terminada; las decisiones y hallazgos quedan como nota
> debajo de su bloque. **Regla**: marcar al completar; nada de código fuera de
> este checklist.

---

## A — Migración V15, entidad, DTOs y excepciones (R2, R3, R4, plan D2/D3/D4/D5)

- [x] **A.1** `V15__user_suspension.sql`: `ALTER TABLE users ADD COLUMN suspended_at TIMESTAMPTZ NULL` con `IF NOT EXISTS` (estilo V13/V14, reejecutable; `NULL` = activo)
- [x] **A.2** `User.java` gana `suspendedAt` (nullable, `@Column(name = "suspended_at")`) con Javadoc de la 7.5 — **ningún otro campo nuevo**
- [x] **A.3** DTOs admin: `AdminUserResponse` (id, email, firstName, lastName, role, `suspended` derivado `suspendedAt != null`, suspendedAt, createdAt) · `AdminUserPageResponse` (users, page, size, totalElements, totalPages) · `AdminUserRoleRequest` (`@NotNull role`, enum) · `AdminUserSuspensionRequest` (`@NotNull suspended`) — un único record compartido por lista y `PUT` (plan D5)
- [x] **A.4** Excepciones: `UserSuspendedException` + handler en `GlobalExceptionHandler` → **`403`** con `message` «La cuenta está suspendida. Contacta con soporte.» · `UserConflictException` + handler → **`409`** con `code: "USER_CONFLICT"` y `message` (patrón `ORDER_CONFLICT`; **no** reutilizar `IllegalStateException`, plan §2.2/D3)
- [x] **A.5** `SecurityConfig` **sin ningún cambio** (verificado por diff vacío — los 3 endpoints caen en `/api/v1/admin/**`, R5)

## B — Repositorios, servicios, controller y auth (R1–R4, plan D1/D3/D4/D5)

- [x] **B.1** `UserRepository`: query de **listado admin** (`q` opcional sobre `LOWER(email)`/`LOWER(first_name)`/`LOWER(last_name)` con `LIKE %q%` y **`CAST(:q AS string)` obligatorio**, `ORDER BY createdAt DESC, id DESC`, `Pageable`) con `countQuery` a mano + `countByRoleAndSuspendedAtIsNull` (guarda D4, una query por acción)
- [x] **B.2** `AdminUserService.listar(page, size, q)`: `q` **recortado en servidor** (vacío/ausente = sin filtro), respuesta paginada, mapper **sólo escalaros** (sin abrir `addresses`/`orders` — sin N+1); sin resultados → `200` lista vacía (R1.1–R1.6)
- [x] **B.3** `AdminUserService.cambiarRol(id, role)`: `404` si no existe · degradar al **último admin activo** → `409 USER_CONFLICT` **antes de escribir** · **auto-degradación permitida** si queda ≥ 1 admin activo distinto · devuelve `AdminUserResponse` actualizado (R2)
- [x] **B.4** `AdminUserService.cambiarSuspension(id, suspended)`: `404` · **auto-suspensión** (id = token propio) → `409 USER_CONFLICT` «No puedes suspenderte a ti mismo» · suspender al **último admin activo** → `409` · **idempotente** (suspender ya suspendida conserva el instante original; restaurar activa, igual) · suspender → `suspendedAt = now`, restaurar → `null` **sin tocar el rol** · guardas previas a la escritura (en `409` la BD no cambia) (R3)
- [x] **B.5** `AdminUserController` con los 3 endpoints (`GET /api/v1/admin/users`, `PUT .../{id}/role`, `PUT .../{id}/suspension`) bajo `@RequestMapping("/api/v1/admin/users")`, `@Tag`/`@Operation` en español, `@Valid` en los bodies (R1, R2, R3)
- [x] **B.6** `AuthService.login`: chequeo de suspensión **en el orden D3** `usuario → contraseña → suspendido → emailVerified` — contraseña incorrecta → respuesta habitual (**sin** revelar suspensión, anti enumeración); suspendida y sin verificar → `403` de suspensión (R4)
- [x] **B.7** `AuthService.refreshToken`: tras recargar el usuario de BD, suspendido → `UserSuspendedException` **sin emitir tokens nuevos** (R4)
- [x] **B.8** Cero cambios en registro, verificación, reset de contraseña, `/api/v1/users/**` y vitrina (R4/R9.1.7, plan D8) — verificado por diff vacío: sólo `AuthService.login`/`refreshToken` (+constante/import) y `SecurityConfig` **intocado**

## C — Tests backend (R8.1, D10)

- [x] **C.1** `AdminUserServiceTest` (lista): búsqueda por email/nombre (case-insensitive) · `q` con espacios recortado · vacío/ausente = sin filtro · orden `createdAt DESC` · paginación (`totalElements`/`totalPages`) · sin resultados → lista vacía
- [x] **C.2** `AdminUserServiceTest` (rol): `200` promover/degradar con respuesta actualizada · `404` · `400` rol desconocido (en controller, C.5) · `409` degradar al único admin activo **y la BD re-assertada intacta** · auto-degradación permitida con otro admin activo
- [x] **C.3** `AdminUserServiceTest` (suspensión): `200` suspende (`suspendedAt` poblado) y restaura (`null` conservando rol) · idempotencia conservando el instante · `404` · `409` auto-suspensión · `409` último admin
- [x] **C.4** `AuthServiceTest`: login suspendido con contraseña correcta → `UserSuspendedException` · precedencia suspendido > no verificado · login con contraseña incorrecta no revela la suspensión · refresh suspendido → excepción y **sin tokens** · login/refresh no suspendidos **intactos** (test de refresh feliz añadido — no existía)
- [x] **C.5** `AdminUserControllerTest` (MockMvc `@SpringBootTest` + BD real, patrón `AdminOrderControllerTest`): éxitos de los 3 endpoints con JSON assertions · `400` (campos ausentes/inválidos) · `404` · `409 USER_CONFLICT` con `code` · **seguridad** `401` sin token / `403` USER / `200` ADMIN
- [x] **C.6** **D10 — datos propios**: usuario `test-7501@nexus.dev` creado en `@Before` y borrado en `@After` (+ limpieza por marca «7501»); **nunca se modifica** `admin@nexus.dev` ni `e2e@nexus.dev` (los `409` usan un token «operador» con email distinto para no auto-suspenderse primero)
- [x] **C.7** `./mvnw test` en verde con la suite completa (**325 = 287 + 38**: +14 service, +5 auth, +18 controller); ningún test preexistente cambió su aserción

## D — Frontend: tipos, cliente y errores (R6, plan D7)

- [x] **D.1** Tipos: `AdminUser` (id, email, firstName, lastName, role, suspended, suspendedAt, createdAt) · `AdminUserPage` · `AdminUserRoleData` · `AdminUserSuspensionData` (espejo A.3) — en `types/auth.ts` (dominio de usuario)
- [x] **D.2** `lib/api.ts`: `getAdminUsers(params)`, `updateAdminUserRole(id, data)`, `setAdminUserSuspension(id, data)` con `getAuthHeaders()` — **`api.ts` ≥ 99 preservado**
- [x] **D.3** `lib/errors.ts`: regla por **texto «suspendida» antes** de la rama 403 genérica (evita «No tienes permiso…» en el login) · `409` con `code: USER_CONFLICT` → muestra el `message` del servidor (rama 409 existente)

## E — Frontend: superficies del panel (R6, R7, plan D7)

- [x] **E.1** `/admin/users`: tabla editorial (Email · Nombre · Rol · Estado · Alta · Acciones) — *Estado* «Activo» / «Suspendido desde dd/mm/aaaa» (sin fecha → «Suspendido») — con **campo de búsqueda en servidor** (`text-neutral-900`, label; `q` viaja a la API, **nunca `filter()`**)
- [x] **E.2** Acciones por fila condicionales (sin selects ni modales): «Suspender» → **`window.confirm`** · «Restaurar» sin confirmación · «Hacer administrador» sin confirmación · «Quitar administrador» → **`window.confirm`** → éxito: **toast** (fondo `neutral-900`, `text-xs uppercase`) + **fila actualizada con la respuesta del `PUT`, sin re-fetch**
- [x] **E.3** `409 USER_CONFLICT`: mensaje del servidor **bajo la fila** (`<tr>` extra con `role="alert"`), **sin toast de éxito**, fila sin modificar (patrón 7.3/7.4)
- [x] **E.4** Estados: cargando · vacío («Sin resultados») · error de red con `getFriendlyErrorMessage()` + «Reintentar» (patrón 7.4)
- [x] **E.5** `SECCIONES` de `app/admin/layout.tsx` gana `{ href: "/admin/users", label: "Usuarios" }` con `aria-current` · portada `/admin` gana **tarjeta «Usuarios»** y el aviso queda **sólo «7.6 Dashboard»** · `AdminRoute` **sin cambios**
- [x] **E.6** `tsc` 0, ESLint 0/0, estilo editorial (uppercase/tracking-widest en cabeceras, `border-neutral-200`)

## F — Tests frontend (R8.2, R8.3)

- [x] **F.1** `AdminUsersPage.test.tsx`: tabla y cabeceras · búsqueda que **consulta la API** · suspender con confirm → llamada + toast + fila actualizada · restaurar · cambiar rol con confirm al quitar · `409` muestra mensaje bajo la fila **sin toast** · estados vacío/cargando
- [x] **F.2** `Api.test.ts`: URLs/métodos/auth de las 3 funciones nuevas · **`errors.test`**: regla de suspensión (texto antes del 403) y rama `USER_CONFLICT` — `api.ts` ≥ 99
- [x] **F.3** Cambios **declarados** (R8.3): `AdminPage.test.tsx` → el aviso de roadmap pasa a **«7.6 Dashboard»** · `AdminLayout.test.tsx` → **aditiva** la sección «Usuarios». **Ningún otro test preexistente cambia su aserción**
- [x] **F.4** `npm run test:coverage` **EXIT 0** con los umbrales congelados (**441** — `npx vitest run` no evalúa umbrales)

## G — Documentación y cierre (R9.3, plan D9)

- [x] **G.1** `CHANGELOG.md` — entrada «7.5 — Gestión de usuarios (ver, suspender, cambiar rol) en el panel» en `[Unreleased]` (Keep a Changelog es-ES, arriba de `Added`)
- [x] **G.2** Bloque «ESTADO ACTUAL» de `AGENTS.md` **dentro de la feature PR** (verdad tras el merge, sin PR/SHA: fase, tarea → 7.6, tests **325 · 441**, mergeados + decisión 7.5) + **`MEMORY.md` refrescado en esta PR** (tabla + roadmap 7.5 `[x]` + sección detallada 7.5)
- [x] **G.3** **Sin ADR** (plan D9, `docs/adr/` sin altas) · **sin PR de documentación de cierre** (plan D9) · única migración `V15` (A.1), ningún cambio en V1–V14 (verificado con `git status`)

## Cierre

- [x] **Baselines**: `./mvnw test` **325** (287+38) · `npm run test:coverage` **441** (424+17: AdminUsersPage 9 + api 4 + errors 4) y EXIT 0 (85.58/81.83/82.86/87.69 sobre 77/76/74/79 + `api.ts` ≥ 99) · `tsc` 0 · ESLint 0/0 · `npm run build` 0 — **⚠️ hallazgo**: `next build` mientras un `next start` viejo seguía vivo dejó un `.next` **sin** `/admin/users` (la trampa de 7.4); reconstruido con `rm -rf .next` + build limpio y verificado en el manifest
- [x] **Verificación en navegador** (R9.1, backend real + `next start` en `:3001`): tabla con 6 columnas y orden `createdAt DESC` · búsqueda «  7501  » (con espacios) → sólo la fila propia · suspender con confirm → toast + «Suspendido desde 19/10/2026» + «RESTAURAR» **sin re-fetch** · suspender `admin@nexus.dev` → **`409` «No puedes suspenderte a ti mismo» bajo la fila, sin toast, fila intacta** · login de la cuenta suspendida → **«La cuenta está suspendida. Contacta con soporte.»** (no «No tienes permiso») · restaurar sin confirm → toast «CUENTA RESTAURADA» · login restaurado → OK (header sin «ADMIN») · promover sin confirm → «ROL ACTUALIZADO» · quitar admin con confirm → «Usuario» · USER en `/admin/users` → **redirigido a `/`**
- [x] **BD sin restos** (R9.2): `test-7501@nexus.dev` borrado (0 restos) · `admin@nexus.dev` = ADMIN con `suspended_at` NULL · `e2e@nexus.dev` sin tocar
- [x] `/spec-check admin-users` → **APROBADO** (R1–R9 con evidencia; 325 backend + 441 frontend en verde, gate EXIT 0; hallazgo 448→441 corregido en docs)
- [ ] **Preguntar al usuario antes de cualquier commit y PR** ⛔

---

## Notas de implementación

*(se rellenan con los hallazgos del camino)*
