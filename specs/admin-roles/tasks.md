# Tasks — Tarea 7.1: Roles y permisos (`ADMIN`/`USER`)

> **Fase 7 · Panel de administración** · spec `spec.md` (R1–R8) · plan `plan.md` (D1–D9).
> Un checkbox por unidad terminada; las decisiones y hallazgos quedan como nota
> debajo de su bloque. **Regla**: marcar al completar; nada de código fuera de
> este checklist.

---

## A — Migración y modelo (R1)

- [ ] **A.1** `V13__user_roles.sql`: `ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER'` — el `DEFAULT` clasifica todos los usuarios existentes sin `UPDATE`
- [ ] **A.2** Semilla idempotente del primer admin: `INSERT … ON CONFLICT (email) DO NOTHING`
- [ ] **A.3** Enum `Role` (`USER`, `ADMIN`) en `entity/` con `@Enumerated(EnumType.STRING)`
- [ ] **A.4** Campo `role` en la entidad `User` (`nullable = false`, `length = 20`), réplica exacta del patrón `Gender`
- [ ] **A.5** Verificación con Flyway real: los `@SpringBootTest` ejecutan V13; `./mvnw test` en verde

### Nota A.2 — la semilla debe poder **iniciar sesión**

El login exige `email_verified = TRUE` (columna de `V6`), así que el `INSERT`
tiene que llevarlo a `TRUE` — un admin sin verificar no podría autenticarse.
Además `password_hash` necesita un **hash BCrypt coste 12 precalculado**: no
existe ningún hash previo en las migraciones (los usuarios se crean por
registro). Email y contraseña por defecto quedan documentados en el README
(E.3). ⚠️ El `plan.md` D3 menciona `.env.example`: **no existe en el repo** y
crear uno parcial sería más confuso que útil (la semilla es un literal de la
migración, no una variable) — se documenta en README y se anota aquí como
decisión («Decide tú» en detalle menor).

---

## B — Backend: JWT, autorías y regla (R2, R3, R4)

- [ ] **B.1** `JwtService`: claim **`role`** en `generateToken(...)` **y** en `generateRefreshToken(...)`
- [ ] **B.2** Token **sin** el claim → asunción `USER` (mínimo privilegio, D2): nunca `ADMIN`, tanto en la firma como en la lectura
- [ ] **B.3** `JwtAuthenticationFilter` construye las autorías: `ROLE_USER` siempre, `ROLE_ADMIN` además si el claim lo dice; token malformado/expirado sigue descartándose sin 500 (regresión de la 5.3 intacta)
- [ ] **B.4** `AuthResponse` y `UserResponse` ganan el campo `role` (login, refresh y `GET /api/v1/users/me`)
- [ ] **B.5** `SecurityConfig`: `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` **antes de** `.anyRequest().denyAll()`
- [ ] **B.6** `AdminController` + `GET /api/v1/admin/ping` → `200` con `email` y `role` del llamante (D5)

### Nota B.5 — orden contra `denyAll` (interacción con la 6.4)

Desde la Fase 6 el final de la cadena es **`denyAll()`**: sin la regla
`hasRole`, `/api/v1/admin/**` quedaría denegado **también para el `ADMIN`** (no
es que «se escape», es que no entra nadie). El orden — regla **antes** de
`anyRequest` — es el requisito que verifica D.3 con los tres caminos.

### Nota B.1 — de dónde sale el rol en el **refresh**

El access token lo firma `AuthService` en el login (allí vive el `User` → rol
disponible). El **refresh** hay que mirarlo al implementar: si ese flujo no
recarga el usuario, propagar el claim `role` del refresh token original; si lo
recarga, tomarlo de la BD. Elegir lo que ya haga el flujo con menos cambios y
anotarlo aquí.

### Nota B (R8) — firmas que ganan parámetros

`generateToken`/`generateRefreshToken` y los records `AuthResponse` /
`UserResponse` cambian de aridad: actualizar **todas las llamadas existentes**
(incluido `SecurityRulesTest` de la 6.4, que mintea tokens) **sin tocar una
sola aserción** — regla R8 heredada de la 4.1.

---

## C — Frontend: puerta y visibilidad (R5, R6)

- [ ] **C.1** `types/auth.ts`: `User` gana `role: "USER" | "ADMIN"`; el `AuthContext` lo propaga desde login/refresh/`GET /users/me`
- [ ] **C.2** Componente `AdminRoute` (patrón de `ProtectedRoute`): cargando → estado accesible (`role="status"`) · sin sesión → `router.replace("/login")` · sesión con `role !== "ADMIN"` → `router.replace("/")`
- [ ] **C.3** `/admin/page.tsx` envuelta en `AdminRoute`: saludo con el email y aviso honesto de que el panel llega en 7.2–7.6 (**D6**: sin maqueta de dashboard)
- [ ] **C.4** `Header`: enlace «Admin» **sólo** cuando `user.role === "ADMIN"`, con la convención editorial (`text-xs uppercase tracking-widest`)

---

## D — Tests (R7)

- [ ] **D.1** `JwtService`: access **y** refresh de un admin contienen `role: "ADMIN"`; token emitido sin el claim produce autoridades de `USER`
- [ ] **D.2** `JwtAuthenticationFilter`: con token admin → `ROLE_ADMIN` en el `SecurityContext` · con token `USER` → `ROLE_USER` y **no** `ROLE_ADMIN` · sin claim → `ROLE_USER` · malformado → sin autenticar y `401` (regresión 5.3)
- [ ] **D.3** Seguridad de `/api/v1/admin/ping` en MockMvc — **los tres caminos**: sin token → `401` · token `USER` → `403` · token `ADMIN` → `200` con email y rol; y los endpoints públicos/autenticados **no cambian**
- [ ] **D.4** Semilla `V13`: migración aplicable dos veces seguidas sin duplicar ni fallar; usuarios existentes con `role = 'USER'`
- [ ] **D.5** Frontend: `AdminRoute` (3 caminos) · `Header.test.tsx` (ADMIN ve / USER no ve / sin sesión no ve) · página `/admin` semilla
- [ ] **D.6** **R8**: ningún test preexistente cambia su aserción (sólo firmas, ver Nota B-R8)

---

## E — Documentación (R8)

- [ ] **E.1** `docs/adr/0006-role-based-access-control.md`: Contexto → Decisión → Alternativas (tabla `roles`, permisos granulares, claim sólo en access) → Consecuencias; registrado en `docs/adr/README.md`
- [ ] **E.2** `CHANGELOG.md` — entrada en Keep a Changelog es-ES
- [ ] **E.3** README: credenciales del admin sembrado + aviso de **cambio en el primer arranque**
- [ ] **E.4** Bloque «ESTADO ACTUAL» de `AGENTS.md` **dentro de la feature PR**, verdad tras el merge, sin números de PR/SHA (D8, hereda D11) + `MEMORY.md` con la tarea marcada
- [ ] **E.5** **Sin PR de documentación de cierre**

---

## Cierre

- [ ] **Baselines**: `./mvnw test` **191+** · `npm run test:coverage` **297+** y EXIT 0 (globales 77/76/74/79 + `api.ts` ≥ 99 — **`npx vitest run` no evalúa umbrales**) · `tsc` 0 · ESLint 0/0 · `npm run build` 0 · E2E local (Chromium+WebKit) verde
- [ ] **Verificación en navegador**: el usuario `e2e@nexus.dev` (USER) **no ve** «Admin» y `/admin` lo redirige · el admin sembrado ve el enlace, entra y `GET /api/v1/admin/ping` responde `200`
- [ ] `/spec-check admin-roles` → aprobado
- [ ] **Preguntar al usuario antes de cualquier commit y PR** ⛔

---

## Notas de implementación

_(decisiones menores, hallazgos y desviaciones — se anotan aquí al ejecutar)_
