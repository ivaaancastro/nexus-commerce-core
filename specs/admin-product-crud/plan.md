# Plan — Tarea 7.2: CRUD de productos, SKUs, variantes e imágenes

> **Fase 7 · Panel de administración** · documento de diseño (D1–D10).
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md`.

---

## 1. Objetivo

La 7.1 instaló la puerta (`/api/v1/admin/**` con `hasRole("ADMIN")`) pero detrás
no hay nada: el panel no puede gestionar **el catálogo**, que hoy sólo se puede
tocar con migraciones Flyway (semillas V1/V12). Un producto nuevo exige hoy
escribir SQL, regenerar el manifiesto de imágenes y reindexar a mano.

**Resultado esperado**: un `ADMIN` puede crear, editar y borrar productos y sus
SKUs desde `/admin/products` en el navegador; la vitrina pública sigue leyendo
las mismas tablas sin un solo cambio en sus endpoints; un `USER` sigue recibiendo
`403` en la API.

---

## 2. Estado real — auditoría previa del repositorio (2026-10-14)

Hecha sobre el código de `main` (tras merge de la 7.1) antes de escribir la spec.

### 2.1 El catálogo no tiene escritura

| Señal | Hallazgo |
|:---|:---|
| `ProductController`, `ProductSearchController`, `ProductEnrichmentController` | **Sólo lectura** (GET + index/enrich). Ni `save(` ni `delete(` de productos en todo `src/main`. |
| `SkuRepository` | `JpaRepository<Sku, Long>` **vacío**, sin consultas propias. |
| Única vía de escritura del catálogo | **Migraciones Flyway** (V1 siembra 2 productos + 2 SKUs; V12 añade 3 + 4 con `ON CONFLICT`). |
| `ProductEnrichmentService` | Llama al LLM y **devuelve** la respuesta; no persiste nada. |

### 2.2 Modelo existente (no hay que inventar nada)

| Entidad | Campos | Notas |
|:---|:---|:---|
| `Product` | `reference_code` (UNIQUE, `NNNN/NNN`), `name` (≤100), `description` (nullable), `family` (VARCHAR 50, **columna libre**: `OUTERWEAR`/`KNITWEAR`/`FOOTWEAR`) | `@OneToMany(cascade=ALL, orphanRemoval=true)` → `skus`. **Sin flag `active`, sin imágenes.** |
| `Sku` | `barcode` (UNIQUE), `color` (≤30), `size` (≤10), FK `product_id ON DELETE CASCADE` | «Variant» == SKU: no existe entidad de variantes. |
| Familias | **No hay tabla**: se calculan con `GROUP BY p.family` en `ProductRepository.contarProductosPorFamilia()`. | Crear una familia = crear un producto con esa familia. |

### 2.3 Imágenes: la BD no sabe que existen (decisión de la 3.3)

- Estáticas en `frontend/public/products/` con manifiesto
  `src/data/product-images.json` generado por `npm run images`
  (`scripts/generate-product-images.mjs`, que **autodescubre referencias con
  regex sobre las migraciones** `'NNNN/NNN'`).
- `ProductImage` ya **cae a placeholder** si la referencia no está en el
  manifiesto o la imagen falla → cero 404 por diseño.

### 2.4 Integración

| FK hacia productos/SKUs | ON DELETE | Consecuencia de un DELETE |
|:---|:---|:---|
| `skus.product_id → products` | CASCADE | Borrar producto borra sus SKUs. |
| `market_prices.sku_id → skus` | CASCADE | Precios del SKU mueren con él. |
| `stock_items.sku_id → skus` | CASCADE | Stock del SKU muere con él. |
| **`order_items.sku_id → skus`** | **NO ACTION** | **DELETE de un SKU vendido → violación FK** (500 si no se guarda). |

### 2.5 Seguridad ya instalada (7.1, ADR-0006)

`SecurityConfig` termina en `denyAll()` y ya contiene
`.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` **antes** del final:
todo lo que se publique bajo esa ruta hereda la protección **sin tocar
SecurityConfig**. Un `POST /api/v1/products/**` hoy caería en `denyAll`.

### 2.6 Frontera con la 7.3 (stock y precios)

Un SKU creado hoy **no tiene `market_prices` ni `stock_items`**. La ficha
pública ya lo tolera: sin precio responde `404` de pricing y el PDP muestra
«precio no disponible» (`priceUnavailable`, verificado en
`products/[reference]/page.tsx` L87, L181). El catálogo lista el producto
igual. No se compra hasta que la 7.3 asigne precio y stock.

---

## 3. Decisiones de diseño

### D1 — El CRUD vive bajo `/api/v1/admin/products/**` y **hereda la regla 7.1**

| Alternativa | Por qué no |
|:---|:---|
| `POST/PUT/DELETE /api/v1/products/**` con matchers por método | Exige nuevos matchers **antes** del `permitAll` de `GET /api/v1/products/**` y del `denyAll`; más superficie de error por orden, y mezcla la vitrina con la gestión. |
| **`/api/v1/admin/products`** ✅ | Hereda `hasRole("ADMIN")` **con cero cambios en `SecurityConfig`** — la 7.1 ya instaló la regla exacta. La vitrina (`GET /api/v1/products/**`) no se toca. |

Endpoints: `GET/POST /admin/products`, `GET/PUT/DELETE /admin/products/{id}`,
y SKUs anidados `POST /admin/products/{id}/skus`,
`PUT/DELETE /admin/products/{id}/skus/{skuId}`.

### D2 — «Variantes» == SKUs; **no se crea entidad nueva**

La hoja de ruta dice «productos, SKUs, variantes»: en el modelo un SKU **es**
la variante física (barcode + color + tamaño). Crear una entidad «Variant»
sería duplicar `skus` con otro nombre. La spec lo declara explícitamente para
que no haya duda de alcance.

### D3 — **Referencia y barcode inmutables**; el resto, editable

`referenceCode` es la clave natural del sistema: las migraciones hacen
`ON CONFLICT (reference_code)`, el manifiesto de imágenes **indexa por ella**
(`0432/021` → `0432-021-*.webp`) y los E2E la usan. Cambiarla desde un formulario
rompería el manifiesto y la semántica de idempotencia. Igual para `barcode`.
La spec lo impone: el PUT de producto acepta `name`, `family`, `description`;
el PUT de SKU acepta `color`, `size`. El formulario las muestra deshabilitadas.

### D4 — Borrado **duro con guarda 409**; sin soft-delete

| Alternativa | Por qué no |
|:---|:---|
| Columna `active` + filtrar en todas las lecturas | Invasivo: toca `ProductRepository`, catálogo, búsqueda, E2E y sus aserciones para un problema que hoy no existe. Un producto borrable sólo existe el día que haya pedido. |
| **DELETE condicional** ✅ | Si ningún `order_items` referencia a sus SKUs → `DELETE` real (cascadas limpias: SKUs, precios, stock). Si está vendido → **`409 Conflict`** con mensaje claro. Además, `DataIntegrityViolationException` (carrera) → mismo 409: nunca un 500 por FK. |

### D5 — Imágenes: **siguen estáticas**; el panel sólo previsualiza (hereda 3.3 D1/D4)

Subir imágenes desde el panel exigiría endpoint de subida, storage y rompería
la decisión ya mergeada de la 3.3 («imágenes estáticas, el backend no se
toca»). Decisión: el panel muestra la galería del manifiesto **en modo sólo
lectura** y documenta el flujo real — **soltar ficheros en
`public/products/` + `npm run images`**. Un producto creado desde el panel
aparece en la vitrina con el **placeholder editorial** hasta que se añadan
imágenes: cero 404, cero mentira (mismo espíritu que D6 de la 7.1).

### D6 — El índice vectorial **no se toca**: reindex manual documentado

Escribir en el catálogo deja la búsqueda semántica desactualizada, pero
reindexar exige `OPENAI_API_KEY` (503 sin ella) y la búsqueda TEXT ya lee la
BD en vivo (fallback `ILIKE` de la 6.2). Decisión: **sin auto-reindex** en la
escritura; el flujo documentado es «editar → `POST /products/search/index` si
hay clave». El bug pre-existente de duplicados (`indexAllProducts` no borra
documentos previos) queda **documentado, fuera de alcance** aquí — anotado para
una tarea futura, no arreglado en la 7.2.

### D7 — Reutiliza `ProductResponse`/`SkuResponse` y las excepciones existentes

Las lecturas devuelven **los mismos DTOs** que la vitrina (sin entities, sin
formas duplicadas). Errores: `404` con el `ResourceNotFoundException` ya
existente, `400` con `IllegalArgumentException`/validación de DTO, y **una sola
excepción de dominio nueva** `CatalogConflictException` → `409` (patrón de
`InsufficientStockException`): borrado bloqueado y unicidad violada.

### D8 — Validación `jakarta.validation` en DTO + **espejo en cliente**

- `referenceCode`: `^\d{4}/\d{3}$` (el mismo formato del manifiesto y las semillas)
- `name`: ≤100, no vacío · `family`: `^[A-Z][A-Z0-9_]{1,49}$` (las 3 existentes encajan)
- `barcode`: `^\d{8,20}$`, único · `color`: ≤30 · `size`: ≤10
- `description`: opcional, ≤2000

El cliente valida igual **antes** de llamar y traduce con
`getFriendlyErrorMessage()`. Un `family` mal escrito aparecería calculado en el
menú de familias de la vitrina (se calcula con GROUP BY): la validación en
mayúsculas mitiga ese riesgo.

### D9 — Sin precios ni stock automáticos: **la 7.3 es la dueña**

Crear un SKU **no** genera `market_prices` ni `stock_items`. La vitrina lo
tolera ya (§2.6). La spec lo declara como frontera explícita: el producto es
visible y navegable, pero ese SKU no es comprable hasta la 7.3.

### D10 — Sin ADR; estado en la PR; sin PR de documentación de cierre

No cambia arquitectura ni stack: mismas capas, mismos DTOs record, misma regla
de seguridad de ADR-0006. Hereda además la **D11 de la 3.3**: bloque «ESTADO
ACTUAL» de `AGENTS.md` redactado dentro de la feature PR, verdad tras el merge,
sin números de PR ni SHA.

---

## 4. Fuera de alcance

- ❌ **Precios y stock** de los SKUs nuevos — 7.3 (gestión multimercado).
- ❌ **Subida de imágenes** desde el panel — hereda 3.3 D1/D4 (D5).
- ❌ **Auto-reindex** del índice vectorial al escribir — D6; bug de duplicados documentado.
- ❌ **Soft-delete / flag `active`** — D4; el día que haya pedidos editables, 7.4.
- ❌ **Gestión de pedidos y devoluciones** — 7.4.
- ❌ **Gestión de usuarios** — 7.5.
- ❌ **Dashboard con métricas** — 7.6.
- ❌ **Paginación del listado** — el catálogo nunca pagina (3.1 D10); el panel hereda el criterio.
- ❌ **Reordenar/crear familias como entidad** — siguen calculadas (§2.2).

---

## 5. Estimación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | DTOs de escritura (`ProductCreate/UpdateRequest`, `SkuCreate/UpdateRequest`) + validación + `CatalogConflictException` | bajo |
| **B** | `AdminProductController` (8 endpoints) + `AdminProductService` con guardas de unicidad y borrado | medio-alto |
| **C** | Tests backend: controller MockMvc + service + 3 caminos de seguridad + **sin ensuciar la BD compartida** | medio |
| **D** | Frontend: `types` admin + 8 funciones en `api.ts` (con auth; `api.ts` mantiene ≥99) | bajo |
| **E** | Frontend: `app/admin/layout.tsx` (AdminRoute compartido), `/admin/products` (listado), `/new`, `/[id]/edit` + SKUs, dashboard navegable | medio-alto |
| **F** | Tests frontend: páginas, formulario, SKUs, api | medio |
| **G** | CHANGELOG + README (flujo de imágenes + reindex) + estado en la PR + `/spec-check` | bajo |

**Baselines que deben seguir verdes** (medidos tras la 7.1): `./mvnw test` →
**204+** · `tsc --noEmit` → 0 · ESLint → 0/0 · `npm run test:coverage` →
**306+** y EXIT 0 (umbrales congelados: globales 77/76/74/79 + `api.ts` ≥ 99) ·
`npm run build` → 0 · E2E local (Chromium+WebKit) → en verde · `/spec-check` →
aprobado.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| **Tests que ensucian la BD compartida**: los `@SpringBootTest` corren sobre el PostgreSQL real de dev/E2E; un producto de test rompería `CatalogSeedTest` («catálogo = 4 referencias») | Los tests de escritura corren con **rollback** (`@Transactional`) o limpieza explícita en `@AfterEach` — regla escrita en la spec |
| DELETE de SKU vendido → violación FK = 500 | Guarda previa (`order_items` por SKU del producto) + captura de `DataIntegrityViolationException` → `409` |
| Cascada del borrado elimina precios y stock del producto | Semántica correcta para un producto **sin pedidos**; documentado en D4 |
| Producto creado sin imágenes → ¿404 en la vitrina? | Ya resuelto en 3.3: placeholder editorial (`ProductImage`); documentado en D5 |
| `family` mal escrita aparece en el menú de la vitrina | Validación `^[A-Z][A-Z0-9_]{1,49}$` en ambos lados (D8) |
| Búsqueda semántica desactualizada tras escribir | D6: reindex manual documentado; TEXT fallback lee BD viva |
| El dashboard `/admin` cambia de contenido → aserciones del test 7.1 | **Cambio declarado** en la spec (R6): se actualiza `AdminPage.test` a propósito, con justificación |
