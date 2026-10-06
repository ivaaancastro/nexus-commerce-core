# Plan: Tarea 3.1 — Navegación por Familias y Filtros

> **Estado**: EN PLANIFICACIÓN
> **Fecha**: 2026-10-06
> **Rama**: `feat/catalog-family-filters`
> **Roadmap**: Fase 3 — Experiencia Editorial · `MEMORY.md:133`

---

## 1. Objetivo

Permitir **recorrer el catálogo por familia textil** (OUTERWEAR, KNITWEAR,
FOOTWEAR) **con filtros de talla, color y orden**, de forma que la vista sea
**compartible por URL** («atrás»/«adelante» y link enviado a un cliente
funcionan sin estado perdido).

Hoy el catálogo es un único listado plano: la home carga **todos** los
productos con `findAll()` y no hay forma de acotarlos salvo escribiendo en la
búsqueda semántica, que es otro concepto («buscar por significado», no
«navegar la taxonomía»).

---

## 2. Estado actual (hallazgos)

Todo verificado leyendo código, sin supuestos:

| # | Hallazgo | Evidencia |
|:--|:---|:---|
| H1 | **No existe entidad `Family`**: la familia es `String` libre | `entity/Product.java:36-37` · `V1__initial_schema.sql:17` `family VARCHAR(50) NOT NULL` |
| H2 | **Sin tabla, sin FK, sin índice** sobre `family` | Los índices de `V1:64-67` no la cubre ninguno |
| H3 | **`GET /api/v1/products` no acepta parámetros** | `ProductController.java:20-23` → `findAll()` sin `@RequestParam` ni `Pageable` |
| H4 | `ProductRepository` **no tiene ninguna consulta por familia** | `repository/ProductRepository.java:12-23` — sólo `findByReferenceCode`, `findWithSkusById`, `findAll` |
| H5 | **No hay página de listado**: 12 `page.tsx`, ninguno de catálogo | `frontend/src/app/` — sólo home y `products/[reference]` |
| H6 | **El Header no navega**: «Colección» y «Búsqueda Vectorial» son `<span>` sin `href` | `components/Header.tsx:30-35` |
| H7 | **Cero componentes de filtro** y **cero estado de filtros en URL** | `useSearchParams` sólo en `verify-email/page.tsx:5,13` |
| H8 | `family` y `maxPrice` en el semántico son **parámetros muertos**: se reciben y se descartan | `ProductSearchController.java:26-27` vs `ProductSearchService.java:43-47` (grep de `request.family()` → **0**) |
| H9 | `api.ts` no tiene ninguna función de filtrado | `getProducts()` sin argumentos (`api.ts:44-47`) |
| H10 | **Sólo hay 1 producto, en 1 sola familia** | `V1:80-81` — único `INSERT INTO products` de las 11 migraciones |
| H11 | Sin tests de listado ni filtrado | No existe `HomePage.test.tsx` ni `CatalogPage.test.tsx`; ningún test de filtro en backend |
| H12 | `ProductResponse` **no incluye precio** | `dto/ProductResponse.java:5-12` — precio vive en `market_prices` + mercado activo |

> `ProductController.java:15` ya se etiqueta `@Tag(description = "Gestión
> jerárquica de catálogo, familias y SKUs")`, pero **ese endpoint de familias
> no existe**: la documentación promete algo que el código no hace.

---

## 3. ¿Por qué ahora?

- Es la **única pieza de navegación** que le falta al catálogo: ya hay ficha
  de producto, carrito, búsqueda semántica y selector de mercado (3.2), pero
  **no hay recorrido entre productos**.
- Las familias ya existen como dato (`products.family`) desde V1 y la propia
  migración inicial las nombra (`-- 'OUTERWEAR', 'KNITWEAR', 'FOOTWEAR'`):
  la taxonomía está declarada pero **nadie puede recorrerla**.
- Es prerrequisito de la venta real: sin filtros, el catálogo sólo escala si
  se carga entero en el navegador.

---

## 4. Decisiones de diseño

> **D1–D4 y D7 se aprobaron explícitamente con el usuario el 2026-10-06.**
> **D5 y D4b son propuestas nuevas** que nacen de revisar el código y se
> someten a la aprobación de la spec.

| # | Decisión | Rationale |
|:--|:---|:---|
| **D1** | **Sembrar 3 productos más** con `V12` (1 en cada familia), cada uno con sus SKUs, **precios de los 4 mercados** y stock | Con 1 producto el menú tendría una sola entrada y los filtros serían indistinguibles de la home. V1 ya declara esas 3 familias. **`V12` sigue la lección de la 3.2**: `ON CONFLICT DO NOTHING` + `INSERT…SELECT` sobre `reference_code`/`barcode` (nunca ids fijos) para que sea idempotente y funcione desde una BD vacía |
| **D2** | **Filtrado en backend**: `GET /api/v1/products?family=&size=&color=&sort=` | URLs compartibles, testeable con MockMvc, no se carga el catálogo entero al cliente. Se apoya en consultas derivadas de `ProductRepository` |
| **D3** | **La taxonomía sigue siendo texto libre** — *no* se crea tabla `families`. Menú vía `SELECT DISTINCT family` + **índice nuevo sobre `products.family`** | No hay ni orden, ni slug, ni imagen, ni metadatos por familia que justifiquen una tabla y su FK. Una tabla sería estructura especulativa: si algún día llega (jerarquías, breadcrumbs, media), la migración es mecánica. El índice es lo único que hace falta para que `DISTINCT` y el `WHERE family=?` escalen |
| **D4** | **Filtros: familia + talla + color + orden** (`default`, `name-asc`, `name-desc`) | Aprobado. Ordena sobre campos de `products`/`skus`, sin cruzar precios |
| **D4b** | ⚠️ **Sin paginación** — *desviación respecto de lo aprobado en la pregunta de arquitectura*, que mencionaba `page=` | Dos motivos técnicos que sólo aparecen al escribir la spec: (a) el catálogo tendrá **5 productos** — paginar sería estructura especulativa; (b) **colisión de nombre**: `size` ya significa talla de SKU (`?size=M`) y el patrón de pedidos usa `size` como tamaño de página (`UserOrderController.java:33-34`), así que `?size=` sería ambiguo. Se anota como **fuera de alcance** con el disparador claro: *cuando el catálogo supere ~100 items* |
| **D5** | ⚠️ **El frontend se reorganiza en 3 rutas** (ampliación aprobada el 2026-10-06 tras ver la spec) | La home **deja de listar productos**. Queda: `/` **portada editorial** con las 3 familias como accesos grandes · `/catalog` **listado de sección** con filtros · `/search` **búsqueda semántica**, que se muda desde la home. El `Header` ya insinuaba los dos destinos con sus `<span>` sin `href` (`Header.tsx:30-35`): «Colección» → `/catalog`, «Búsqueda Vectorial» → `/search` |
| **D6** | **Sin filtro ni orden por precio** | Aprobado. `ProductResponse` no lleva precio y añadirlo obligaría a cruzar `market_prices` con el mercado activo de la 3.2 |
| **D7** | **Arreglar `family` en `/search/semantic`** (hoy se descarta) y **eliminar `maxPrice`** (param muerto, sin cliente que lo envíe) | Aprobado. Implementar `maxPrice` chocaría con D6 — estaría el precio dentro de la búsqueda pero fuera de los filtros. Un parámetro que se recibe y se ignora **peor en la documentación OpenAPI que ausente** |
| **D8** | Estado de filtros **en la URL** con `useSearchParams` dentro de `<Suspense>` | Exigencia del Next.js instalado: sin `<Suspense>` el build de producción falla con *Missing Suspense boundary with useSearchParams* (`next/dist/docs/.../use-search-params.md:181`). **El patrón ya existe y se replica**: `verify-email/page.tsx:104-108` — `"use client"`, componente interno con el hook, wrapper con `<Suspense fallback>` |
| **D9** | El menú de familias se pinta desde `GET /api/v1/products/families`, **no** se calcula en cliente | Coherente con D2: la taxonomía es dato del servidor, el cliente sólo la pinta y la usa como enlace |
| **D10** | **Scroll continuo, sin paginar jamás** — criterio de producto, no sólo técnico | Afirmado por el usuario: *«a mí no me gusta tener páginas, si no que todo el contenido sea hacia abajo, estilo webapp de Zara»*. Refuerza D4b y además **fija la regla para futuras tareas**: el catálogo nunca debe paginarse |
| **D11** | **Filtros en columna lateral izquierda** en escritorio → **panel desplegable desde un botón «Filtrar»** en móvil | Aprobado. Es el patrón de zara.com. Exige maquetación responsive: en móvil no hay columna, así que el mismo componente se renderiza dentro de un panel. Se aprovecha el patrón de cajón que ya tiene el proyecto (`CartDrawer`) |
| **D12** | **Migrar** la búsqueda semántica de la home a `/search` sin perder nada | La portada queda pura (sólo accesos). Se trasladan barra, resultados, skeleton y estado de error de `page.tsx` actual. **Riesgo**: romper lo que ya funciona — se cubre moviendo los tests antes de borrar nada de la home |

---

## 5. Alcance

### Dentro
- `V12` — 3 productos nuevos (1 por familia) + SKUs + precios de 4 mercados + stock + **índice sobre `family`**.
- `GET /api/v1/products/families` → familias con su número de productos.
- `GET /api/v1/products?family=&size=&color=&sort=` — parámetros opcionales y combinables, **sin paginación** (D4b, D10).
- `GET /api/v1/products/search/semantic?family=` → **aplica** el filtro; se retira `maxPrice`.
- **`/` portada editorial**: accesos grandes a las 3 familias. Los productos **dejan de listarse** aquí (D5).
- **`/catalog`**: listado de sección con **columna lateral de filtros** en escritorio y panel «Filtrar» en móvil (D11), scroll continuo.
- **`/search`**: la búsqueda semántica **migrada** desde la home (D12) — barra, resultados, skeleton y error.
- `Header.tsx` — «Colección» → `/catalog`, «Búsqueda Vectorial» → `/search` (dejan de ser `<span>`).
- `api.ts` — `getFamilies()` y `getProducts(filtros)`.
- `types/commerce.ts` — `FamilyResponse`, `ProductFilters`, `SortOption`.
- Tests backend (repository, service, controller, idempotencia de `V12`, filtro semántico) y frontend (portada, sección, sidebar, filtros, URL, búsqueda migrada, `Header`).

### Fuera de alcance
- **Paginación** (D4b, D10) — *regla de producto*: el catálogo nunca se pagina.
- **Filtro y orden por precio** (D6) — requiere `market_prices` + mercado activo.
- **Tabla `families` / jerarquías / breadcrumbs / imágenes por familia** (D3). Los accesos de la portada usan el color de fondo que ya da el estilo editorial, no imágenes externas.
- **Traducción o localización** de nombres de familia (sigue en `es-ES` sin i18n).
- **Reindexar el vector store** — la metadata `family` ya está en los documentos; sólo haría falta si se quisieran encontrar en la búsqueda los 3 productos nuevos.
- **Añadir ADR**: no cambia stack, modelo de datos ni patrones arquitectónicos.

> ✅ **§5 verificado al cerrar (2026-10-06): el alcance no cambió.** Todo lo de
> «Dentro» está implementado y nada de «Fuera de alcance» entró. Única variación
> de implementación, **sin efecto en el alcance**: `Map<String,Long>` no está
> soportado por Spring Data en `@Query`, así que el recuento por familia sale como
> `List<Object[]>` y se mapea en el service.

---

## 6. Riesgos

| Riesgo | Mitigación |
|:---|:---|
| **Migrar la búsqueda semántica de la home a `/search` rompa lo que ya funciona** (D12) | Se crea `/search` **antes** de tocar la home, se copia el lógica completa (barra, resultados, skeleton, error) y sólo entonces la portada se vacía. La home **no tiene tests hoy** — se escriben antes de borrar |
| `V12` se aplica mal en una BD ya poblada (fallo de la 3.2) | `ON CONFLICT` en las 3 tablas + `INSERT…SELECT` por clave natural (`reference_code`, `barcode`) **nunca por id** + test que corre la migración dos veces contra una **BD construida desde cero** |
| El `<select>`/enlaces de filtro añaden `combobox` y rompen tests existentes | Lección directa de la 3.2: `waitFor` por **nombre accesible**, no por rol. Se revisan `Header.test.tsx` y cualquier `getAllByRole` de la home |
| El `<Suspense>` de D8 se olvida y el build de producción rompe | `npm run build` en la verificación obligatoria + el patrón de `verify-email` como referencia |
| Filtrar por `size`/`color` rompe el N+1 al mapear SKUs | Mantener `@EntityGraph(attributePaths = {"skus"})` en las consultas nuevas, como el resto del repositorio |
| La columna lateral (D11) se maqueta sólo en escritorio y en móvil queda rota | El panel móvil es parte del **mismo** requisito R4, no un extra: se testea el botón «Filtrar» y su apertura |
| Con 5 productos los filtros parecen insuficientes para juzgar | Los seeds de D1 se diseñan **para que los filtros se vean**: colores distintos (Marino/Crudo/Negro/Camel) y tallas M/L repartidas para que cada filtro acorte la lista |

---

## 7. Estimación

| Bloque | Contenido |
|:---|:---|
| **Backend** | `V12` · `ProductRepository` (consultas por familia/talla/color + `DISTINCT`) · `CatalogService` · `ProductController` (+2 endpoints) · `ProductSearchService` (family activo, maxPrice fuera) |
| **Frontend — portada** | `/` reescrito como accesos editoriales a las 3 familias (deja de listar productos) |
| **Frontend — sección** | `/catalog` con columna lateral de filtros en escritorio, panel «Filtrar» en móvil, grid con scroll continuo y estado en URL |
| **Frontend — búsqueda** | `/search` con la semántica migrada desde la home (barra, resultados, skeleton, error) |
| **Frontend — base** | `api.ts` (+2 funciones) · tipos · `Header` enlazado |
| **Tests** | Backend: repository, service, controller (2 endpoints), idempotencia de `V12`, filtro del semántico. Frontend: portada, sección, sidebar, filtros, URL, `/search` migrada, regresión de `Header` |
| **Docs** | `CHANGELOG.md`, `README.md` (endpoints), `AGENTS.md` + `MEMORY.md`, casillas de `spec.md` |

**Aproximación**: 6 secciones de tasks. Es **más frontend que la 3.2** (3
rutas en vez de tocar 4), pero el backend es comparable. Cierre esperado por
encima de los 143/147 actuales.

---

## 8. Ciclo SDD

```
plan.md   → este fichero
spec.md   → requisitos, contratos, modelo de datos
APROBAR   → ⛔ bloqueo   (incluye D4b y D5, que son nuevas)
tasks.md  → checklist
CODE      → implementar
VERIFY    → /spec-check catalog-family-filters
CLOSE     → tests + docs + PR
```
