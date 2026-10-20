# Spec — Tarea 7.6: Dashboard con métricas

> **Fase 7 · Panel de administración** · requisitos (R1–R9) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D9) · checklist en `tasks.md`.
> **Estado**: ✅ APROBADA · **Fecha**: 2026-10-20 · **Aprobación**: 2026-10-20

---

## Resumen

El panel gana su **dashboard**: la portada `/admin` muestra métricas de
**ventas, catálogo y usuarios** con selector de periodo, y la Fase 7 cierra
con la desaparición del aviso «En construcción».

- **1 endpoint**: `GET /api/v1/admin/dashboard?days=…` — hereda
  `hasRole("ADMIN")` **sin tocar `SecurityConfig`** (plan D1).
- **Sin migración** (plan D6): V15 sigue siendo la última.
- **Ingresos siempre agrupados por moneda** y **excluyendo `CANCELLED`**
  (plan D3) — el panel no suma € con $ ni cuenta cancelados como ventas.
- Frontend: **KPIs arriba en `/admin`** + selector 7/30/90 + tarjetas debajo;
  el **aviso «En construcción» desaparece** (plan D7).
- **Sin ADR, sin E2E/a11y nuevos, cliente intocado** (plan D7/D9).

---

## R1 — API del dashboard

**Criterio**: el ADMIN recibe la foto completa del negocio en una sola
petición; nadie más puede.

| Método y ruta | Éxito | Parámetros |
|:--|:--|:--|
| `GET /api/v1/admin/dashboard` | `200` `AdminDashboardResponse` | `days` (opcional, def. `30`, entero `1–365`) |

```jsonc
// 200
{
  "range": { "days": 30, "from": "2026-09-20T08:00:00Z" },
  "sales": {
    "orderCount": 12,                                    // pedidos NO cancelados en periodo
    "byStatus": {                                        // los 5 estados, siempre con clave
      "PENDING": 0, "CONFIRMED": 5, "SHIPPED": 3,
      "DELIVERED": 4, "CANCELLED": 2
    },
    "revenue": [                                         // SIEMPRE agrupado por moneda
      { "currency": "EUR", "total": 1450.00, "orderCount": 9, "avgTicket": 161.11 },
      { "currency": "USD", "total": 320.50,  "orderCount": 3, "avgTicket": 106.83 }
    ]
  },
  "products": { "total": 4, "skus": 12, "families": 3 }, // snapshot (sin periodo)
  "users": { "total": 9, "admins": 1, "suspended": 0, "newInPeriod": 2 }
}
```

- **Una sola petición** devuelve todos los bloques (plan D1) — sin endpoints
  parciales ni fetch encadenados en cliente.
- `range.from = now − days` (instante del servidor) y `range.days` refleja el
  valor efectivamente aplicado (default incluido).
- Agregados de **sólo lectura** en repositories, `@Transactional(readOnly = true)`,
  **escalares en la respuesta** (sin entidades ⇒ sin N+1, plan D2).

---

## R2 — Reglas de ventas (las que hacen al dashboard honesto)

- **`sales.revenue` excluye `CANCELLED`**: `total` = `SUM(total_amount)` y
  `orderCount` = nº de pedidos **no cancelados** creados en el periodo,
  **agrupados por `currency`** — **jamás un total único entre monedas**
  (no existe tipo de cambio en el sistema; decisión 3.2/R8b).
- **`avgTicket` por moneda** = `total / orderCount` con `BigDecimal` `HALF_UP`
  escala 2 (regla 4.1). Monedas distintas ⇒ filas distintas, sin mezclar.
- **`sales.byStatus` cuenta los 5 estados** (cancelados incluidos) en el
  periodo; sus claves **están siempre presentes** (con `0` si no hay).
- `sales.orderCount` (ventas) y `sum(byStatus)` (todos los pedidos) miden
  cosas distintas y no deben cuadrar entre sí — documentado en el DTO.
- **Sin pagos ni reembolsos**: no hay caja real que reportar; el panel no
  afirma cobrar nada (plan D3, fuera de alcance §4).

---

## R3 — Catálogo y usuarios

- **`products`** = snapshot **sin periodo**: `total` (productos), `skus`,
  `familias` (distinct de `family`). Sin flag de activo en la entidad ⇒ no se
  inventa uno.
- **`users`**: `total` (todas las cuentas) · `admins` = `ADMIN` **sin
  suspender** (mismo criterio que la guarda de la 7.5) · `suspended` =
  `suspendedAt != null` (cualquier rol) · `newInPeriod` = `createdAt ≥ from`.
- Ambos bloques **con ceros válidos**: una tienda recién creada devuelve `0`s,
  nunca `null`s ni errores.

---

## R4 — Errores y estados vacíos

| Caso | Código | Detalle |
|:--|:--|:--|
| `days` ausente | `200` | default `30` |
| `days=14` (cualquier entero 1–365) | `200` | el rango lo pone la API, no la UI |
| `days=0`, `days=999`, `days=-5` | `400` | `IllegalArgumentException` → **handler existente con `message`** en español (plan D4) |
| `days=abc` | `400` | type mismatch de Spring (la UI jamás lo manda; `message` no exigido) |
| Periodo sin pedidos/usuarios | `200` | arrays `[]` y contadores en `0` — **nunca `404`** |

---

## R5 — Seguridad heredada, sin reglas nuevas

- `GET` sin token → `401`. Token `USER` → `403`. Token `ADMIN` → `200`.
- **`SecurityConfig` con diff = 0 líneas**: el endpoint cae en
  `/api/v1/admin/**` ya cubierto por la 7.1 (ADR-0006), igual que 7.2–7.5.
- `GET /inventory/**` y `GET /pricing/**` siguen públicos a propósito (6.4(i)).

---

## R6 — Frontend: métricas en `/admin`

**Criterio**: el operador ve la foto del negocio al abrir el panel, con el
periodo a un clic y sin promesas falsas.

- **Sección «Métricas» arriba** con 4 tarjetas (estilo editorial: cabecera
  `text-xs uppercase tracking-widest`, cifras `font-medium`):
  1. **Ventas del periodo** — nº de pedidos no cancelados + **ingresos por
     moneda** con ticket medio (`Intl.NumberFormat("es-ES", { style: "currency",
     currency })` por fila) + label explícito «pedidos no cancelados».
  2. **Pedidos por estado** — las **5 filas** siempre, con recuento y **barra
     CSS** (`div` con ancho % relativo al máximo; sin librerías de charts).
  3. **Catálogo** — productos · SKUs · familias.
  4. **Usuarios** — total · administradores · suspendidos · nuevos en el
     periodo.
- **Selector 7 / 30 / 90 días** (botones; el activo con
  `border-neutral-900 text-neutral-900`) — al pulsar, refetch con `days`
  nuevo. `text-neutral-900` en cualquier input si lo hubiera (regla 7).
- **Estados**: cargando · error de red con `getFriendlyErrorMessage()` +
  «Reintentar» · periodo vacío con **ceros visibles** (nunca `NaN`,
  `undefined` ni «—»).
- **`api.ts`**: `getAdminDashboard(days?)` con `getAuthHeaders()` (≥ 99
  preservado). **`errors.ts` sin cambios** (no hay códigos nuevos que
  traducir: la rama genérica ya cubre 400/403/red).
- Componente **`AdminMetrics`** en `components/admin/` (plan D7): testea
  aislado; `AdminPage` sólo lo compone.
- **Las 4 tarjetas de acceso existentes quedan intactas**, debajo de las
  métricas.

---

## R7 — Chrome del panel: aviso fuera, navegación sin cambios

- El bloque **«En construcción — El dashboard de métricas (7.6)…»** de
  `/admin` **desaparece**: la 7.6 cierra la Fase 7 y la promesa se cumple
  (D6 de la 7.1: «sólo se promete lo que no existe»).
- **`SECCIONES` no cambia** — «PANEL» ya apunta a `/admin` (el dashboard vive
  en la portada, plan D7: sin sección nueva que redunde).
- `AdminRoute` **no cambia** — sigue protegiendo `/admin/**`.
- El saludo (email + rol) de la portada **se conserva**.

---

## R8 — Tests

### R8.1 — Backend (base **325**)

- **Servicio con mocks** (números exactos, plan D8): exclusión de
  `CANCELLED` en `revenue`/`orderCount` · `byStatus` con las 5 claves ·
  agrupación por moneda sin cruzar · `avgTicket` `HALF_UP` escala 2 ·
  `revenue: []` sin pedidos (sin división) · `from = now − days` ·
  `days` fuera de `1–365` → `IllegalArgumentException` · `admins` sin suspender
  y `suspended` con cualquier rol.
- **Controller MockMvc `@SpringBootTest` + BD real** (patrón 7.4/7.5): shape
  completo del JSON · `days` default · `days=0` → **`400` con `message`** ·
  **consistencia** (claves de `byStatus`, `orderCount` ≤ suma de estados no
  cancelados, `users.total ≥ admins + suspended` cuando aplique) — **jamás
  globales exactos** (BD compartida).
- **Seguridad**: `401` sin token · `403` con token `USER` · `200` con `ADMIN`.
- **Sin escrituras**: el endpoint es GET puro — ningún test debe modificar
  filas (R9.2 trivial).

### R8.2 — Frontend (base **441**)

- **`AdminMetrics`**: render de los 4 bloques · selector que **llama a la
  API** con el `days` nuevo · estados cargando / error+«Reintentar» ·
  periodo vacío con ceros · formato de moneda por fila.
- **`api.ts`**: `getAdminDashboard` — URL, `days` como query param y
  `Authorization` (umbral fichero ≥ 99).

### R8.3 — Cambios declarados en tests preexistentes

| Test | Cambio |
|:--|:--|
| `AdminPage.test.tsx` | **4.ª evolución** (7.2 → 7.4 → 7.5 → 7.6): se **retiran** las aserciones «en construcción»/«7.6» y **se añade** la sección de métricas. Saludo, rol y las 4 tarjetas con sus `href` **intactos**; `replace` sin llamar. |

**Ningún otro test preexistente cambia su aserción.** `AdminLayout.test.tsx`
**sin cambios** (`SECCIONES` no cambia). Gate final:
`npm run test:coverage` **EXIT 0**, `tsc` 0, ESLint **0/0**, `npm run build`.

---

## R9 — Verificación, datos y documentación de cierre

### R9.1 — Verificación en navegador (stack real)

1. Como **ADMIN**, `/admin` muestra las métricas **por encima** de las
   tarjetas: ventas, ingresos por moneda, 5 estados con barras, catálogo,
   usuarios.
2. Cambiar el periodo **7 → 30 → 90** refetchea (se observa la llamada y los
   números/`range.days` corresponden).
3. **Sin aviso «En construcción»**; saludo y 4 tarjetas siguen donde estaban.
4. Como **USER**, `/admin` sigue redirigiendo (`AdminRoute` intacto).
5. **Cliente intocado**: perfil/`me` y pedidos del cliente siguen iguales
   (diff vacío sobre `UserController`/`OrderController`).

### R9.2 — BD sin restos

- El dashboard **no escribe nada** (GET puro): sin filas nuevas ni modificadas
  · sembrados (`admin@nexus.dev`, `e2e@nexus.dev`, catálogo) **intactos** ·
  sin `test-*` propios que limpiar (no se crea ninguno).

### R9.3 — Documentación y cierre

- **`CHANGELOG.md`**: entrada «7.6 — Dashboard con métricas» en
  `[Unreleased]` (es-ES, Keep a Changelog).
- **Bloque «ESTADO ACTUAL»** de `AGENTS.md` y sección de `MEMORY.md`
  refrescados **dentro de la feature PR** (convención D11 — verdad tras el
  merge, sin PR/SHA): la Fase 7 queda **completa** y la tarea siguiente pasa
  a la **Fase 8 (8.1 Dockerfile)**.
- **`tasks.md`** con todas las tareas marcadas al completarse.
- **Sin ADR** y **sin PR de documentación de cierre** (plan D9).
- **`/spec-check admin-dashboard`** en verde antes de cerrar.

### R9.4 — Sin migración

- **V15 sigue siendo la última**: ningún fichero nuevo en `db/migration/` y
  **V1–V15 sin tocar** (verificado con `git status`).
