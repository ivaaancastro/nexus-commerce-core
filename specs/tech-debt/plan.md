# Plan — Fase 6: Deuda técnica (6.1–6.4)

> **Fase 6 · Deuda técnica (previa)** · documento de diseño (D1–D9).
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md`.
> Aprobada el 2026-10-09 con el objetivo de **no arrastrar deuda** a las fases 7–10.

---

## 1. Objetivo

Cuatro cabos sueltos identificados en el análisis del repositorio (2026-10-09),
todos ellos **verificados en código**, que conviene pagar **antes** de construir
el panel de administración y el material de venta encima:

| # | Deuda | Coste de posponerla |
|:--|:---|:---|
| **6.1** | El `nav` del `Header` desborda por debajo de ~560 px | El comprador abre la demo en su móvil y ve una página rota |
| **6.2** | `/search` devuelve **500** sin `OPENAI_API_KEY` | El comprador instala el proyecto sin clave y se encuentra un error en una pantalla de inicio |
| **6.3** | `lib/api.ts` al **20,77 %** de cobertura | Cada fase nueva toca ese fichero; subirlo tarde cuesta multiplicado |
| **6.4** | `SecurityConfig` con `anyRequest().permitAll()` y sin health check | Cimiento de seguridad y operabilidad que la Fase 8 (despliegue) necesita |

---

## 2. Estado real — auditoría previa (2026-10-09)

### 2.1 Header — desborde móvil

`frontend/src/components/Header.tsx:16` es una única fila `h-16 flex
items-center justify-between` con dos hijos:

- **Izquierda**: logo + tagline (tagline ya oculta bajo `sm`).
- **Derecha**: `space-x-6` con **8 elementos** — «Colección», «Búsqueda
  Vectorial», divisor, selector de mercado, «Pedidos», «Cuenta», «Cerrar
  sesión»/«Iniciar sesión» y la bolsa.

No hay `flex-wrap`, ni `min-width: 0`, ni ningún breakpoint en la fila derecha.
A 390 px la suma de anchos supera el viewport y el header desborda
horizontalmente. **Ya está documentado como preexistente** en `MEMORY.md`
(3.3, fuera de alcance entonces).

### 2.2 Búsqueda sin API key

```
backend/.../application.properties:24
spring.ai.openai.api-key=${OPENAI_API_KEY:mock-key}
```

- Sin la variable, la clave es el literal **`mock-key`**.
- `GET /api/v1/products/search/semantic` llama a `vectorStore.similaritySearch()`,
  que embebe la query contra OpenAI → **401 → excepción → 500** (visto en vivo
  en la 3.1 y anotado en `MEMORY.md`).
- El frontend **sí maneja el error** (`getFriendlyErrorMessage`), pero enseña
  «Error de conexión … asegúrate de que el backend está corriendo en 8080»,
  que es un **diagnóstico falso**: el backend está corriendo, lo que falta es
  la clave.
- También **`POST /products/search/index`** y **`POST /products/enrich`**
  fallan sin clave (embebidos / chat).

### 2.3 Cobertura de `api.ts`

- **20,77 %** (medido en la 4.1, el fichero más bajo del frontend).
- Es la **única puerta** a la API: `handleResponse()`, cabeceras de
  autorización, `Idempotency-Key`, tolerancia a 204.
- Ya existen tests que lo tocan de pasada (`ApiAuthHeaders.test.ts`,
  `Checkout.test.ts`), pero no un test que lo recorra.

### 2.4 Seguridad y operabilidad

`SecurityConfig` hoy:

| Regla | Estado |
|:---|:---|
| `/auth/**`, `/products/**`, `/pricing/**`, `/markets`, `/inventory/**` | `permitAll()` |
| `/users/**`, `/orders/**` | `authenticated()` |
| **`anyRequest().permitAll()`** | **cualquier endpoint no listado es público** |

Consecuencias concretas de esa lista:

- **`POST /api/v1/inventory/reserve` es público** — está dentro de
  `/inventory/**` y permite **reservar stock sin sesión** (agotar inventario a
  demanda). El frontend **no lo llama** (el checkout reserva en proceso, vía
  `OrderService`), así que cerrarlo no rompe nada.
- **`POST /api/v1/products/search/index`** y **`POST /api/v1/products/enrich`**
  son públicos — cualquiera puede provocar un trabajo de LLM/coste o una
  reindexación.
- **No existe health check**: el `globalSetup` de E2E usa
  `GET /api/v1/markets` como *readiness* porque no hay nada mejor.
- `GET /inventory/**` (consulta de stock) y `GET /pricing/**` son públicos:
  **es intencional** (la ficha y el carrito los usan sin sesión) — decisión
  **6.4(i)** del usuario, 2026-10-09: **se dejan públicos y se documenta**.

---

## 3. Decisiones de diseño

### D1 — 6.1: **flex-wrap + alturas flexibles**, sin menú hamburguesa

| Alternativa | Por qué no |
|:---|:---|
| Menú hamburguesa / drawer de navegación | Es un **componente nuevo** con estado, foco, `aria-expanded`, cierre con Escape y sus tests. Eso no es *deuda técnica*: es una feature disfrazada. |
| Ocultar enlaces en móvil | Empobrece la navegación: el usuario móvil pierde acceso a Colección y Búsqueda. |
| **`flex-wrap` + `min-h-16` + gaps responsivos** ✅ | Corrige la causa (fila que no puede envolver) sin JS nuevo, sin estados y sin romper nada existente. Mantiene todos los enlaces visibles. |

Regla heredada: **una corrección acotada** (4.3 D6) — arreglar el desborde, no
rediseñar el header.

**Verificación**: en navegador a **390 / 560 / 768 / 1440 px** sin scroll
horizontal, y **pasada por las 14 rutas** para cazar desbordes parecidos.
Cualquier desborde distinto que se encuentre se corrige en esta tarea si es de
la misma familia (fila que no envuelve); si exige rediseño, se documenta y se
saca.

### D2 — 6.1: el test de regresión es **de navegador, no de jsdom**

jsdom no calcula layout: un test con `scrollWidth > clientWidth` en jsdom no
mide nada real. La regresión se cubre con **Playwright** (la infra ya existe):
un test que fija viewport a 390 px y afirma que `document.documentElement.scrollWidth`
no supera el ancho de ventana. Si el stack necesario lo hace inviable, se
documenta y la verificación queda manual — **pero se intenta primero**.

### D3 — 6.2: **fallback de búsqueda en el backend**, no un mensaje más bonito

Tres opciones evaluadas:

| Opción | Por qué no / por qué sí |
|:---|:---|
| Sólo mejorar el copy del error en frontend | Sigue habiendo **500**: la pantalla de inicio del comprador enseña un fallo. No es deuda pagada. |
| **Fallback exacto en backend** ✅ | Sin clave válida, `ProductSearchService` resuelve con una **búsqueda por texto** (`ILIKE` sobre nombre/descripción/referencia) y devuelve `200` con resultados reales. La pantalla funciona **siempre**; con clave, la semántica es una mejora, no un requisito. |

- **Detección**: si `spring.ai.openai.api-key` está vacía o es `mock-key`, la
  búsqueda semántica **no se intenta** (cero llamadas a OpenAI, cero 500).
- **Belt-and-braces**: si la llamada a OpenAI **falla de todas formas** (clave
  inválida, red caída, cuota agotada), se captura la excepción y se cae al
  fallback con `log.warn` — **nunca un 500**.
- El índice (`POST /index`) y el enriquecimiento (`POST /enrich`) **no tienen
  fallback posible** (necesitan embeddings): responden `503` con un error
  estructurado claro (`SEMANTIC_SEARCH_UNAVAILABLE` / `ENRICHMENT_UNAVAILABLE`)
  en lugar de un 500 genérico. Ambos además pasan a `authenticated()` (D7).

### D4 — 6.2: la respuesta **declara el modo** en que se buscó

El frontend no puede decir «encontrados por proximidad vectorial» si hubo
fallback: sería mentir sobre el resultado (mismo principio que el comentario de
`search/page.tsx` sobre «0 artículos»).

- **`ProductSearchResultResponse` gana `searchMode`**: `"SEMANTIC"` | `"TEXT"`.
  Campo nuevo **aditivo** (los clientes viejos lo ignoran).
- `/search` ajusta el subtítulo según el modo y, en modo `TEXT`, muestra una
  nota discreta: *«Búsqueda por texto — configura `OPENAI_API_KEY` para la
  búsqueda semántica»*.

### D5 — 6.3: **umbral por fichero medido y congelado**, como en la 4.1

- Se escriben tests de `api.ts` con `fetch` mockeado (patrón ya usado en el
  proyecto) hasta alcanzar un valor **medido**.
- Se congela un **`thresholds` de fichero** en `vitest.config.ts`
  (`thresholds["src/lib/api.ts"]`) por debajo de lo medido, con holgura — igual
  que los globales 77/76/74/79.
- **Los umbrales globales no se tocan**: subir tests de `api.ts` subirá la
  cobertura global de paso, pero el contrato sigue siendo «no baja».
- **Comprobación negativa**: fijar el umbral del fichero a 100 y verificar que
  `npm run test:coverage` sale con ≠0 (la 4.1 ya demostró que los gates del
  proyecto se prueban en ambas direcciones).

### D6 — 6.4: **lista explícita y cierre por defecto** en `SecurityConfig`

- Se sustituye `anyRequest().permitAll()` por **`anyRequest().denyAll()`** con
  la lista completa escrita. Cualquier endpoint futuro **no listado no funciona**
  hasta que alguien decida explícitamente — lo contrario es un agujero que se
  abre solo.
- **Nuevo**: `GET /api/v1/health` público → `200 {"status":"UP"}` con una
  comprobación de BD (`SELECT 1` vía repository o `JdbcTemplate`). Es el health
  check que la Fase 8 (despliegue) y el `globalSetup` de E2E necesitan.
- **Pasan a `authenticated()`**: `POST /inventory/reserve`,
  `POST /products/search/index`, `POST /products/enrich`. Verificado: el
  frontend **no llama** a ninguno de los tres por HTTP.
- **Siguen públicos y documentados** (decisión del usuario **6.4(i)**):
  `GET /inventory/**`, `GET /pricing/**` — la ficha y el carrito los leen sin
  sesión.
- `GET /products/search/semantic` **sigue público**: es la vitrina.

> **Nota de alcance**: los endpoints de SpringDoc (`/v3/api-docs/**`,
> `/swagger-ui/**`) y `/error` necesitan `permitAll()` explícito con
> `denyAll()` por defecto — detalle de implementación, no una concesión.

### D7 — 6.4: **sin dependencia de Actuator**

Actuator añade un árbol de dependencias nuevo y Superficies (`/actuator/**`)
que habría que asegurar. Para «¿está vivo y responde la BD?» basta un
controlador propio de 30 líneas. Si la Fase 8 necesita métricas, se valorá
entíonces con su spec.

### D8 — **ADR no** para esta fase

Ninguna de las 4 tareas cambia stack ni estructura: el `SecurityConfig` ya
existía, el health check es un controlador más y las búsquedas siguen en el
mismo servicio. **El ADR-0006 queda reservado para la 7.1 (RBAC)**, que sí
cambia el modelo de autorización del sistema. Mismo criterio que 3.x y 4.x.

### D9 — **Una rama, una PR para la fase**

A diferencia de fases anteriores (una PR por tarea), estas 4 tareas son
**pequeñas y afines** — un solo branch `fix/tech-debt` y una PR con 4 commits
o apartados. Menos fricción de revisión y el `spec-check` se ejecuta una vez.

> Si durante la implementación alguna tarea se revela grande de verdad (p. ej.
> la pasada de 390 px encuentra desbordes en muchas rutas), se separa en su
> propia PR con aprobación del usuario (**regla 3**: el alcance cambia en la
> spec, no en la conversación).

---

## 4. Fuera de alcance

- ❌ **Menú hamburguesa / rediseño del header** (D1: fuera de deuda).
- ❌ **Paginación del catálogo** — es la decisión D10 de la 3.1 (regla de
  producto), no deuda.
- ❌ **Vulnerabilidades `npm audit` de producción** — preexistentes de la cadena
  Next/Tailwind, sin solución disponible (verificado en la 4.3).
- ❌ **Cobertura backend > 90 %** — ya es la tarea 10.3.
- ❌ **Wishlist, reviews, cupones, notificaciones** — features, no deuda.
- ❌ **Actuator** (D7) · **Roles/permisos** — Fase 7 · **Cerrar
  `GET /inventory` y `GET /pricing`** — decisión 6.4(i) **en contrario**.

---

## 5. Estimación

| Tarea | Bloques | Peso |
|:---|:---|:---:|
| **6.1** Header responsive | fix de fila + pasada de 14 rutas en 390 px + test Playwright | **bajo** |
| **6.2** Fallback de búsqueda | detección de clave + fallback `ILIKE` + `searchMode` + `503` en index/enrich + copia en `/search` | **medio-alto** |
| **6.3** Cobertura `api.ts` | tests de `api.ts` + umbral por fichero + comprobación negativa | **medio** |
| **6.4** Seguridad y health | `denyAll` + lista completa + `/health` + 3 endpoints a `authenticated()` + documentación | **medio** |

**Baselines que deben seguir verdes** (los de la 4.3, más los que esta fase
añade): `./mvnw test` → 165+ · `tsc --noEmit` → 0 · ESLint → 0/0 ·
`vitest run` → 270+ · `test:coverage` → `77/76/74/79` y el nuevo umbral de
`api.ts` · `build` → 0 · E2E → en verde · **`git diff` de `backend/` sólo
esperado en 6.2 y 6.4**.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| `denyAll()` por defecto rompe un endpoint no listado (swagger, error, un controller olvidado) | inventario completo de controllers **antes** de cambiar la regla (apartado 2.4) + tests MockMvc de cada verbo + `contextLoads` |
| El fallback `ILIKE` cambia respuestas de `/search/semantic` y rompe tests existentes de la 3.1 | el contrato de respuesta **sólo se añade** (`searchMode`); los tests existentes se ajustan sin cambiar aserciones de resultado (regla R8 heredada) |
| La pasada de 390 px encuentra desbordes en muchas rutas y 6.1 se desborda | D9: si exige rediseño, se saca con nota en la spec (regla 3) |
| Los tests de `api.ts` mockean `fetch` de forma frágil | patrón ya usado en el proyecto (`ApiAuthHeaders.test.ts`); si un camino no es testeable sin romper abstracciones, se documenta y el umbral se fija sobre lo medido |
| El health check consulta BD y cuelga si la BD está caída | timeout corto + `503` con `{"status":"DOWN"}`; es exactamente lo que un orquestador necesita ver |
