# Spec — Fase 6: Deuda técnica (6.1–6.4)

> **Fase 6 · Deuda técnica (previa)** · requisitos (R1–R6) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D9) · checklist en `tasks.md`.

---

## Resumen

Cuatro reparaciones acotadas, aprobadas el 2026-10-09 para pagar la deuda
**antes** de las fases 7–10:

| # | Requisito | Tarea |
|:--|:---|:---|
| **R1** | Header sin desborde móvil | 6.1 |
| **R2** | Búsqueda funcional sin `OPENAI_API_KEY` | 6.2 |
| **R3** | El modo de búsqueda se declara en la respuesta | 6.2 |
| **R4** | `api.ts` con umbral de cobertura por fichero congelado | 6.3 |
| **R5** | `SecurityConfig` con lista explícita y health check | 6.4 |
| **R6** | Documentación y estado | todas |

---

## R1 — Header sin desborde móvil

**Criterio**: a cualquier anchura ≥ 320 px, el header **no** produce scroll
horizontal.

- **Corrección acotada (D1)**: la fila del header puede **envolver**
  (`flex-wrap`), con altura mínima flexible (`min-h-16` en vez de `h-16`
  fijo) y gaps responsivos. Sin menú hamburguesa, sin JS nuevo, sin
  componente nuevo.
- **Todos los enlaces siguen visibles** en móvil (nada se oculta para «arreglar»
  el desborde).
- **Pasada por las 14 rutas** del App Router a **390 px**: cualquier otro
  desborde **de la misma fila** se corrige aquí; si exige rediseño, se documenta
  en `tasks.md` y se saca (regla 3).

### Criterios de aceptación

- [ ] A **390 px**, `/` no tiene scroll horizontal (`scrollWidth` ≤ ancho de ventana)
- [ ] A **560 px** (el punto exacto del desborde reportado) tampoco
- [ ] A **768 y 1440 px** la apariencia no cambia respecto a `main`
- [ ] Con sesión, con sin sesión, y con el selector de mercado, el header no desborda
- [ ] Pasada por **14 rutas a 390 px**: desbordes de fila corregidos, rediseños anotados
- [ ] Existe **test de regresión en Playwright** (D2): viewport 390 px, sin
      scroll horizontal — o, si no es viable, la imposibilidad está documentada
      en `tasks.md` con su motivo
- [ ] `vitest` → 270+ en verde · `tsc` → 0 · ESLint → 0/0 · `build` → 0

---

## R2 — Búsqueda funcional sin `OPENAI_API_KEY`

**Criterio**: `/search` **funciona siempre**. Con clave es semántica; sin clave
es búsqueda por texto. **Nunca un 500.**

- **Detección (D3)**: si `spring.ai.openai.api-key` está vacía o es el literal
  `mock-key`, la búsqueda semántica **no se intenta**.
- **Fallback en backend**: `ProductSearchService` resuelve con `ILIKE` sobre
  nombre/descripción/referencia (`case insensitive`), con el `limit` y el
  filtro `family` respetados (mismo contrato que hoy).
- **Belt-and-braces**: si OpenAI falla **pese a la detección** (clave inválida,
  red, cuota), la excepción se captura → fallback con `log.warn` → `200`.
- **`POST /products/search/index`** y **`POST /products/enrich`** sin clave
  disponible → **`503`** con error estructurado
  (`code: SEMANTIC_SEARCH_UNAVAILABLE` / `ENRICHMENT_UNAVAILABLE`), **no** `500`.
- Ambos POST pasan a `authenticated()` (R5).
- Con clave válida, el comportamiento **no cambia** (la semántica es la vía
  normal; el umbral de similitud 0.65 y el `filterExpression` de familia
  intactos).

### Criterios de aceptación

- [ ] Sin `OPENAI_API_KEY`, `GET /search/semantic?query=…` → **200** con resultados
      reales del catálogo (búsqueda por texto)
- [ ] Sin clave, **cero llamadas** a la API de OpenAI (detección previa)
- [ ] Con la clave rota a propósito (mock que lanza excepción), la respuesta
      sigue siendo **200** con fallback (belt-and-braces probado)
- [ ] Sin clave, `POST /search/index` → **503** con `SEMANTIC_SEARCH_UNAVAILABLE`
- [ ] Sin clave, `POST /products/enrich` → **503** con `ENRICHMENT_UNAVAILABLE`
- [ ] El filtro `family` y el `limit` se aplican también en el fallback
- [ ] Con clave simulada válida, el camino semántico **no se toca** (tests existentes de la 3.1 siguen verdes)
- [ ] Tests nuevos de `ProductSearchService` para: detección, fallback,
      belt-and-braces, `family`, `limit`, y los dos `503`

---

## R3 — El modo de búsqueda se declara

**Criterio**: quien recibe la respuesta **sabe** cómo se buscó. Nadie miente
en la UI.

- `ProductSearchResultResponse` gana el campo **`searchMode`**:
  `"SEMANTIC"` | `"TEXT"` (aditivo, D4).
- `/search` adapta el subtítulo:
  - `SEMANTIC` → «…encontrados por proximidad vectorial» (copy actual);
  - `TEXT` → «…encontrados» + nota discreta «Búsqueda por texto — configura
    `OPENAI_API_KEY` para la búsqueda semántica».

### Criterios de aceptación

- [ ] Respuesta semántica → `searchMode: "SEMANTIC"`
- [ ] Respuesta por fallback → `searchMode: "TEXT"`
- [ ] El tipo `SemanticSearchResult` del frontend incluye `searchMode`
- [ ] La UI muestra la nota **sólo** en modo `TEXT`
- [ ] Test de componente de `/search` cubre las dos ramas de subtítulo

---

## R4 — Cobertura de `api.ts` congelada por fichero

**Criterio**: la única puerta a la API deja de ser el punto más débil, y **no
puede volver a bajar**.

- Tests nuevos de `src/lib/api.ts` con `fetch` mockeado, cubriendo al menos:
  `handleResponse()` (éxito, 204/vacío, error HTTP), cabeceras
  (`Authorization`, `Idempotency-Key`), y los métodos representativos
  (GET/POST, refresh de token, manejo de errores).
- **`thresholds` por fichero** en `vitest.config.ts`
  (`thresholds["src/lib/api.ts"]`): valor **medido** y congelado con holgura
  (D5). Los umbrales globales **no cambian**.
- **Comprobación negativa**: con el umbral del fichero en 100 →
  `npm run test:coverage` **≠ 0**; revertido → **0**.

### Criterios de aceptación

- [ ] Existen tests dedicados de `api.ts` (fichero nuevo en `src/__tests__/`)
- [ ] Cobertura medida de `api.ts` antes de congelar (número escrito en `tasks.md`)
- [ ] `vitest.config.ts` declara `thresholds["src/lib/api.ts"]` por debajo de lo medido
- [ ] Umbrales globales **77/76/74/79 intactos**
- [ ] Comprobación negativa hecha y anotada (≠0 con umbral en 100, 0 revertido)
- [ ] Ningún test preexistente cambia su aserción (regla R8)

---

## R5 — `SecurityConfig` con lista explícita y health check

**Criterio**: lo que no está listado, **no funciona**; y hay un endpoint que
dice si el sistema está vivo.

- **`anyRequest().denyAll()`** sustituye a `permitAll()` (D6), con lista
  completa y orden correcto (primera coincidencia gana):
  - **`permitAll`**: `/auth/**`, `/health`, `/markets`, `GET /products/**`,
    `GET /inventory/**`, `/pricing/**`, SpringDoc (`/v3/api-docs/**`,
    `/swagger-ui/**`, `/swagger-ui.html`), `/error`.
  - **`authenticated`**: `/users/**`, `/orders/**`,
    **`POST /inventory/reserve`**, **`POST /products/search/index`**,
    **`POST /products/enrich`**.
- **Nuevo `GET /api/v1/health`** público (D7): `200 {"status":"UP"}` con BD
  sana; **`503 {"status":"DOWN"}`** si el `SELECT 1` falla o la BD no responde.
- **Verificación de cierre**: el frontend **no llama** por HTTP a los 3
  endpoints que pasan a `authenticated()` (comprobado en la auditoría: el
  checkout reserva en proceso vía `OrderService`).
- **6.4(i) — decisión del usuario, documentada**: `GET /inventory/**` y
  `GET /pricing/**` **son públicos a propósito** — son la información que la
  propia vitrina publica sin sesión (stock y precio de la ficha y el carrito).
  Queda escrito en el `README` (sección de seguridad) para que el comprador
  lo tenga documentado, no descubierto.

### Criterios de aceptación

- [ ] `anyRequest().denyAll()` en `SecurityConfig`, con la lista completa comentada
- [ ] `GET /health` → `200 {"status":"UP"}` con BD sana
- [ ] `GET /health` con BD caída → `503 {"status":"DOWN"}` (probado con datasource inválido o mock)
- [ ] **Sin token**: `POST /inventory/reserve` → `401` · `POST /search/index` → `401` · `POST /products/enrich` → `401`
- [ ] **Con token**: los tres responden `200` (o su código de negocio)
- [ ] **Endpoint no listado** → `401/403` (nunca `permitAll` implícito)
- [ ] Swagger UI y `/v3/api-docs` siguen funcionando (permitAll explícito)
- [ ] El checkout E2E completo **sigue en verde** (reserva en proceso intacta)
- [ ] `GET /inventory/skus/{id}` y `GET /pricing/skus/{id}` siguen **públicos** (6.4(i))
- [ ] Test MockMvc de cada caso nuevo (401 sin token, 200 con token, deny por defecto)
- [ ] Nota **6.4(i)** escrita en `README.md`

---

## R6 — Documentación y estado

**Criterio**: la fase queda escrita como la ejecutaste.

- `CHANGELOG.md` actualizado (Keep a Changelog es-ES): 4 apartados.
- Bloque «ESTADO ACTUAL» de `AGENTS.md` redactado **dentro de la feature PR**,
  verdad después del merge, **sin PR de documentación de cierre** (hereda D11
  de la 3.3).
- `MEMORY.md`: la fase pasa a completada con sus 4 tareas; la deuda
  identificada que **no** entra (ver «Fuera de alcance» del plan) queda en la
  nota ya existente.
- **Sin ADR** (D8): el ADR-0006 queda reservado para la 7.1 (RBAC).

### Criterios de aceptación

- [ ] `CHANGELOG.md` con las 4 entradas
- [ ] Bloque de estado de `AGENTS.md` actualizado en la PR
- [ ] `MEMORY.md` marca la Fase 6 completada
- [ ] **Sin ADR nuevo** · **sin PR de documentación de cierre**
- [ ] `/spec-check tech-debt` → aprobado

---

## Fuera de alcance

Menú hamburguesa/rediseño de header (D1) · paginación del catálogo (D10 de la
3.1) · `npm audit` de producción (sin solución) · cobertura backend > 90 %
(tarea 10.3) · wishlist/reviews/cupones/notificaciones · Actuator (D7) ·
roles y permisos (Fase 7) · cerrar `GET /inventory` y `GET /pricing`
(decisión 6.4(i) **en contrario**).
