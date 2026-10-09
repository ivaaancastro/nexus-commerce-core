# Tasks — Tarea 7.1: Roles y permisos (`ADMIN`/`USER`)

> **Fase 7 · Panel de administración** · spec `spec.md` (R1–R8) · plan `plan.md` (D1–D9).
> Un checkbox por unidad terminada; las decisiones y hallazgos quedan como nota
> debajo de su bloque. **Regla**: marcar al completar; nada de código fuera de
> este checklist.

---

## A — Migración y modelo (R1)

- [x] **A.1** `V13__user_roles.sql`: `ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER'` — el `DEFAULT` clasifica todos los usuarios existentes sin `UPDATE`
- [x] **A.2** Semilla idempotente del primer admin: `INSERT … ON CONFLICT (email) DO NOTHING`
- [x] **A.3** Enum `Role` (`USER`, `ADMIN`) en `entity/` con `@Enumerated(EnumType.STRING)`
- [x] **A.4** Campo `role` en la entidad `User` (`nullable = false`, `length = 20`), réplica exacta del patrón `Gender`
- [x] **A.5** Verificación con Flyway real: los `@SpringBootTest` ejecutan V13; `./mvnw test` en verde

### Nota A.2 — la semilla debe poder **iniciar sesión** ✅ ejecutada

El login exige `email_verified = TRUE` (columna de `V6`), así que el `INSERT`
lo lleva a `TRUE` — un admin sin verificar no podría autenticarse. Además
`password_hash` necesita un **hash BCrypt coste 12 precalculado**: no existe
ningún hash previo en las migraciones (los usuarios se crean por registro). Se
generó **con la propia `BCryptPasswordEncoder(12)` de `SecurityConfig`** — no
con `htpasswd`, que produce `$2y$` y no era el verificador real.

**Decisión («Decide tú»)**: credenciales documentadas **sólo en el README**
(`admin@nexus.dev` / `Admin1234!`, con aviso de cambio en el primer arranque).
El `plan.md` D3 menciona `.env.example`: **no existe en el repo**, y crear uno
parcial sería más confuso que útil — la semilla es un literal de la migración,
no una variable: cambiarla en `.env` no cambiaría nada en BD.

### Nota A.4 — `@Builder.Default role = Role.USER`

Sin `@Builder.Default`, `@Builder` ignoraría el inicializador y los **5 tests
que construyen `User.builder()`** insertarían `role = NULL` contra la columna
`NOT NULL`. Con él, toda construcción que no declare rol nace `USER` — mínimo
privilegio y **R8 intacto sin tocar un solo test** (los fixtures de frontend
sí ganaron la propiedad `role: "USER"` porque el tipo la exige ya).

---

## B — Backend: JWT, autorías y regla (R2, R3, R4)

- [x] **B.1** `JwtService`: claim **`role`** en `generateToken(...)` **y** en `generateRefreshToken(...)`
- [x] **B.2** Token **sin** el claim → asunción `USER` (mínimo privilegio, D2): nunca `ADMIN`, tanto en la firma como en la lectura (`extractRole` devuelve `USER` si el claim falta o es basura)
- [x] **B.3** `JwtAuthenticationFilter` construye las autorías: `ROLE_USER` siempre, `ROLE_ADMIN` además si el claim lo dice; token malformado/expirado sigue descartándose sin 500 (regresión de la 5.3 intacta)
- [x] **B.4** `AuthResponse` y `UserResponse` ganan el campo `role` (login, refresh y `GET /api/v1/users/me` — el rol va **dentro de `user`**, así que `AuthResponse` no cambia de aridad)
- [x] **B.5** `SecurityConfig`: `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` **antes de** `.anyRequest().denyAll()`
- [x] **B.6** `AdminController` + `GET /api/v1/admin/ping` → `200` con `email` y `role` del llamante (D5)

### Nota B.5 — orden contra `denyAll` (interacción con la 6.4) ✅

Desde la Fase 6 el final de la cadena es **`denyAll()`**: sin la regla
`hasRole`, `/api/v1/admin/**` quedaría denegado **también para el `ADMIN`** (no
es que «se escape», es que no entra nadie). El orden — regla **antes** de
`anyRequest` — es el requisito que verifica D.3 con los tres caminos.

### Nota B.1 — de dónde sale el rol en el **refresh** ✅ resuelta

`AuthService.refreshToken` **ya recarga el usuario de BD**
(`findByEmail(email)` → `buildAuthResponse(user)`), así que el rol del access
token nuevo sale de la BD sin propagar el claim del refresh original: la opción
con menos cambios era la que el flujo ya hacía.

### Nota B (R8) — firmas que ganan parámetros ✅ adaptado

- `generateToken`/`generateRefreshToken(+role)`: llamadas en `AuthService` (2)
  y stubs en `AuthServiceTest` (2) + `SecurityRulesTest` (`Role.USER`).
- `UserResponse(+role)`: `AuthService.mapToUserResponse`, `UserService.toResponse`
  y las 2 construcciones de `UserControllerTest`.
- **Ninguna aserción tocada** — sólo aridad y argumentos, tal y como pide R8.

---

## C — Frontend: puerta y visibilidad (R5, R6)

- [x] **C.1** `types/auth.ts`: `User` gana `role: "USER" | "ADMIN"`; el `AuthContext` lo propaga desde login/refresh/`GET /users/me` (sin lógica nueva: ya guardaba el `user` entero)
- [x] **C.2** Componente `AdminRoute` (patrón de `ProtectedRoute`): cargando → estado accesible (`role="status"`) · sin sesión → `router.replace("/login")` · sesión con `role !== "ADMIN"` → `router.replace("/")`
- [x] **C.3** `/admin/page.tsx` envuelta en `AdminRoute`: saludo con el email y aviso honesto de que el panel llega en 7.2–7.6 (**D6**: sin maqueta de dashboard)
- [x] **C.4** `Header`: enlace «Admin» **sólo** cuando `user.role === "ADMIN"`, con la convención editorial (`hover:text-black transition-colors` en el mismo contenedor que Pedidos/Cuenta)

---

## D — Tests (R7)

- [x] **D.1** `JwtServiceTest` (4): access **y** refresh de un admin contienen `role: "ADMIN"` · token emitido **sin** el claim → `USER` · claim con valor desconocido → `USER` (sin excepción)
- [x] **D.2** `JwtAuthenticationFilterTest` (+3): con token admin → `ROLE_USER`+`ROLE_ADMIN` · con token `USER` → sólo `ROLE_USER` · sin stub de `extractRole` (claim ausente) → `ROLE_USER`. Los 3 tests preexistentes siguen **intactos** (no asertaban autorías)
- [x] **D.3** Seguridad de `/api/v1/admin/ping` en `SecurityRulesTest` (+3) — **los tres caminos**: sin token → `401` · token `USER` → `403` · token `ADMIN` → `200` con email y rol; y los públicos/autenticados **no cambian** (los 8 tests previos en verde)
- [x] **D.4** `UserRolesMigrationTest` (3): `column_default` contiene `USER` y `role IS NULL` = 0 · semilla única, `ADMIN` y verificada · **reejecución del fichero V13 dos veces sin fallo ni duplicado**
- [x] **D.5** Frontend: `AdminRoute.test.tsx` (3 caminos) · `Header.test.tsx` (+3: ADMIN ve / USER no ve / sin sesión no ve) · `AdminPage.test.tsx` (ADMIN renderiza saludo+aviso · USER redirige a `/`)
- [x] **D.6** **R8**: ningún test preexistente cambió su aserción — sólo firmas (Nota B-R8) y fixtures con el campo nuevo `role`

---

## E — Documentación (R8)

- [x] **E.1** `docs/adr/0006-role-based-access-control.md`: Contexto → Decisión (5) → Alternativas (tabla) → Consecuencias; registrado en `docs/adr/README.md`
- [x] **E.2** `CHANGELOG.md` — entrada en Keep a Changelog es-ES
- [x] **E.3** README: credenciales del admin sembrado + aviso de **cambio en el primer arranque** + sección de zona admin y `/admin/ping`
- [x] **E.4** Bloque «ESTADO ACTUAL» de `AGENTS.md` **dentro de la feature PR**, verdad tras el merge, sin números de PR/SHA (D8, hereda D11) + `MEMORY.md` con la tarea marcada
- [x] **E.5** **Sin PR de documentación de cierre**

---

## Cierre

- [x] **Baselines**: `./mvnw test` **204/204** · `npm run test:coverage` **306/306** y EXIT 0 (globales 77/76/74/79 medidos **82.93 / 79.06 / 81.54 / 84.8** + `api.ts` ≥ 99 — **`npx vitest run` no evalúa umbrales**) · `tsc` 0 · ESLint 0/0 · `npm run build` 0 · E2E local **36/14/0** (Chromium+WebKit; FF = fallo ambiental D10 → CI)
- [x] **Verificación en navegador**: el usuario `e2e@nexus.dev` (USER) **no ve** «Admin» y `/admin` lo redirige a `/` · el admin sembrado ve el enlace, entra y `GET /api/v1/admin/ping` responde `200` **desde el navegador** · consola limpia
- [x] `/spec-check admin-roles` → aprobado (ver informe en la sesión)
- [ ] **Preguntar al usuario antes de cualquier commit y PR** ⛔

---

## Notas de implementación

_(decisiones menores, hallazgos y desviaciones — se anotan aquí al ejecutar)_

- **`@Tag` de springdoc** vive en `io.swagger.v3.oas.annotations.tags.Tag` (no en `...annotations.Tag`): primer `test-compile` falló ahí y se corrigió copiando el import de `UserController`.
- **Cobertura de los ficheros nuevos**: `AdminRoute.tsx` 16/16 líneas, `admin/page.tsx` 3/3, `Header.tsx` 6/7 (la línea 47 —selector de mercado— es hueco preexistente).
- **Baselines resultantes**: backend **204** (191 + 13) · frontend **305** (297 + 8) · cobertura **82.93 / 79.06 / 81.54 / 84.8** — por encima de los suelos congelados 77/76/74/79.
