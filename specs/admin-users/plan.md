# Plan — Tarea 7.5: Gestión de usuarios (ver, suspender, cambiar rol)

> **Fase 7 · Panel de administración** · decisiones de diseño (D1–D10).
> Requisitos en `spec.md` · checklist en `tasks.md`.
> **Estado**: ✅ APROBADA · **Fecha**: 2026-10-15 · **Aprobación**: 2026-10-16

---

## 1. Objetivo

Añadir al panel la gestión de **usuarios**: listado global con búsqueda,
**suspensión/restauración** de cuentas y **cambio de rol** (`USER` ⇄ `ADMIN`),
con la misma fórmula que las 7.2–7.4: endpoints bajo `/api/v1/admin/**` que
heredan `hasRole("ADMIN")` sin tocar `SecurityConfig`, DTOs `record`,
excepciones de dominio con código HTTP semántico, y vitrina/cliente intactos.

La suspensión no es decorativa: **corta el login y el refresh** de la cuenta
suspendida (plan D3). Es la pieza que hace vendible el panel — sin ella un
operador no puede bloquear una cuenta abusiva.

---

## 2. Estado real — auditoría previa del repositorio (2026-10-15)

### 2.1 El usuario existe, pero no existe **ningún gesto administrativo** sobre él

- `User.java` (revisado línea a línea): `id`, `email`, `passwordHash`,
  `firstName`, `lastName`, `phone`, `birthDate`, `gender`, `height`, `weight`,
  `emailVerified`, `verificationCode`, `role`, `addresses`, `orders`,
  `createdAt`, `updatedAt`. **No hay ningún campo de estado/suspensión** —
  hará falta una migración (D2).
- `role` llegó en la **V13** (`DEFAULT 'USER'`, semilla `admin@nexus.dev` con
  `ON CONFLICT DO NOTHING`): **hoy hay exactamente un ADMIN** en la BD, así que
  la guarda de «último admin» del D4 es real, no teórica.
- `UserController` expone **sólo `/api/v1/users/me/**`** (zona cliente):
  perfil, direcciones y recomendación de talla. **Ningún controller admin de
  usuarios.** `UserRepository` sólo tiene `findByEmail`.
- Frontend: `SECCIONES` = Panel · Productos · Stock · Pedidos — **sin
  «Usuarios»**; no hay ruta `/admin/users`.

### 2.2 Login y refresh leen la BD, pero sólo para credenciales

- `AuthService.login`: buscar usuario → comparar contraseña →
  `emailVerified` → `buildAuthResponse`. No hay ningún otro estado de cuenta.
- `AuthService.refreshToken`: extrae el email del refresh token, **recarga el
  usuario de BD** y reconstruye tokens (con el rol vigente desde la 7.1).
  Ese recarga es el **segundo punto de control** de la suspensión.
- ⚠️ **Observación pre-existente (fuera de alcance)**: `IllegalStateException`
  **no tiene handler** en `GlobalExceptionHandler` (los 9 handlers existentes
  no lo cubren) y no hay `server.error.include-message`, así que
  `"Email no verificado"` cae en el **500 genérico** y la regla de
  `errors.ts` que busca ese texto **no llega a activarse** por esa vía. **No
  se arregla aquí** (alcance de otra tarea), pero la suspensión **no
  reutilizará esa vía**: irá con excepción de dominio propia + handler (D3).

### 2.3 Seguridad ya instalada (7.1, ADR-0006)

- `hasRole("ADMIN")` sobre `/api/v1/admin/**` + `anyRequest().denyAll()`.
  Los 3 endpoints nuevos caen **dentro de ese prefijo** → heredan la regla con
  **cero cambios en `SecurityConfig`** (idéntico a 7.2/7.3/7.4).

### 2.4 Infraestructura reutilizable (ya está hecha)

- **Listado paginado con `q`** (7.4 D2): `q` recortado en servidor,
  `CAST(:q AS string)` obligatorio en el JPQL, `countQuery` a mano, wrapper
  `…PageResponse(content, page, size, totalElements, totalPages)`.
- **`409` + `message`** con handler propio (7.2/7.4) — la guarda de último
  admin reutiliza exactamente ese mecanismo.
- **UX de panel** (7.4): `window.confirm` para acciones destructivas, toast +
  fila/panel actualizado **con la respuesta del `PUT`, sin re-fetch**, mensaje
  de `409` bajo la fila **sin toast de éxito**.
- `api.ts` (`handleResponse` tolera 204/vacío), `errors.ts` (reglas por
  **texto del mensaje antes** de las ramas por código HTTP), `AdminRoute` en
  `app/admin/layout.tsx`.

---

## 3. Decisiones de diseño

### D1 — Todo bajo `/api/v1/admin/users/**` y hereda la regla 7.1

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `GET /api/v1/admin/users` | `200` `AdminUserPageResponse` | params: `page` (def. `0`), `size` (def. `20`), `q?` |
| `PUT /api/v1/admin/users/{id}/role` | `200` `AdminUserResponse` | `{ "role": "USER" \| "ADMIN" }` |
| `PUT /api/v1/admin/users/{id}/suspension` | `200` `AdminUserResponse` | `{ "suspended": true \| false }` |

- Mismo esquema que la 7.4: **el `PUT` devuelve el usuario actualizado** para
  que la UI haga toast + actualizar la fila **sin re-fetch**.
- `q` vacío o en blanco = sin filtro (el frontend no distingue «no mandó `q`»
  de «mandó `q` vacío»), idéntico a `AdminOrderService.listar`.

### D2 — Migración `V15`: columna `suspended_at TIMESTAMPTZ NULL`

- **`NULL` = cuenta activa**; con valor = instante en que se suspendió, así la
  tabla puede mostrar «Suspendido desde…» sin columna extra.
- Reejecutable (`IF NOT EXISTS`), patrón V13/V14.
- **Sin índices**: la tabla `users` tiene cardinalidad mínima y el listado
  pagina por `createdAt` — los índices de la V14 iban a `orders`, que crece
  con cada venta. Añadirlos aquí sería especulativo.
- **Un `boolean` no sirve**: perderíamos *cuándo* se suspendió y no distingue
  «recién suspendido» de «lleva años»; el coste es el mismo (`null` vs `now`).

### D3 — La suspensión corta **login y refresh**; el token vigente, hasta expirar

- **`login`**: el chequeo entra **después de validar la contraseña** — un
  tercero que no sabe la contraseña **no debe poder averiguar** que la cuenta
  está suspendida (anti enumeración). Orden completo:
  `usuario → contraseña → suspendido → emailVerified`. Así una cuenta
  suspendida **no** recibe el mensaje «verifica tu email» (no tiene sentido
  verificar una cuenta bloqueada).
- **`refreshToken`**: recarga el usuario y, si está suspendido, **no emite
  tokens nuevos** (403). Cubierto en los dos puntos donde la BD manda.
- **Excepción de dominio propia `UserSuspendedException` → `403`** con handler
  en `GlobalExceptionHandler`, mensaje *«La cuenta está suspendida. Contacta
  con soporte.»* — patrón §5.5. **No** reutilizar `IllegalStateException`
  (ver 2.2: eso hoy cae a 500).
- **Limitación documentada (no es un hueco, es la arquitectura)**: el access
  token es stateless y dura 24 h (ADR-0006) — un usuario suspendido con token
  vigente **puede seguir operando hasta que expire o hasta que intente
  refrescar**. Lo mismo vale para un rol recién degradado (el refresh toma el
  rol de BD desde la 7.1, así que la degradación es efectiva en el siguiente
  refresh). **Revocación inmediata exigiría blacklist/stateful → ADR aparte**:
  fuera de alcance, escrito en la spec y en «Fuera de alcance».

### D4 — Guardas de bloqueo: **último admin activo** y **auto-suspensión**

- **Último `ADMIN` activo** (`role = ADMIN AND suspended_at IS NULL`,
  contado = `1`) **no se puede suspender ni degradar** → `409 USER_CONFLICT`
  con `message` del servidor (mismo mecanismo que `CATALOG_CONFLICT`/
  `ORDER_CONFLICT`). Un panel **sin ningún admin activo** se quedaría fuera de
  su propia puerta — la restauración tendría que ser por SQL.
- **Auto-suspensión prohibida** → `409 USER_CONFLICT` (*«No puedes
  suspenderte a ti mismo»*). El auto-despido rompería la sesión del operador
  a mitad de la acción.
- **Auto-degradación permitida** si queda ≥ 1 admin activo distinto (es una
  decisión legítima del operador, precedente: nadie impide cerrar la puerta
  con llave si queda otra persona fuera).
- El conteo es **una query por acción** (`countByRoleAndSuspendedAtIsNull`) —
  no hay riesgo N+1 (escribir = 1 fila).
- Los **intentos fallidos no cambian estado**: probar la guarda contra
  `admin@nexus.dev` (hoy el único admin) devuelve `409` y la BD queda intacta.

### D5 — DTOs: un único `AdminUserResponse` para lista y acciones

```java
public record AdminUserResponse(
        Long id, String email, String firstName, String lastName,
        Role role,
        boolean suspended,      // derivado en servidor: suspendedAt != null
        Instant suspendedAt,    // null = activo; fecha de la suspensión
        Instant createdAt) {}

public record AdminUserPageResponse(
        List<AdminUserResponse> users,
        int page, int size, long totalElements, int totalPages) {}
```

- **La lista y los `PUT` comparten forma** (a diferencia de la 7.4, donde el
  detalle componía otra cosa): un solo record, cero ambigüedad cliente/servidor.
- `suspended` (booleano) lo calcula **el servidor** — evita duplicar la lógica
  `suspendedAt != null` en cada consumidor; `suspendedAt` viaja igual para
  pintar la fecha.
- **Búsqueda**: `q` recortado en servidor, matchea `LOWER(email)`,
  `LOWER(first_name)` o `LOWER(last_name)` con `LIKE %q%`; **`CAST(:q AS
  string)` obligatorio** (misma trampa `function lower(bytea)` que obligó a
  corregirlo en 7.4). Orden `createdAt DESC, id DESC`.
- **N+1 imposible**: el mapper sólo toca escalaros — jamás se abren
  `addresses`/`orders` (cargarlos sería el N+1; no hacen falta: el nº de
  pedidos lo busca el admin por email en `/admin/orders`).

### D6 — Sin página de detalle de usuario

- **«Ver» = la lista con acciones inline.** Email, nombre, rol, estado y alta
  son todo lo que el operador necesita para decidir; una `/admin/users/[id]`
  sólo añadiría una pantalla con los mismos botones (precedente 7.3: *sin
  pantalla que no ganara nada*).
- **Nº de pedidos / direcciones fuera de alcance**: el listado de pedidos ya
  busca por email (`q` de la 7.4) y un contador por fila costaría una query
  extra por página para un dato que ya existe en su sitio.

### D7 — Frontend `/admin/users` + secciones + portada

- **Tabla**: Email · Nombre · Rol · Estado («Activo» / «Suspendido desde
  dd/mm/aaaa») · Alta · Acciones.
- **Búsqueda en servidor** con el mismo patrón que `/admin/orders` — nunca
  `filter()` en cliente (decisión R8b/3.1 reafirmada).
- **Acciones por fila** (4 botones condicionales, sin selects ni modales):
  - *«Suspender»* → `window.confirm` (destructiva) · *«Restaurar»* sin
    confirmación (sólo devuelve acceso).
  - *«Hacer administrador»* sin confirmación · *«Quitar administrador»* →
    `window.confirm` (pierde poderes).
- **Éxito**: toast + **fila actualizada con la respuesta del `PUT`**, sin
  re-fetch (patrón 7.4).
- **`409 USER_CONFLICT`**: mensaje bajo la fila, **sin toast de éxito**, fila
  sin tocar (patrón celda de 7.3 / estado de 7.4).
- **`SECCIONES` gana «Usuarios»** (`/admin/users`, con `aria-current`); la
  portada gana la **tarjeta «Usuarios»** y el aviso pasa a ser **sólo «7.6
  Dashboard»** — es la penúltima tarea (declaración de test, R8, cuarta vez
  seguida 7.3→7.6).
- **`api.ts`**: `getAdminUsers`, `updateAdminUserRole`,
  `setAdminUserSuspension` (+ tests; umbral del fichero ≥ 99).
- **`errors.ts`**: regla por texto *«suspendida»* **antes** de la rama 403
  genérica (que si no diría «No tienes permiso…», inapropiado en login); el
  `409` con `code: USER_CONFLICT` hereda la rama 409 existente (muestra el
  `message` del servidor).

### D8 — Cliente y vitrina **intocados**

- `/api/v1/users/me/**`, registro, verificación y reset de contraseña **sin
  cambios** — verificado por diff al cerrar.
- **La suspensión no borra ni desactiva datos**: es *no-login*, nunca
  pérdida. Pedidos, direcciones e histórico quedan intactos (los pedidos son
  inmutables por diseño).

### D9 — Sin ADR, sin E2E/a11y nuevos, sin PR de documentación de cierre

- **Sin ADR**: mismas capas (`Controller → Service → Repository`), mismos
  DTOs `record`, mismas migraciones Flyway, mismo stack — no hay cambio de
  arquitectura (precedente 7.2/7.3/7.4).
- **Sin E2E ni axe nuevos**: las rutas `/admin/**` no están en las 14 de axe
  ni en el smoke, y así se cerraron 7.2–7.4 — la cobertura son los tests de
  componente.
- Bloque **«ESTADO ACTUAL» de `AGENTS.md` y `MEMORY.md` refrescados dentro de
  la feature PR** (convención D11): verdad después del merge, sin números de
  PR ni SHA → **no existe PR de documentación de cierre**.

### D10 — Datos de prueba propios; **nunca** tocar los sembrados

- Usuario de prueba `test-7501@nexus.dev` (sin pedidos → sin FK que cuelgue):
  **creado en `@Before` y borrado en `@After`** — la suite queda
  determinista sin importar el orden de ejecución.
- **Prohibido modificar**: `admin@nexus.dev` (es el último admin activo; la
  guarda D4 lo protege y los intentos fallidos no cambian nada) y
  `e2e@nexus.dev` (rompería el E2E y el globalSetup).
- **Verificación en navegador**: el usuario de prueba se registra **vía API**
  con el código de verificación **leído de BD** (patrón del globalSetup E2E),
  se suspende, se intenta login → `403` amigable; al final, **BD sin restos**
  (borrado explícito, como en la 7.4).

---

## 4. Fuera de alcance

1. **Borrar o editar datos de usuario** — `orders.user_id` apunta a `users`
   (V7): borrar rompería FKs y el histórico es inmutable por diseño.
2. **Revocación inmediata de tokens vigentes** — exige blacklist/stateful =
   ADR nuevo (D3 lo deja escrito como limitación).
3. **Backoffice de devoluciones** — la 7.4 lo dejó fuera y sólo expone el
   flag `returnRequested`.
4. **Dashboard** — Tarea 7.6 (la siguiente).
5. **Acciones admin sobre credenciales**: resetear contraseña o reenviar
   verificación por el panel.
6. **Filtros por rol/estado** — sólo `q`; añadibles después sin romper nada.
7. **Arreglar el `500` de «Email no verificado»** (§2.2, pre-existente) —
   otra tarea, no se mezcla el alcance.

---

## 5. Estimación y orden de implementación

| # | Bloque | Contenido |
|:-:|:---|:---|
| 1 | **Backend: datos** | `V15__user_suspension.sql` · `AdminUserResponse` / `AdminUserPageResponse` · `UserRepository` (query de lista + count de admins) |
| 2 | **Backend: dominio** | `UserSuspendedException` + handler (`403`) · `UserConflictException` → reutilizar/mezclar el 409 (o handler nuevo `USER_CONFLICT`) · `AdminUserService` (listar, rol, suspensión con guardas D4) · `AdminUserController` |
| 3 | **Backend: auth** | chequeos en `AuthService.login` y `refreshToken` (orden D3) |
| 4 | **Backend: tests** | servicio + controller (`@SpringBootTest` + MockMvc + BD real, patrón `AdminOrderControllerTest`) + `AuthServiceTest` |
| 5 | **Frontend** | tipos · `api.ts` (3 funcs) · `errors.ts` · `/admin/users/page.tsx` · `SECCIONES` + portada · tests |
| 6 | **Verificación** | gate `npm run test:coverage` · tsc · ESLint · build · **navegador** (D10) · **BD sin restos** |
| 7 | **Cierre** | `tasks.md` íntegro · `CHANGELOG` · bloque de estado en `AGENTS.md`/`MEMORY.md` · `/spec-check admin-users` |

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| Quedar **sin admin activo** (puerta cerrada) | Guarda D4 (`409`) + test que la ejercita contra el sembrado sin modificarlo |
| **Auto-suspensión** del operador a mitad de acción | Guarda D4 (`409`) + test |
| Datos de prueba **ensuciando la BD compartida** | D10: `@Before`/`@After` + borrado al final de la verificación de navegador |
| **R8**: test preexistente en rojo por el aviso/portada | Declarados en spec R8: `AdminPage.test` (aviso → 7.6) y `AdminLayout.test` (aditiva «Usuarios») |
| Token vigente **sigue vivo** tras suspender | D3: limitación documentada en spec y en fuera de alcance — no se oculta |
| Trampa `CAST(:q)` (vista en 7.4) | Espejado literal del JPQL de `OrderRepository.findAllForAdmin` |
