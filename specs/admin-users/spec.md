# Spec — Tarea 7.5: Gestión de usuarios (ver, suspender, cambiar rol)

> **Fase 7 · Panel de administración** · requisitos (R1–R9) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D10) · checklist en `tasks.md`.
> **Estado**: ✅ APROBADA · **Fecha**: 2026-10-15 · **Aprobación**: 2026-10-16

---

## Resumen

El panel gana la gestión de **usuarios**: listado global con búsqueda,
**suspensión/restauración de cuentas** y **cambio de rol** `USER` ⇄ `ADMIN`.

- **3 endpoints** bajo `/api/v1/admin/users/**` — heredan `hasRole("ADMIN")`
  **sin tocar `SecurityConfig`** (plan D1).
- **Migración única `V15`**: `suspended_at TIMESTAMPTZ NULL` — `NULL` = activo,
  con valor = instante de la suspensión (plan D2).
- **La suspensión corta login y refresh** (chequeo tras validar la contraseña,
  anti enumeración) con `UserSuspendedException → 403`; el access token vigente
  dura hasta expirar — **limitación documentada** de lo stateless (plan D3).
- **Guardas `409 USER_CONFLICT`**: no suspenders/degradas al **último admin
  activo**, ni te suspendes a ti mismo (plan D4).
- Frontend **`/admin/users`** (tabla + acciones + confirm), **`SECCIONES`
  gana «Usuarios»** y la portada avisa ya **sólo de la 7.6** (plan D7).
- **Cliente y vitrina intocados** · **sin ADR, sin E2E/a11y nuevos**
  (plan D8/D9).

---

## R1 — API de listado bajo `/api/v1/admin/users`

**Criterio**: el ADMIN lista **todos** los usuarios del sistema con búsqueda
y paginación; nadie más puede.

| Método y ruta | Éxito | Parámetros |
|:--|:--|:--|
| `GET /api/v1/admin/users` | `200` `AdminUserPageResponse` | `page` (def. `0`), `size` (def. `20`), `q?` |

```jsonc
// 200
{
  "users": [
    {
      "id": 1,
      "email": "admin@nexus.dev",
      "firstName": "Admin",
      "lastName": "Nexus",
      "role": "ADMIN",
      "suspended": false,
      "suspendedAt": null,
      "createdAt": "2026-10-01T09:00:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

- **Búsqueda `q`**: se **recorta en servidor**; vacío o ausente = sin filtro.
  Matchea `email`, `firstName` o `lastName` con `LIKE %q%` en `LOWER`
  (`CAST(:q AS string)` obligatorio en el JPQL — lección 7.4, plan D5).
- **Orden**: `createdAt DESC, id DESC`.
- **Sin resultados → `200` y `users: []`** — nunca `404` (la página existe;
  sólo está vacía).
- **Sin N+1**: el mapper sólo lee escalaros; `addresses`/`orders` jamás se
  abren (plan D5).
- Cuerpo paginado con `users, page, size, totalElements, totalPages` (mismo
  shape que `AdminOrderPageResponse`, campo renombrado).

---

## R2 — Cambio de rol

**Criterio**: el ADMIN promueve o degrada usuarios; las guardas impiden el
bloqueo del panel.

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `PUT /api/v1/admin/users/{id}/role` | `200` `AdminUserResponse` actualizado | `{ "role": "USER" }` o `{ "role": "ADMIN" }` |

| Fallo | Código | Detalle |
|:--|:--|:--|
| Rol desconocido o campo ausente | `400` | validación `@NotNull`/enum + `message` |
| Usuario inexistente | `404` | `ResourceNotFoundException` |
| Degradar al **último admin activo** | `409` | `code: USER_CONFLICT` + `message` (plan D4) |

- La respuesta **es el usuario actualizado** → la UI hace toast y actualiza la
  fila **sin re-fetch** (patrón 7.4).
- **Auto-degradación permitida** si queda ≥ 1 admin activo distinto (plan D4).
- Un rol degradado **surte efecto en el siguiente refresh** (el rol se toma de
  BD desde la 7.1); hasta entonces el access token vigente conserva su claim —
  limitación documentada en R4.

---

## R3 — Suspensión y restauración

**Criterio**: el ADMIN bloquea o devuelve acceso a una cuenta, con registro de
cuándo.

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `PUT /api/v1/admin/users/{id}/suspension` | `200` `AdminUserResponse` actualizado | `{ "suspended": true }` o `{ "suspended": false }` |

- **Suspender** → `suspendedAt = now` (instante del servidor), `suspended: true`.
- **Restaurar** → `suspendedAt = null`, `suspended: false`. El **rol no cambia**.
- **Idempotente**: suspender una cuenta ya suspendida devuelve `200` y
  **conserva el instante original** (no se pisla la fecha); restaurar una
  activa, igual.

| Fallo | Código | Detalle |
|:--|:--|:--|
| Campo `suspended` ausente | `400` | validación + `message` |
| Usuario inexistente | `404` | `ResourceNotFoundException` |
| **Auto-suspensión** (id = token propio) | `409` | `code: USER_CONFLICT`, *«No puedes suspenderte a ti mismo»* |
| Suspender al **último admin activo** | `409` | `code: USER_CONFLICT` + `message` |

- Las guardas son **previas a la escritura**: en `409` la BD **no cambia**.
- Suspender **no borra ni toca datos** (pedidos, direcciones, histórico
  intactos — plan D8).

---

## R4 — Efecto en autenticación: login y refresh bloqueados

**Criterio**: una cuenta suspendida **no puede iniciar sesión ni refrescar su
sesión**; ningún tercero deduce la suspensión sin la contraseña.

- **`POST /api/v1/auth/login`** con cuenta suspendida y **contraseña correcta**
  → **`403`** con `UserSuspendedException`, `message`: *«La cuenta está
  suspendida. Contacta con soporte.»*
- **Orden del chequeo**: `usuario → contraseña → suspendido → emailVerified`.
  - Contraseña **incorrecta** → respuesta de credenciales habitual (**sin**
    revelar la suspensión, anti enumeración).
  - Suspendida **y sin verificar** → `403` de suspensión (no el mensaje de
    verificación: verificar no desbloquea).
- **`POST /api/v1/auth/refresh`** con refresh token de cuenta suspendida →
  **`403`** con el mismo `message`; **no se emiten tokens nuevos**.
- **Excepción de dominio propia** con handler en `GlobalExceptionHandler`
  (patrón §5.5) — **no** se reutiliza `IllegalStateException` (cae a 500, ver
  plan §2.2).
- **Limitación documentada**: el access token stateless dura 24 h (ADR-0006)
  — un token ya emitido sigue siendo válido hasta expirar o hasta que su
  portador intente refrescar. Lo mismo para un rol degradado (claim viejo
  hasta el refresh). **Revocación inmediata = blacklist stateful → ADR, fuera
  de alcance** (plan D3/§4).
- Registro, verificación y reset de contraseña **sin cambios**.

---

## R5 — Seguridad heredada, sin reglas nuevas

- `GET`/`PUT` **sin token** → `401`.
- Token de usuario `USER` → `403`.
- Token `ADMIN` → `200`/`409` según corresponda.
- **`SecurityConfig` con diff = 0 líneas**: los endpoints caen en el prefijo
  `/api/v1/admin/**` ya cubierto por la 7.1 (`hasRole("ADMIN")` antes de
  `denyAll()`), igual que 7.2–7.4.
- `GET /inventory/**` y `GET /pricing/**` siguen siendo públicos a propósito
  (6.4(i)) — no se toca nada de la 6.4.

---

## R6 — Frontend: `/admin/users`

**Criterio**: el operador busca, suspende y cambia rol sin salir de la tabla,
con confirmación en lo destructivo y `409` visible.

- **Tabla** (estilo editorial Zara, cabecera `uppercase tracking-widest`):
  **Email · Nombre · Rol · Estado · Alta · Acciones**.
  - *Estado*: «Activo» o «Suspendido desde dd/mm/aaaa» (`suspendedAt` formateado; sin fecha → «—»).
- **Búsqueda en servidor** (mismo patrón que `/admin/orders`): el `q` viaja a
  la API — **nunca `filter()` en cliente**.
- **Acciones por fila** (condicionales al rol/estado, sin selects ni modales):
  - *«Suspender»* → **`window.confirm`** · *«Restaurar»* sin confirmación.
  - *«Hacer administrador»* sin confirmación · *«Quitar administrador»* →
    **`window.confirm`**.
- **Éxito**: **toast** (fondo `neutral-900`, `text-xs uppercase`) + **fila
  actualizada con la respuesta del `PUT`, sin re-fetch**.
- **`409 USER_CONFLICT`**: mensaje del servidor **bajo la fila**, **sin toast
  de éxito**, fila sin modificar (patrón 7.3/7.4).
- **Estados**: cargando, vacío («Sin resultados»), error de red traducido con
  `getFriendlyErrorMessage()`.
- **Inputs con `text-neutral-900`** (regla 7).
- **`api.ts`**: `getAdminUsers`, `updateAdminUserRole`,
  `setAdminUserSuspension` — manejando 204/vacío según la regla crítica 8
  (aquí siempre hay body, el `handleResponse` existente basta).
- **`errors.ts`**: regla por texto *«suspendida»* **antes** de la rama 403
  genérica (evita «No tienes permiso…» en el login); `USER_CONFLICT` →
  mensaje del servidor vía la rama 409 existente.

---

## R7 — Chrome del panel: secciones y portada

- **`SECCIONES`** de `app/admin/layout.tsx` gana `{ href: "/admin/users",
  label: "Usuarios" }` con `aria-current` en la ruta activa.
- **Portada `/admin`**: nueva **tarjeta «Usuarios»** y el aviso de roadmap
  queda **sólo «7.6 Dashboard»** (la 7.5 es la penúltima).
- `AdminRoute` **no cambia** — sigue protegiendo `/admin/**` en el layout.

---

## R8 — Tests

### R8.1 — Backend (base **287**)

- **Listado** (servicio + controller `@SpringBootTest`/MockMvc con BD real):
  200 ADMIN, búsqueda por email/nombre, `q` con espacios recortado, vacío/ausente
  = sin filtro, orden `createdAt DESC`, paginación, sin resultados → 200 lista
  vacía.
- **Rol**: `200` promover/degradar con respuesta actualizada · `404` id
  inexistente · `400` rol desconocido · `409` degradar al único admin activo
  (intento fallido: la BD **queda intacta**, se re-asserta) · auto-degradación
  permitida con otro admin activo.
- **Suspensión**: `200` suspende (`suspendedAt` poblado) y restaura
  (`null` conservando rol) · idempotencia conservando el instante · `404` ·
  `409` auto-suspensión · `409` último admin.
- **Auth** (`AuthServiceTest`): login suspendido con contraseña correcta →
  `UserSuspendedException` · precedencia suspendido > no verificado · refresh
  suspendido → excepción y sin tokens · login/refresh no suspendidos intactos.
- **Seguridad**: `401` sin token · `403` con token `USER` · `200` con `ADMIN`.
- **Datos (D10)**: usuario propio `test-7501@nexus.dev` creado en `@Before` y
  borrado en `@After`; **nunca se modifica** `admin@nexus.dev` ni
  `e2e@nexus.dev`.

### R8.2 — Frontend (base **424** — la 389 de la redacción original + 35 de `product-photos`, mergeada antes de arrancar)

- **`AdminUsersPage`**: tabla y cabeceras · búsqueda que consulta la API ·
  suspender con confirm → llamada + toast + fila actualizada · restaurar ·
  cambiar rol con confirm al quitar · `409` muestra mensaje bajo la fila sin
  toast · estados vacío/cargando.
- **`api.ts`**: 3 funciones cubiertas (umbral fichero ≥ 99) ·
  **`errors.ts`**: regla de suspensión y rama `USER_CONFLICT`.

### R8.3 — Cambios declarados en tests preexistentes (R8, cuarta vez: 7.3→7.6)

| Test | Cambio |
|:--|:--|
| `AdminPage.test.tsx` | El aviso de roadmap pasa a **«7.6 Dashboard»** (ya no «7.5–7.6») |
| `AdminLayout.test.tsx` | **Aditiva**: la sección «Usuarios» |

**Ningún otro test preexistente cambia su aserción.** Gate final:
`npm run test:coverage` **EXIT 0**, `tsc` 0, ESLint **0/0**, `npm run build`.

---

## R9 — Verificación, datos y documentación de cierre

### R9.1 — Verificación en navegador (stack real)

1. **`/admin/users`**: ADMIN ve la tabla; busca `admin` → sólo el sembrado.
2. **Suspender con confirm** el usuario de prueba (registrado vía API con el
   código leído de BD, D10) → toast + fila «Suspendido desde …».
3. **Login de la cuenta suspendida** (misma pestaña, logout primero) →
   mensaje amigable de suspensión (403, no «permiso»).
4. **Restaurar** → fila «Activo» → login correcto.
5. **Rol**: promover el usuario de prueba con confirm al quitarlo → fila
   actualizada; intentar suspender/degradar `admin@nexus.dev` → **`409` bajo
   la fila, sin toast** (único admin activo) y la fila sigue intacta.
6. **`USER` redirigido** de `/admin/users` (AdminRoute).
7. **Cliente intocado**: perfil/`me` y pedidos del cliente siguen iguales.

### R9.2 — BD sin restos

- Usuario de prueba **borrado** · `admin@nexus.dev` sigue **activo y ADMIN** ·
  `e2e@nexus.dev` sin tocar · sin filas huérfanas.

### R9.3 — Documentación y cierre

- **`CHANGELOG.md`**: entrada «7.5 — Gestión de usuarios» en `[Unreleased]`
  (es-ES, Keep a Changelog).
- **Bloque «ESTADO ACTUAL»** de `AGENTS.md` y sección de `MEMORY.md`
  refrescados **dentro de la feature PR** (convención D11 — verdad tras el
  merge, sin PR/SHA).
- **`tasks.md`** con todas las tareas marcadas al completarse.
- **Sin ADR** y **sin PR de documentación de cierre** (plan D9).
- **`/spec-check admin-users`** en verde antes de cerrar.

### R9.4 — Única migración

- **`V15__user_suspension.sql`** (`suspended_at TIMESTAMPTZ NULL`,
  `IF NOT EXISTS`). Ningún V16, ningún cambio en V1–V14.
