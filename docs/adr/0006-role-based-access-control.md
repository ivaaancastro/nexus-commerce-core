# ADR-0006: Control de Acceso Basado en Roles (RBAC) con `ADMIN`/`USER`

* **Estado:** Aprobado
* **Fecha:** 2026-10-09
* **Decisores:** Equipo Nexus Core

---

## 1. Contexto y Problema

La auditoría previa a la Tarea 7.1 (`specs/admin-roles/plan.md` §2) demostró que el sistema **no tenía ningún concepto de rol**:

* El esquema `users` no albergaba permiso ni rol alguno; no había tabla de roles ni relación N:M.
* `SecurityConfig` sólo distinguía `permitAll` / `authenticated` — **ni una regla `hasRole`** en toda la cadena.
* Tras la Tarea 6.4, la cadena termina en `anyRequest().denyAll()`: lo no listado queda cerrado, pero **no distingue quién llama**.
* El frontend trataba idénticamente a todos los usuarios autenticados.

Sin ese concepto, la Fase 7 (panel de administración) era inviable: no existía forma de responder *¿quién tiene permiso para gestionar productos, stock, pedidos o usuarios?*.

---

## 2. Decisiones Tomadas

### 2.1 Dos roles persistidos en `users.role`
* **Decisión:** columna `role VARCHAR(20) NOT NULL DEFAULT 'USER'` (migración `V13__user_roles.sql`) con enum `Role { USER, ADMIN }` (`@Enumerated(EnumType.STRING)`).
* **Motivo:** el `DEFAULT` clasifica todos los usuarios existentes sin `UPDATE` manual y `NOT NULL` elimina el estado «sin rol». Dos valores bastan porque la autorización es **por rol**, no por permiso granular. Se siembra un `ADMIN` inicial idempotente (`ON CONFLICT DO NOTHING`), nacido ya verificado, para que `/api/v1/admin/**` tenga a alguien capaz de llamarlo.

### 2.2 El rol viaja en el claim `role` del JWT
* **Decisión:** `JwtService.generateToken` y `generateRefreshToken` incluyen el claim `role`; `JwtAuthenticationFilter` construye las autorías: `ROLE_USER` siempre, `ROLE_ADMIN` además sólo si el claim lo dice. **Sin claim → `USER`** (mínimo privilegio: un token anterior a la 7.1 jamás puede otorgar `ADMIN`).
* **Motivo:** el filtro es stateless y el token es la única verdad disponible por petición. Asomarse a la BD en cada request para el rol añadiría un acoplamiento innecesario cuando el login ya conoce el usuario. El refresh token se emite con el mismo claim y, además, el flujo de refresh recarga el usuario de BD.

### 2.3 Enforcement en `SecurityConfig`: `hasRole` **antes** de `denyAll`
* **Decisión:** `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` colocado **antes** de `.anyRequest().denyAll()` (primera coincidencia gana).
* **Motivo:** desde la 6.4 el final de la cadena es `denyAll()`; **sin la regla, `/api/v1/admin/**` quedaría cerrado también para el `ADMIN`** — no es que se escape nadie, es que no entra nadie. El orden es el requisito, y `SecurityRulesTest` verifica los tres caminos: `401` sin token · `403` con rol `USER` · `200` con `ADMIN`.

### 2.4 El frontend sólo **visible**, no **seguro**
* **Decisión:** tipo `User.role`, componente `AdminRoute` (patrón `ProtectedRoute`: sin sesión → `/login`; con sesión `USER` → `/`) y enlace «Admin» en el `Header` pintado **sólo** para `role === "ADMIN"`.
* **Motivo:** la visibilidad es UX; la seguridad vive en la API. Un `USER` que fuerce `/admin` en cliente no verá nada, y un `curl` contra la API recibe `403` — la puerta existe en ambos lados.

### 2.5 Excepción para el cierre de la Fase 6
* **Decisión:** ADR propio para la 7.1 (el ADR-0006 estaba reservado desde la spec de la Fase 6, `specs/tech-debt/` D8) — el cambio de modelo de autorización sí es decisión arquitectónica.

---

## 3. Alternativas Consideradas

| Alternativa | Por qué se descarta |
| :--- | :--- |
| **Campo booleano `is_admin`** | Imposibilita añadir un tercer rol sin migración y rompe la semántica «lista de roles» que la futura 7.5 (cambiar rol de usuarios) necesita. |
| **Tabla `roles` + permisos granulares (`permissions` N:M)** | Over-engineering para dos roles; añade joins, caché de permisos y una superficie de error enorme sin un caso de uso que la justifique. |
| **Rol sólo en el access token, no en el refresh** | El refresh renueva la sesión completa; si no llevara el claim, cada renovación exigiría recomputarlo. Además el flujo de refresh ya recarga el usuario de BD, así que no hay superficie de engaño. |
| **Consultar la BD en el filtro por cada petición** | Estado adicional en un filtro stateless; el token firmado ya garantiza integridad, y el coste de un `SELECT` por request no compra nada. |
| **Autorización sólo en el frontend (`AdminRoute`)** | Trivialmente evitable con `curl`: cualquier usuario autenticado podría manipular datos desde la API. |

---

## 4. Consecuencias

### Positivas
* **Cimiento para toda la Fase 7**: 7.2–7.6 construyen sus endpoints bajo `/api/v1/admin/**` con una sola regla ya instalada.
* **Fail-closed en ambos lados**: API (`hasRole` + `denyAll`) y UI (`AdminRoute` + enlace condicional).
* **Clasificación automática**: el `DEFAULT 'USER'` de `V13` migra la base instalada sin scripts de datos.
* **Mínimo privilegio como default**: token sin claim, valor desconocido o constructor de entidades sin declarar rol → todo cae en `USER`.

### Compromisos y riesgos asumidos
* **El rol en un access token caduca a las 24 h**: promocionar o degradar un usuario (7.5) no surtirá efecto en la sesión vigente hasta el siguiente refresh. Queda documentado para la 7.5.
* **Credenciales de la semilla (`admin@nexus.dev`) publicadas en el README**: el comprador **debe cambiarlas en el primer arranque** — es el precio de tener un admin que funcione out-of-the-box sin migración posterior.
* **La semilla vive en la migración**: editarla exige Flyway (no es configurable por entorno). Se asume deliberadamente: un admin de desarrollo distinto por entorno es tarea de instalación (Fase 8).
