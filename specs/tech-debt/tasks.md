# Tasks — Fase 6: Deuda técnica (6.1–6.4)

> **Fase 6 · Deuda técnica (previa)** · checklist de trabajo.
> Plan en `plan.md` (D1–D9) · requisitos en `spec.md` (R1–R6).
> **Regla**: marcar cada tarea al completarla y preguntar antes de cualquier commit/PR.

---

## Preparación

- [x] Rama `fix/tech-debt` (renombrada desde `feat/admin-roles`, sin commits encima)
- [x] Baselines medidos antes de tocar nada (2026-10-09): **165 backend** (0 fallos) · **270 frontend** · `tsc` **0** · ESLint **0/0** · `vitest run` 270 ✓ · `test:coverage` y `build` → medir al cierre
- [x] `specs/admin-roles/` queda **sin trackear** en esta rama (pertenecen a la Fase 7; si se trackean, se excluyen del commit)

---

## 6.1 — Header responsive (R1)

- [x] **R1.1** Auditoría de desbordes: las 14 rutas a **390 px** en navegador, anotando en este fichero qué rutas desbordan y de qué tipo
- [x] **R1.2** Fix en `Header.tsx`: `flex-wrap` + `min-h-16` (no `h-16` fijo) + gaps responsivos — **sin hamburguesa, sin JS nuevo** (D1)
- [x] **R1.3** Corregir desbordes de la **misma familia** encontrados en R1.1; los de otra familia → anotar y sacar (regla 3) — **sin casos**: el único culpable era el Header
- [x] **R1.4** Test Playwright de regresión: viewport 390 px → sin scroll horizontal (D2) — `e2e/responsive.spec.ts`, 6 pruebas × navegador
- [x] **R1.5** Verificación visual en 390 / 560 / 768 / 1440 px: sin cambios respecto a `main` en 768/1440 — *ver detalle abajo (768 con matiz)*
- [x] **R1.6** Unit tests de `Header` si el fix afecta a clases testables; `vitest` completo en verde — `Header.test.tsx` aserciona roles/texto, **no clases de layout** → sin cambios; 270/270 ✓

**Resultado de R1.1 (2026-10-09, Chrome con emulación `390x844x3,mobile`):**
**14/14 rutas desbordan**, y con **una única causa**: la fila derecha del `Header`
(`DIV.flex items-center space-x-6 … right=688` frente a `visualViewport=390`;
Chrome ensancha la maqueta a **690 px** → zoom-out forzoso y el nav cortado).
- **Culpar único**: `Header.tsx:33` (nav derecha). Ningún contenido de página
  desborda por su cuenta (comprobado excluyendo `position:fixed`).
- **Métrica**: `document.documentElement.scrollWidth > window.visualViewport.width`
  — `innerWidth` **no sirve**: con contenido desbordado Chrome expande la
  maqueta y `innerWidth` crece hasta contentar el contenido (`560→690`),
  dando `overflow:false` falso.
- Con sesión el nav crece (Pedidos/Cuenta/Cerrar sesión) → **690 px**; sin
  sesión 560 px. Ambos > 390.
- **Consecuencia**: el fix del Header (R1.2) resuelve las 14 rutas; no hay
  desbordes de otra familia → R1.3 queda sin trabajo pendiente salvo
  verificación.

**Resultado de R1.4 (comprobación negativa — un gate no probado no protege):**
- Con fix: **12/12 verdes** (Chromium + WebKit; Firefox vía CI, D10 de la 4.2).
- Fix retirado (`git stash`): **6/6 en rojo**, p. ej.
  `/ desborda horizontalmente: scrollWidth=558 > 390`.
- Fix restaurado idéntico (`diff` contra copia): verde otra vez.

**Resultado de R1.5 (mediciones `main` vs fix):**
| Ancho | `main` | fix |
|:--|:--|:--|
| 390 (con sesión) | desborda (maqueta 690 px, nav cortado) | **sin desborde**, header 129 px |
| 390 (sin sesión) | desborda (560 px) | **sin desborde**, header 104 px · 5 rutas ✓ |
| 560 | desborda (690 px) | **sin desborde** |
| 768 | `docScrollW=755 > 753` (**también desborda**), nav pegado al borde, logo/tagline partidos en 3 líneas, scrollbar horizontal visible | sin desborde, header en 2 filas (80 px) |
| 1440 | header 64 px, logo 104→494, nav 665→1336 | **idéntico byte a byte** (mismas medidas) |
- **Matiz 768 (honestidad)**: la CA decía «apariencia no cambia en 768/1440».
  A 1440 se cumple exacto. A 768 **era imposible**: `main` ya desbordaba (2 px)
  con el texto del logo y del tagline **partidos en varias líneas** y el
  scrollbar horizontal a la vista (captura en la sesión). El fix lo deja en
  2 filas limpias con los mismos elementos (sin rediseño, sin hamburger).
  Anotado aquí según la regla 3.
- **Análisis de consecuencias (sticky)**: el header crece en móvil
  (64 → 104/129 px), lo que *podría* meter elementos `sticky top-24` (96 px)
  debajo. Verificado: `/catalog` es `hidden lg:block` y la ficha es
  `md:sticky` (sólo ≥768 px, donde header = 64–80 px < 96) → **no se afectan**.
  El resumen del carrito es `sticky top-24` en todos los viewports, pero en
  móvil su contenedor `lg:col-span-1` tiene **exactamente su altura** → el
  sticky no tiene recorrido (medido: `stickyTop` = posición estática, nunca
  se pega). **Sin regresión.**

---

## 6.2 — Búsqueda sin `OPENAI_API_KEY` (R2)

- [x] **R2.1** Inyectar la propiedad `spring.ai.openai.api-key` en `ProductSearchService` y añadir `isSemanticAvailable()` (vacía o `mock-key` → no disponible) — regla compartida en `config/OpenAiKey`
- [x] **R2.2** Fallback `ILIKE`: nuevo `@Query` en `ProductRepository` (nombre/descripción/referencia, con `family` opcional y `limit`)
- [x] **R2.3** `searchSimilar()`: si no hay clave → fallback directo; si la hay → `try/catch` sobre `similaritySearch` con `log.warn` → fallback (belt-and-braces, D3)
- [x] **R2.4** `POST /search/index` y `POST /products/enrich` sin clave → **503** con `code` (`SEMANTIC_SEARCH_UNAVAILABLE` / `ENRICHMENT_UNAVAILABLE`) vía `GlobalExceptionHandler` — verificado: handler traduce 503 con body estructurado
- [x] **R2.5** Tests nuevos `ProductSearchService`: detección · fallback con resultados reales · belt-and-braces (vectorStore lanza excepción) · `family` · `limit` · cero interacción con `vectorStore` cuando no hay clave (+ clave en blanco · clave no inyectada · clave real intacta · `indexAllProducts` sin clave)
- [x] **R2.6** Test de los dos 503 (service lanza con `code` + controller mapea a HTTP 503, en los 2 controllers)
- [x] **R2.7** Regresión: los tests existentes de la 3.1 (semántica con `filterExpression`) **sin cambiar sus aserciones** — **suite 180/180 en verde, tests 3.1 intactos**

## 6.3 — `searchMode` declarado (R3)

- [x] **R3.1** `ProductSearchResultResponse` + `searchMode` (`"SEMANTIC"` | `"TEXT"`) — valor en ambos caminos (`toSearchResult` / `toTextSearchResult`)
- [x] **R3.2** Frontend: tipo `SemanticSearchResult` + `searchMode` (y `similarityScore` pasa a **opcional**, que es la verdad desde la 6.2)
- [x] **R3.3** `/search`: subtítulo según modo + nota «configura `OPENAI_API_KEY`» sólo en `TEXT`
- [x] **R3.4** Tests: backend (los dos modos) + componente de `/search` (las dos ramas de subtítulo)

---

## 6.3b — Cobertura de `api.ts` (R4)

- [x] **R4.1** Medir cobertura actual de `api.ts` (número aquí): **20,77 stmts / 33,33 branch / 17,24 funcs / 21,91 lines** (2026-10-09, coincide con la medida del plan)
- [x] **R4.2** Fichero de tests `src/__tests__/Api.test.ts` con `fetch` mockeado: `handleResponse` (éxito, 204/vacío, error HTTP), `Authorization`, `Idempotency-Key`, refresh, métodos GET/POST representativos — **25 tests**
- [x] **R4.3** Medir cobertura tras los tests (número aquí): **100 / 100 / 100 / 100** (77 stmts · 27 branches · 29 funcs · 73 líneas)
- [x] **R4.4** `thresholds["src/lib/api.ts"]` en `vitest.config.ts` por debajo de lo medido, con holgura (D5); **globales 77/76/74/79 intactos** — congelado en **99** (un punto por debajo de la medida, mismo criterio que los globales)
- [x] **R4.5** Comprobación negativa: umbral del fichero a 100 → `npm run test:coverage` **≠ 0**; revertido → **0**. Anotar resultado — *ver nota R4.5-a*
- [x] **R4.6** Ningún test preexistente cambia su aserción (R8) — `ApiAuthHeaders.test.ts` intacto

### Nota R4.5-a — desviación en el mecanismo de la comprobación negativa (regla 3)

La CA decía «umbral a **100** → ≠ 0», escrita asumiendo una medida por debajo
de 100. La medida real salió **exactamente 100**, y la semántica de umbral es
`>=`, así que **umbral 100 + cobertura 100 = pasa (EXIT 0)**: la CA literal es
inalcanzable por construcción. Resultados anotados con honestidad:

1. **Literal (umbral 100)**: corrida completa → **EXIT 0** (no demuestra nada).
2. **Adaptada (la que vale)**: umbral congelado **99** + corrida **sin
   `Api.test.ts`** → `api.ts` cae al 20,77 % y el gate falla con **EXIT 1**
   (4 líneas `ERROR: ... does not meet "src/lib/api.ts" threshold (99%)`).
3. **Restaurado**: corrida normal → **EXIT 0** (297/297).

Es la misma demostración en ambas direcciones que pedía D5 — «los gates del
proyecto se prueban en ambas direcciones» — cambiando el eje de la variación
(cobertura) en vez del umbral, porque con medida 100 el eje umbral no puede
fallar. El mecanismo queda así **más** fuerte: probaron que el umbral muerde
cuando desaparecen los tests.

### Nota R4.2 — «refresh de token» no está en `api.ts`

La R4 lo listaba como método representativo, pero **no existe un
`refresh()` en `api.ts`**: el refresh token sólo se guarda/borra en
`AuthContext` (login/logout) y la sesión se refresca re-pidiendo `/auth/me`
(`getCurrentUser`), que sí está cubierto en el fichero nuevo. El flujo de
`AuthContext` lo cubre su propio test preexistente (R8 intacto).

---

## 6.4 — Seguridad y health check (R5)

- [x] **R5.1** Inventario completo de endpoints: lista de controllers + verbo + path (anotada aquí como tabla) — base de la lista nueva
- [x] **R5.2** `HealthController` (`GET /api/v1/health`): `200 {"status":"UP"}` con BD sana · `503 {"status":"DOWN"}` con `SELECT 1` fallido (D7, sin Actuator)
- [x] **R5.3** `SecurityConfig`: `anyRequest().denyAll()` + lista completa (orden: SpringDoc y `/error` permitAll, los 3 POST authenticated antes de los GET públicos)
- [x] **R5.4** Tests MockMvc: `401` sin token en los 3 POST · `200` con token · endpoint no listado → `401/403` · Swagger accesible · `GET /inventory` y `GET /pricing` **públicos** (6.4(i))
- [x] **R5.5** Test de `/health` UP y DOWN
- [x] **R5.6** Verificación en vivo: checkout completo E2E en local (la reserva sigue en proceso) + Swagger UI abre + `/search` pública responde
- [x] **R5.7** Nota **6.4(i)** en `README.md` (sección seguridad): stock/precio públicos a propósito

### Resultado de la 6.4 (2026-10-09)

- **QA backend**: `./mvnw test` → **191/191** (+10: `SecurityRulesTest` 8 +
  `HealthControllerTest` 2). **Ninguna prueba preexistente cambió** (R8): los
  3 `@SpringBootTest` con MockMvc sólo hacían GET públicos.
- **`HealthController` + `HealthService`**: sonda `SELECT 1` explícita sobre
  el `DataSource` (D7, sin Actuator); la `SQLException` se traga y responde
  `503 DOWN` — rama DOWN probada con `DataSource` mockeado (la «BD inválida o
  mock» que pide la spec).
- **Token en tests**: no existe `spring-security-test`, así que el test
  «con token» **mintea un JWT con el `JwtService` real** de la app — el
  filtro sólo valida firma y claims (no carga el usuario de BD), así que
  autentica igual que en producción. Los POST de búsqueda corren con
  `spring.ai.openai.api-key=mock-key` (patrón 6.2): **503 de negocio sin red
  hacia OpenAI**, determinista en CI.
- **Verificación en vivo** (curl + navegador, backend reiniciado con devtools):
  `/health` → `200 UP` · los 3 POST **sin token → 401** · **con token →
  400/503/503** (validación de negocio, nunca 401) · `GET /api/v1/payments`
  (no listado) → **401** · `GET /inventory/skus/1` y `/pricing/skus/1` →
  **200** (6.4(i)) · `/v3/api-docs` → **200**, `/swagger-ui/index.html` →
  **200** (`/swagger-ui.html` → 302 a la raíz) · `/products/search/semantic`
  → **200 pública**.
- **Checkout E2E con sesión**: login `e2e@nexus.dev` → `POST /orders/checkout`
  con `Idempotency-Key` → orden `ORD-A1F60DA4` **CONFIRMED** (reserva en
  proceso intacta) → **segunda petición con la MISMA clave devuelve la misma
  orden sin duplicar** → visible en `GET /users/me/orders`.
- **Navegador**: `/search` pública sigue operativa bajo `denyAll` (2 tarjetas
  + nota `OPENAI_API_KEY` del modo TEXT).
- **README**: nueva sección «Seguridad y Modelo de Autorización» con la regla
  `denyAll`, la nota **6.4(i)** y el health check; los 3 POST que exigen
  sesión se marcaron con 🔒 y sus respuestas `503` documentadas. Contrato de
  `searchMode` añadido al endpoint de búsqueda (6.3).

### Inventario de endpoints (R5.1) — base de la lista de `SecurityConfig`

| Controller | Verbo + path | Regla nueva | Motivo |
|:---|:---|:---|:---|
| Auth | `POST /auth/register` · `verify-email` · `resend-verification` · `login` · `forgot-password` · `reset-password` · `refresh` | **permitAll** | registro/login sin token |
| Auth | `GET /auth/me` | **permitAll** (filtro JWT activo si llega cabecera) | ya era `permitAll` bajo `/auth/**`; comportamiento sin cambios |
| Health | `GET /api/v1/health` | **permitAll** (nuevo) | público por definición (D7) |
| Market | `GET /markets` | **permitAll** | vitrina |
| Product | `GET /products` · `GET /products/families` · `GET /products/search` · `GET /products/search/semantic` | **permitAll** (sólo GET) | catálogo público |
| ProductSearch | **`POST /products/search/index`** | **authenticated** | **cambia estado** (reindexa) |
| ProductEnrichment | **`POST /products/enrich`** | **authenticated** | **cambia estado** (escribe en BD) |
| Inventory | `GET /inventory/skus/{id}` | **permitAll** (sólo GET) | 6.4(i): la ficha publica stock sin sesión |
| Inventory | **`POST /inventory/reserve`** | **authenticated** | **cambia estado** (reserva atómica) |
| Pricing | `GET /pricing/skus/{id}` | **permitAll** | 6.4(i): el carrito publica precio sin sesión |
| Order | `POST /orders/checkout` · `GET /orders/{orderNumber}` | **authenticated** | decisión previa: checkout requiere sesión |
| User | `GET/PUT /users/me` · direcciones CRUD · `POST /users/me/size-recommendation` · `GET/POST /users/me/orders/**` · returns | **authenticated** | zona privada |
| — | cualquier path no listado | **denyAll** (antes `permitAll` implícito) | D6: lo que no está listado, no funciona |
| SpringDoc | `/v3/api-docs/**` · `/swagger-ui/**` · `/swagger-ui.html` · `/error` | **permitAll** | docs y manejo de errores |

> Verificación de cierre de la R5: **el frontend no llama por HTTP** a
> `/search/index`, `/enrich` ni `/inventory/reserve` (grep en `src/` → 0
> coincidencias); la reserva del checkout ocurre en proceso vía `OrderService`.

---

## Cierre

- [x] **Baselines finales**: `./mvnw test` → **191/191** · `tsc` **0** · ESLint **0/0** · `vitest` **297/297** · `test:coverage` **EXIT 0** (globales 77/76/74/79 + `api.ts` ≥ 99) · `npm run build` **0** · E2E en verde (stack levantado)
- [x] `npx playwright test` local con la R1.4 incluida (Chromium+WebKit) → **36 pasados / 14 omitidos / 0 fallos**. *(Firefox: los 11 fallos de la corrida con los 3 proyectos son el **D10 conocido** — `browserType.launch: Failed to launch ... Could not find profile folder` en headless, aislado otra vez con el comando directo; falla el **lanzamiento**, no ninguna aserción. Convención: local = Chromium + WebKit, Firefox en CI.)*
- [x] `CHANGELOG.md` — 4 entradas (R6): 6.4 y 6.2 en *Added*, 6.3+6.3b en *Changed*, 6.1 en *Fixed*
- [x] `MEMORY.md` — Fase 6 completada con sus 4 tareas (R6) · tabla de estado actualizada (191/297)
- [x] Bloque «ESTADO ACTUAL» de `AGENTS.md` redactado **dentro de la PR** (R6, hereda D11)
- [x] **Sin ADR** (D8) · **sin PR de documentación de cierre**
- [x] `/spec-check tech-debt` → aprobado *(reporte R1–R6 ejecutado en la sesión: 30 CA verificados con evidencia, 0 pendientes)*
- [ ] **Preguntar al usuario antes de cualquier commit y PR** ⛔

---

## Notas de implementación

_(hallazgos, desviaciones y bugs encontrados — se actualiza en curso)_

### 6.1 (2026-10-09) — completada

- **QA de la 6.1 en verde**: `vitest` **270/270** · `tsc` **0** ·
  `npm run lint` **0/0** · `npm run build` **0** · E2E completo local
  **36 pasados / 14 omitidos** (a11y sólo Chromium, D5 de la 4.3) / **0 fallos**.
- **Hallazgo — `eslint.config.mjs` no ignoraba `coverage/`**: un
  `npm run lint` local tras `test:coverage` informaba 2 warnings de ficheros
  **generados y gitignored** (CI no los ve). Añadida la línea
  `coverage/**` a `globalIgnores` — cambio de 1 línea, cero riesgo, para que
  el gate documentado sea 0/0 también en local. Anotado como desviación
  menor bajo la regla 3.
- **Fix aplicado**: `Header.tsx` — contenedor `h-16` → `min-h-16 py-1
  flex-wrap gap-x-6 gap-y-2`; nav y grupo de sesión `space-x-*` → `gap-*`
  (los `space-x` de Tailwind aplican margen izquierdo incluso al primer
  elemento de una fila envuelta, lo que desalinearía el wrap).
- **Verificado en navegador (no sólo en tests)**: capturas a 390 y 768
  antes/después; mediciones a 320/390/545/560/640/768/1440 — **0 desbordes**
  en todas con fix.

### 6.2 (2026-10-09) — completada

- **Baseline en vivo (antes del fix)**: `GET /search/semantic` sin clave →
  **HTTP 500** (`401 Incorrect API key: mock-key`). **Después: 200** con
  resultados reales del catálogo.
- **Verificado en vivo con el stack corriendo** (curl contra `localhost:8080`):
  `GET /semantic?query=blazer` → **200** + sin `similarityScore` en el JSON ·
  `family=KNITWEAR` → sólo el jersey · `limit=1` → sólo el primero · familia
  desconocida → **200 `[]`** · `BLAZER` en mayúsculas → 1 ·
  `POST /search/index` → **503 `SEMANTIC_SEARCH_UNAVAILABLE`** ·
  `POST /products/enrich` → **503 `ENRICHMENT_UNAVAILABLE`**.
- **QA backend**: `./mvnw test` → **180/180** (165 preexistentes intactos +
  15 nuevos). `./mvnw compile` → 0.
- **Decisión (regla 3)**: el campo `similarityScore` del DTO lleva
  `@JsonInclude(NON_NULL)` — en modo texto no hay similitud y serializar
  `null` haría pintar un «Match 0 %» falso en `ProductCard`. Efecto colateral
  intencionado y verificado: ninguna respuesta semántica tenía campos nulos,
  así que el camino normal no cambia.
- **Decisión (regla 3)**: `OpenAiKey.isUsable(null)` devuelve `true` — sólo
  ocurre fuera de Spring (tests unitarios sin contexto, donde `@Value` no
  resuelve); en contenedor la propiedad siempre lleva valor por defecto.
  Sin esto, los tests preexistentes de la 3.1 se desviarían al fallback (R8).
- **Nota para la 6.4**: los dos POST pasan a `authenticated()`, así que desde
  entonces el 503 sólo se verá **con token**; sin token mandará el 401. La
  comprobación en vivo de los 503 se hizo **antes** de ese cambio (y queda
  cubierta por tests unitarios + de mapeo HTTP que no dependen de la auth).
- **Test de integración** `ProductSearchFallbackTest` con
  `@SpringBootTest(properties = "spring.ai.openai.api-key=mock-key")`: el
  empujón de propiedad hace el test **determinista en CI** (donde sí existe
  `SPRING_AI_OPENAI_API_KEY`), evitando llamadas reales a OpenAI.

### 6.3 (2026-10-09) — completada

- **QA backend**: `./mvnw test` → **181/181** (el nuevo
  `respuestaSemanticaDeclaraSuModo` prueba la serialización `SEMANTIC` por
  HTTP; `ProductSearchFallbackTest` la de `TEXT` contra BD real).
- **QA frontend**: `tsc` **0** · `npx eslint src scripts e2e` **0/0** ·
  `vitest` **272/272** (+2 tests de las dos ramas de subtítulo).
- **Verificado en vivo** (curl + navegador): el JSON del fallback trae
  `"searchMode": "TEXT"` y **sin** `similarityScore`; en `/search`, «lana»
  pinta subtítulo **«2 artículos encontrados»** (ya sin «por proximidad
  vectorial») **+ la nota de `OPENAI_API_KEY`**. Captura en
  `search-text-mode.png`.
- **Decisión (regla 3)**: `similarityScore` pasa a **opcional** en el tipo
  `SemanticSearchResult` — desde la 6.2 el backend no lo envía en modo texto,
  y el tipo debe reflejar el contrato real. El único consumidor
  (`ProductCard`) ya guardaba con `!== undefined`, así que **cero cambios de
  comportamiento**.
- **Decisión (regla 3)**: con **0 resultados** el modo no viaja (no hay
  resultado que lo porte), así que el subtítulo es neutro («N artículos
  encontrados») y la nota **no** se muestra — sólo se afirma lo que se sabe.
- **Fixture del test preexistente** `shouldReturnSemanticSearchResults`:
  sólo se le añade el literal `"SEMANTIC"` al constructor (obligatorio por el
  nuevo componente del record); **sus aserciones no cambian** (R8).
