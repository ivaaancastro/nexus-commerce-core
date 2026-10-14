# Spec — Tarea 7.1: Roles y permisos (`ADMIN`/`USER`)

> **Fase 7 · Panel de administración** · requisitos (R1–R8) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D9) · checklist en `tasks.md`.

---

## Resumen

Se introduce **autorización basada en roles** en todo el sistema:

- Columna `role` en `users` (`USER`/`ADMIN`), con **usuario admin sembrado**
  por migración.
- El rol viaja en el **claim `role` del JWT** (access y refresh) y el filtro lo
  convierte en autorías de Spring Security.
- **`/api/v1/admin/**` exige `hasRole("ADMIN")`** → `403` para el resto.
- Frontend: tipo `User.role`, componente **`AdminRoute`**, ruta **`/admin`**
  semilla y enlace en el `Header` **visible sólo para `ADMIN`**.
- **ADR-0006** documenta el cambio de modelo de autorización.

---

## R1 — Migración `V13` y modelo de rol

**Criterio**: el rol es un dato persistido, con valor por defecto y semilla
idempotente.

- Migración nueva `V13__user_roles.sql`:
  - `ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER'`.
  - El `DEFAULT 'USER'` clasifica **todos los usuarios existentes** sin `UPDATE`.
  - **Usuario admin sembrado** con `INSERT … ON CONFLICT DO NOTHING`
    (email y contraseña por defecto documentados; patrón idempotente de V11/V12).
- Enum `Role` en `entity/` (`USER`, `ADMIN`), `@Enumerated(EnumType.STRING)`.
- Campo `role` en la entidad `User` (`nullable = false`, `length = 20`),
  replicando el patrón exacto de `Gender`.

### Criterios de aceptación

- [ ] Existe `V13__user_roles.sql` con el `ALTER` y la semilla `ON CONFLICT DO NOTHING`
- [ ] Ejecutar la migración dos veces seguidas no duplica ni falla
- [ ] Los usuarios existentes quedan con `role = 'USER'` sin `UPDATE` manual
- [ ] El enum `Role` está anotado `@Enumerated(EnumType.STRING)` como `Gender`
- [ ] `./mvnw test` sigue en verde con la migración aplicada (Flyway real)

---

## R2 — El JWT lleva el claim `role`

**Criterio**: la autorización se resuelve **en el token**, sin consultar la BD
por petición.

- `JwtService.generateToken(...)` y `generateRefreshToken(...)` incluyen el
  claim **`role`**.
- **Tokens antiguos sin el claim asumen `USER`** (mínimo privilegio, D2):
  nunca `ADMIN`.
- `AuthResponse` / `UserResponse` ganan el campo `role`, así el frontend lo
  recibe en login, refresh y `GET /users/me`.

### Criterios de aceptación

- [ ] El access token de un admin contiene `role: "ADMIN"`
- [ ] El refresh token también contiene el claim
- [ ] Un token **sin** el claim produce autoridades de `USER`, jamás `ADMIN`
- [ ] `UserResponse` incluye `role` y `GET /api/v1/users/me` lo devuelve
- [ ] `AuthResponse` de login y de refresh incluyen `user.role`

---

## R3 — El filtro convierte el rol en autorías

**Criterio**: el `SecurityContext` refleja el rol; sin esto, **todo** `hasRole`
deniega también al admin.

- `JwtAuthenticationFilter` construye el `UsernamePasswordAuthenticationToken`
  con las autorías correspondientes: `ROLE_USER` siempre, `ROLE_ADMIN` además
  si el claim lo dice.
- Un token malformado o expirado sigue descartándose sin 500 (comportamiento
  preexistente intacto).

### Criterios de aceptación

- [ ] Con token de admin, `SecurityContext` contiene `ROLE_ADMIN`
- [ ] Con token de usuario normal, contiene `ROLE_USER` y **no** `ROLE_ADMIN`
- [ ] Con token sin claim `role`, contiene `ROLE_USER`
- [ ] Token malformado → sigue sin autenticar y el entry point responde 401
      (regresión de la 5.3 intacta)

---

## R4 — `/api/v1/admin/**` exige `ADMIN`

**Criterio**: el enforcement vive en `SecurityConfig`, con orden correcto.

- `requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` colocada **antes** de
  `anyRequest().denyAll()` (la primera coincidencia gana; el final de la cadena
  es `denyAll()` desde la 6.4 — **sin la regla, la ruta quedaría denegada
  también para el `ADMIN`**).
- `GET /api/v1/admin/ping` (D5): devuelve `email` y `role` del llamante —
  endpoint real contra el que verificar el 403/200 end-to-end.

### Criterios de aceptación

- [ ] `GET /api/v1/admin/ping` **sin token** → `401`
- [ ] `GET /api/v1/admin/ping` **con token `USER`** → `403`
- [ ] `GET /api/v1/admin/ping` **con token `ADMIN`** → `200` con su email y rol
- [ ] El resto de endpoints públicos/autenticados **no cambian** de comportamiento
- [ ] Test MockMvc que cubre los tres caminos (401/403/200)

---

## R5 — Frontend: `User.role`, `AdminRoute` y ruta `/admin`

**Criterio**: el panel existe como puerta, aunque su contenido llegue en 7.2–7.6.

- `types/auth.ts`: `User` gana `role: "USER" | "ADMIN"`.
- Componente **`AdminRoute`** (patrón de `ProtectedRoute`):
  - cargando → estado de carga accesible (`role="status"`, mismo patrón);
  - sin sesión → `router.replace("/login")`;
  - sesión pero `role !== "ADMIN"` → `router.replace("/")`.
- Ruta **`/admin/page.tsx`** envuelta en `AdminRoute`: saludo con el email y
  aviso honesto de que el panel llega en las tareas siguientes (**D6**: sin
  maqueta de dashboard).

### Criterios de aceptación

- [ ] `User` en `types/auth.ts` tiene `role` tipado como unión literal
- [ ] `/admin` sin sesión redirige a `/login`
- [ ] `/admin` con sesión `USER` redirige a `/`
- [ ] `/admin` con sesión `ADMIN` renderiza la página semilla
- [ ] El estado de carga de `AdminRoute` es accesible (mismo patrón que `ProtectedRoute`)

---

## R6 — Header: enlace al panel sólo para `ADMIN`

**Criterio**: un usuario normal **no ve** el acceso al panel.

- `Header` muestra el enlace «Admin» **sólo** cuando `user.role === "ADMIN"`.
- Sigue la convención editorial (`text-xs uppercase tracking-widest`, como el
  resto de enlaces del header).

### Criterios de aceptación

- [ ] Con sesión `ADMIN` el enlace está visible y navega a `/admin`
- [ ] Con sesión `USER` el enlace **no se renderiza**
- [ ] Sin sesión el enlace no se renderiza
- [ ] `Header.test.tsx` cubre los tres casos

---

## R7 — Tests

**Criterio**: la seguridad se prueba, no se confía.

- **Backend** (+): `JwtService` con claim, `JwtAuthenticationFilter` con
  autorías, `AdminController` 401/403/200, semilla de `V13`.
- **Frontend** (+): `AdminRoute` (3 caminos), `Header` (3 caminos),
  `/admin` semilla.
- Ningún test preexistente cambia su aserción (herencia de la 4.1, R8).

### Criterios de aceptación

- [ ] `./mvnw test` → todos en verde (191 + los nuevos)
- [ ] `npm run test:coverage` → todos en verde (297 + los nuevos), umbrales congelados en EXIT 0
- [ ] `npx tsc --noEmit` → 0 · ESLint → 0 errores / 0 warnings
- [ ] `npm run build` → 0 errores
- [ ] Ningún test preexistente modifica sus aserciones

---

## R8 — Documentación y estado

**Criterio**: la decisión queda escrita donde la buscará quien llegue después.

- **`docs/adr/0006-role-based-access-control.md`** (D7): Contexto → Decisión →
  Alternativas (tabla `roles`, permisos granulares, claim sólo en access) →
  Consecuencias. Registrado en `docs/adr/README.md`.
- `CHANGELOG.md` actualizado (Keep a Changelog es-ES).
- Bloque «ESTADO ACTUAL» de `AGENTS.md` redactado **dentro de la feature PR**,
  verdad después del merge, **sin números de PR ni SHA** (D8, hereda D11 de la 3.3).
- **Sin PR de documentación de cierre.**

### Criterios de aceptación

- [ ] Existe `docs/adr/0006-role-based-access-control.md` con las 4 secciones
- [ ] `docs/adr/README.md` lo registra
- [ ] `CHANGELOG.md` incluye la entrada
- [ ] El bloque de estado de `AGENTS.md` queda actualizado en la PR de la feature
- [ ] No se crea ningún PR de documentación de cierre

---

## Fuera de alcance

- CRUD de productos/stock/precios/pedidos (7.2–7.4) · gestión de usuarios y
  **cambio de rol en caliente** (7.5, D9) · dashboard (7.6) · cambio de
  contraseña, 2FA, rotación de refresh · audit log · permisos granulares (D1).
