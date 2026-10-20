# Tasks — Tarea 7.6: Dashboard con métricas

> **Fase 7 · Panel de administración** · spec `spec.md` (R1–R9) · plan `plan.md` (D1–D9).
> Un checkbox por unidad terminada; las decisiones y hallazgos quedan como nota
> debajo de su bloque. **Regla**: marcar al completar; nada de código fuera de
> este checklist.

---

## A — DTOs (R1, R3, plan D5)

- [x] **A.1** `AdminDashboardResponse` con bloques anidados `range` · `sales` · `products` · `users` + `RevenueCurrency(currency, total, orderCount, avgTicket)` — records inmutables en `dto`, **sin excepciones ni handlers nuevos**

## B — Repositorios, servicio y controller (R1–R4, plan D1–D4)

- [x] **B.1** Queries de agregado en repositories (sólo escalares, `COUNT`/`SUM`/`GROUP BY`): `OrderRepository` — `byStatus` en periodo (**5 claves**) y `revenue` **por moneda excluyendo `CANCELLED`** · catálogo (`total`/`skus`/`familias`) · `UserRepository` — `suspended` (`suspendedAt != null`) y `newInPeriod` (`createdAt ≥ from`); reutiliza `countByRoleAndSuspendedAtIsNull` de la 7.5
- [x] **B.2** `AdminDashboardService` `@Transactional(readOnly = true)`: `from = now − days` · validación **`1 ≤ days ≤ 365`** → `IllegalArgumentException` (handler existente 400+message) · `avgTicket` `HALF_UP` escala 2 · `revenue: []` sin pedidos (sin división) · **jamás cruza monedas**
- [x] **B.3** `AdminDashboardController`: `GET /api/v1/admin/dashboard` con `@RequestParam(defaultValue = "30")`, `@Tag`/`@Operation` en español — **`SecurityConfig` intocado** (diff = 0)

## C — Tests backend (R8.1, plan D8)

- [x] **C.1** `AdminDashboardServiceTest` (mocks, **números exactos**): exclusión de `CANCELLED` en ingresos y `orderCount` · `byStatus` con las 5 claves · agrupación por moneda sin cruzar · `avgTicket` `HALF_UP` escala 2 · `revenue: []` sin pedidos · `from = now − days` · `days` fuera de rango → excepción · `admins` sin suspender / `suspended` con cualquier rol
- [x] **C.2** `AdminDashboardControllerTest` (MockMvc `@SpringBootTest` + BD real, patrón 7.4/7.5): shape completo · `days` default y explícito · `days=0` → **`400` con `message`** · **consistencia** (claves de `byStatus`, `orderCount` ≤ suma de no cancelados) — **jamás globales exactos** · seguridad `401`/`403`/`200`
- [x] **C.3** `./mvnw test` en verde con la suite completa (**325+**); ningún test preexistente cambió su aserción

## D — Frontend: tipos y cliente (R6, plan D7)

- [x] **D.1** Tipos `AdminDashboard` · `DashboardRange` · `DashboardSales` · `RevenueCurrency` · `DashboardProducts` · `DashboardUsers` (espejo de A.1) — en `types/commerce.ts`
- [x] **D.2** `lib/api.ts`: `getAdminDashboard(days?)` con `days` como query param y `getAuthHeaders()` — **`api.ts` ≥ 99 preservado** · **`errors.ts` sin cambios** (sin códigos nuevos)

## E — Frontend: `AdminMetrics` y portada (R6, R7, plan D7)

- [x] **E.1** Componente `components/admin/AdminMetrics.tsx`: 4 tarjetas (Ventas con ingresos/ticket **por moneda** y label «pedidos no cancelados» · 5 estados con **barras CSS** relativas · Catálogo · Usuarios) + **selector 7/30/90** (activo `border-neutral-900`)
- [x] **E.2** Estados: cargando · error con `getFriendlyErrorMessage()` + «Reintentar» · periodo vacío con **ceros visibles** (nunca `NaN`/«—») · importes con `Intl.NumberFormat("es-ES", { style: "currency", currency })`
- [x] **E.3** `/admin`: `AdminMetrics` **arriba**, 4 tarjetas de acceso **debajo intactas**, saludo conservado · **el bloque «En construcción» desaparece** (R7) · `SECCIONES` y `AdminRoute` **sin cambios**
- [x] **E.4** `tsc` 0, ESLint 0/0, estilo editorial (uppercase/tracking-widest, `border-neutral-200`, `text-neutral-900` si hay inputs)

## F — Tests frontend (R8.2, R8.3)

- [x] **F.1** `AdminMetrics.test.tsx`: render de los 4 bloques · selector que **llama a la API** con el `days` nuevo · estados cargando / error+«Reintentar» · vacío con ceros · formato de moneda por fila
- [x] **F.2** `Api.test.ts`: URL/`days` query/`Authorization` de `getAdminDashboard` — `api.ts` ≥ 99
- [x] **F.3** Cambio **declarado** (R8.3): `AdminPage.test.tsx` retira «en construcción»/«7.6» y añade la sección de métricas; saludo, rol, 4 tarjetas y `replace` sin llamar **intactos**. **Ningún otro test preexistente cambia su aserción** (`AdminLayout.test` sin tocar)
- [x] **F.4** `npm run test:coverage` **EXIT 0** con los umbrales congelados (**441+** — `npx vitest run` no evalúa umbrales)

## G — Documentación y cierre (R9.3, plan D9)

- [x] **G.1** `CHANGELOG.md` — entrada «7.6 — Dashboard con métricas» en `[Unreleased]` (Keep a Changelog es-ES)
- [x] **G.2** Bloque «ESTADO ACTUAL» de `AGENTS.md` **dentro de la feature PR** (verdad tras el merge, sin PR/SHA: **Fase 7 completa**, tarea siguiente → **Fase 8 / 8.1 Dockerfile**) + **`MEMORY.md` refrescado en esta PR** (tabla + roadmap 7.6 `[x]` + sección 7.6)
- [x] **G.3** **Sin ADR** (plan D9) · **sin PR de documentación de cierre** · **sin migración** (R9.4: `db/migration/` sin altas, V1–V15 intactos)

## Cierre

- [x] **Baselines**: `./mvnw test` **325+** · `npm run test:coverage` **441+** y EXIT 0 (77/76/74/79 + `api.ts` ≥ 99) · `tsc` 0 · ESLint 0/0 · `npm run build` 0
- [x] **Verificación en navegador** (R9.1, backend real + frontend): ADMIN ve métricas **sobre** las tarjetas · selector 7→30→90 refetchea · **sin aviso «En construcción»** · USER sigue redirigido · cliente intocado
- [x] **BD sin restos** (R9.2): GET puro — nada escrito, sembrados intactos, sin usuarios propios
- [x] `/spec-check admin-dashboard` → aprobado
- [x] **Preguntar al usuario antes de cualquier commit y PR** ⛔ (autorizado 2026-10-20)

---

## Notas de implementación

*(se rellenan con los hallazgos del camino)*
