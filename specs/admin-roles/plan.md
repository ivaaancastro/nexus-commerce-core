# Plan — Tarea 7.1: Roles y permisos (`ADMIN`/`USER`)

> **Fase 7 · Panel de administración** · documento de diseño (D1–D9).
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md`.

---

## 1. Objetivo

Toda la Fase 7 (CRUD de productos, stock, pedidos, usuarios, dashboard)
descansa sobre una pregunta que hoy **no se puede responder**:

> *¿Quién tiene permiso para hacer esto?*

Hoy la respuesta es «cualquier sesión» o «nadie», según el endpoint. La 7.1
instala el cimiento: **dos roles, enforcement en backend, visibilidad en
frontend**, para que 7.2–7.6 construyan encima sin rediseñar seguridad.

**Resultado esperado**: un usuario `ADMIN` puede entrar en `/admin` y llamar a
`/api/v1/admin/**`; un `USER` recibió `403` en la API y ni siquiera ve el enlace.

---

## 2. Estado real — auditoría previa del repositorio (2026-10-09)

Hecha sobre el código de `main` antes de escribir una sola línea de spec.

### 2.1 No existe el concepto de rol

| Señal | Hallazgo |
|:---|:---|
| **Esquema `users`** (`V6__users_schema.sql`) | **Sin columna `role`**. 14 columnas, ninguna de autorización. |
| **Entidad `User`** | Sin campo de rol. Tiene `Gender` (enum) pero no `Role`. |
| **`SecurityConfig`** | `authorizeHttpRequests` distingue sólo `permitAll` / `authenticated` / `denyAll`. **Ni una regla `hasRole`.** |
| **`anyRequest().denyAll()`** | Al final de la cadena desde la **6.4** (cuando se escribió esta auditoría era `permitAll()`): lo que no está listado, no funciona. |
| **`MEMORY.md`** | «Auth: JWT + BCrypt, roles: solo USER por ahora» — reconocido, nunca implementado. |

### 2.2 El JWT no lleva autorización

| Componente | Estado |
|:---|:---|
| `JwtService.generateToken(userId, email)` | claims: `userId`, `email`. **Sin `role`.** Lo mismo en el refresh. |
| `JwtAuthenticationFilter` | Construye `UsernamePasswordAuthenticationToken(email, null, **emptyList())` — la lista de autorías **siempre vacía**. Cualquier `hasRole()` futuro denegaría **también al admin**. |
| `AuthResponse` / `UserResponse` | `record` sin `role`. El frontend no puede saber el rol del usuario. |

### 2.3 El frontend no distingue

| Señal | Hallazgo |
|:---|:---|
| `types/auth.ts` → `User` | Sin `role`. |
| `ProtectedRoute` | Sólo comprueba `isAuthenticated`. Un `USER` y un `ADMIN` ven **exactamente lo mismo**. |
| `Header` | Enlaces fijos: Perfil, Pedidos, Direcciones… **Ninguno condicional a rol.** |
| Rutas `/admin` | **No existen.** |

### 2.4 Infraestructura aprovechable

- **`Gender` ya es un `@Enumerated(EnumType.STRING)` en `VARCHAR(20)`** → el
  patrón para `Role` está replicado en el propio código, sin aprender nada nuevo.
- **`JwtAuthenticationFilter` descarta tokens malformados** con `try/catch` y
  sigue sin autenticar (decisión ya tomada en la 5.3) → añadir claims no rompe
  tokens viejos.
- **Tests `@SpringBootTest` con BD real** (Flyway sobre PostgreSQL de
  `docker-compose`) → la migración se prueba **ejecutándose**, no simulada.

---

## 3. Decisiones de diseño

### D1 — Rol como **columna en `users`**, no como tabla

| Alternativa | Por qué no |
|:---|:---|
| Tabla `roles` + `user_roles` (many-to-many, JPA clásico) | Diseño para un problema que no existe: **dos roles**, sin permisos granulares, sin herencia. Añade JOIN, entidad, repositorio y semilla para sostener un `IF`. |
| **`role VARCHAR(20) NOT NULL DEFAULT 'USER'`** ✅ | Réplica exacta del patrón `Gender` ya en la tabla. La migración es **backfill gratis**: `DEFAULT 'USER'` clasifica a los usuarios existentes sin `UPDATE`. |

Si algún día hay permisos por recurso, la tabla relacionada es una migración
nueva — no se paga ese coste hoy.

### D2 — El rol viaja en el **claim `role` del JWT**

El rol se resuelve **en el filtro**, con el token, sin consultar la BD en cada
petición (el filtro ya vive de esa premisa: estadoless, cero roundtrips).

> **Mínimo privilegio ante tokens antiguos**: un token emitido **antes** de esta
> tarea **no tiene el claim** → el filtro asume **`USER`**, nunca `ADMIN`.
> Un admin con sesión abierta deberá **revalidar sesión** (o esperar al refresh,
> que ya emite el claim nuevo) para que su token lo lleve. **Coste asumido y
> documentado**: preferible a degradar a *auto-conceder* lo que el token no dice.

### D3 — El primer `ADMIN` se **siembra en la migración**

No puede haber endpoint «promocionar a admin» sin que ya exista un admin
(huevo-y-gallina), ni runner por variable de entorno que exija registrar y
reiniciar.

- `V13__user_roles.sql` añade la columna y **siembra un usuario admin** con
  `ON CONFLICT DO NOTHING` (idempotente, igual que V11/V12).
- Contraseña por defecto documentada en `.env.example` y en el README de la
  tarea: **el comprador la cambia en el primer arranque** (fuera de alcance
  aquí el cambio forzado; se anota como mejora de la Fase 7).

### D4 — **El backend manda; el frontend sólo oculta**

- **Backend**: `requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` **antes**
  de `anyRequest().denyAll()` (final de cadena desde la 6.4) — el orden importa,
  la primera coincidencia gana; **sin la regla, el `denyAll` bloquearía también
  al `ADMIN`**.
- **Frontend**: `AdminRoute` + enlace condicional en el `Header` son **UX, no
  seguridad**. Ocultar un botón no protege nada; proteger es el `403` de la API.

Si un `USER` fuerza la navegación a `/admin` o llama a la API con su token,
pierde en ambos frentes: la ruta le redirige y la API le devuelve `403`.

### D5 — Endpoint admin mínimo: **`GET /api/v1/admin/ping`**

Las tareas 7.2–7.6 traerán sus endpoints. Aquí hace falta **uno real** contra el
que verificar que la regla `hasRole` funciona end-to-end (403 vs 200 con token),
y no sólo en un test aislado. Devuelve el email y el rol del llamante —
útil además como *readiness* del panel en el futuro.

### D6 — `/admin` existe como **página semilla**, vacía a propósito

`/admin` con `AdminRoute`, un saludo con el email y un aviso de que el panel
llega en 7.2–7.6. **No se maqueta el dashboard** — una UI fingida que después
desaparece es peor que un placeholder honesto. El enlace en el `Header` sólo se
pinta con `role === "ADMIN"`.

### D7 — **ADR-0006** sí (a diferencia de 3.x y 4.x)

Las tareas anteriores evitaron el ADR *porque no cambiaban arquitectura*. Ésta
**cambia el modelo de autorización** de todo el sistema: de «autenticado vs
público» a RBAC con enforcement en el filtro JWT. Es exactamente el tipo de
decisión que un futuro desarrollador (o el comprador) necesita encontrar
documentada: `docs/adr/0006-role-based-access-control.md`.

### D8 — Sin ADR de despliegue, sin PR de documentación de cierre

Hereda la **D11 de la 3.3**: el bloque «ESTADO ACTUAL» de `AGENTS.md` se
redacta **dentro de la feature PR**, formulado para ser verdad **después del
merge** y **sin números de PR ni SHA**. No habrá PR de cierre de docs.

### D9 — Cambio de rol en caliente: **fuera de alcance aquí**

Poder **promocionar/demotear** un usuario desde la UI llega con la 7.5
(gestión de usuarios). En esta tarea el rol se asigna una vez (migración) y se
lee siempre. Se anota en `spec.md` para que la 7.5 lo recoja.

---

## 4. Fuera de alcance

- ❌ **CRUD de productos / stock / precios / pedidos** — 7.2, 7.3, 7.4.
- ❌ **Gestión de usuarios (ver, suspender, cambiar rol)** — 7.5.
- ❌ **Dashboard con métricas** — 7.6.
- ❌ **Cambio de contraseña / 2FA / rotación de refresh** — mejora futura.
- ❌ **Auditoría de acciones admin (audit log)** — mejora futura.
- ❌ **Permisos granulares por recurso** (D1: sobre-diseño hoy).
- ❌ **Actualizar tokens vivos** — un JWT emitido antes de esta tarea asume
  `USER` hasta que se refresque (D2).

---

## 5. Estimación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | Migración `V13` + enum `Role` + campo en `User` | bajo |
| **B** | `JwtService` (claim `role`) + `JwtAuthenticationFilter` (autorías) + `SecurityConfig` | medio |
| **C** | `AdminController` + `ping` + `UserResponse.role` + `AuthResponse` | bajo |
| **D** | Frontend: tipo `User.role`, `AdminRoute`, `/admin`, enlace en `Header` | medio |
| **E** | Tests: backend (seguridad, filtro, migración) + frontend (`AdminRoute`, `Header`) | medio |
| **F** | ADR-0006 + CHANGELOG + estado en la PR | bajo |

**Baselines que deben seguir verdes** (medidos tras la Fase 6): `./mvnw test` →
**191+** · `tsc --noEmit` → 0 · ESLint → 0/0 · `npm run test:coverage` →
**297+** y EXIT 0 (umbrales congelados: globales 77/76/74/79 + `api.ts` ≥ 99) ·
`npm run build` → 0 · E2E local (Chromium+WebKit) → en verde · `/spec-check` →
aprobado.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| Sin la regla, el `anyRequest().denyAll()` (6.4) deja `/admin/**` **denegado también al ADMIN** | regla `hasRole` **antes** de `anyRequest` + test MockMvc que comprueba los tres caminos: `401` sin token, `403` con token `USER`, `200` con `ADMIN` |
| Tokens antiguos sin claim → admin bloqueado y no sabe por qué | D2 documentado: asunción `USER` + el refresh ya emite el claim; mensaje amigable en 403 |
| El filtro construye la auth con `emptyList()` y **todo** `hasRole` deniega incluso al admin | test del filtro que verifica `ROLE_ADMIN` presente en el `SecurityContext` |
| Semilla de admin duplicada en entornos existentes | `ON CONFLICT DO NOTHING` (mismo patrón que V11/V12) |
| Frontend asume rol que backend no valida → falsa sensación de seguridad | D4 escrito: el `403` de la API es la garantía; el test E2E/unitario del frontend sólo cubre UX |
