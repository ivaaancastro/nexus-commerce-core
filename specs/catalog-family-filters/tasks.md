# Tasks — Tarea 3.1: Navegación por Familias y Filtros

> **Spec**: `specs/catalog-family-filters/spec.md` ✅ aprobada 2026-10-06 *(v2 — 10 requisitos)*
> **Estado**: ⏳ **PENDIENTE**
> **Plan**: `specs/catalog-family-filters/plan.md`
> **Rama**: `feat/catalog-family-filters`

---

## 0. Setup

- [x] `git checkout main && git pull`
- [x] `git checkout -b feat/catalog-family-filters`
- [x] Verificar baseline verde: `cd backend && ./mvnw test` · `cd frontend && npx vitest run`
- [x] `specs/catalog-family-filters/{plan,spec}.md` escritos y **aprobados por el usuario**

---

## 1. Backend — migración `V12` (R8)

- [x] `V12__catalog_navigation_seed.sql` — 3 productos nuevos (`0611/018`, `0815/004`, `1240/007`)
- [x] `INSERT … SELECT` resolviendo por `products.reference_code` → `skus` (**nunca ids fijos**)
- [x] `skus` — 4 filas nuevas: `ON CONFLICT (barcode) DO NOTHING`
- [x] `market_prices` — 16 filas (4 SKU × 4 mercados) → `ON CONFLICT (sku_id, market_id) DO NOTHING`
- [x] `stock_items` — 8 filas (4 SKU × 2 almacenes) → `ON CONFLICT (sku_id, warehouse_id) DO NOTHING`
- [x] `CREATE INDEX IF NOT EXISTS idx_products_family ON products (family)`
- [x] Header comentado con los valores de la spec §2 (precios por mercado)
- [x] Confirmar `spring.jpa.hibernate.ddl-auto=validate` en verde (sin cambio de esquema)
- [x] Verificar que `V12` aparece en `flyway_schema_history` con `success=t`

> **Lección de la 3.2**: los `ON CONFLICT` usan **claves naturales**, jamás ids.
> Un comentario anticipa que el entorno local puede tener filas residuales que
> las migraciones no crean — por eso el test de §9 corre contra una BD vacía.

## 2. Backend — endpoint de familias (R1)

- [x] `dto/FamilyResponse.java` — record inmutable `(String family, int productCount)`
- [x] `ProductRepository` — `SELECT p.family, COUNT(p) ... GROUP BY p.family` + orden alfabético aplicado en `listarFamilias()` *(no en SQL: Spring Data no admite `Map` como retorno de `@Query` multilínea y el orden en Java garantiza el mismo resultado)*
- [x] `CatalogService.listarFamilias()` — devuelve `List<FamilyResponse>`
- [x] `ProductController` — `GET /api/v1/products/families` con `@Operation`
- [x] Cuenta **productos** (no SKUs) — `COUNT(p.id)`, no `COUNT(s)`
- [x] Público: comprobar que el `permitAll` de `/api/v1/products/**` ya lo cubre sin tocar `SecurityConfig`
- [x] Ningún `Product` o entidad expuesta al exterior — sólo el record

## 3. Backend — filtros de catálogo (R2)

- [x] `ProductRepository` — `@Query` con filtros **opcionales** (`family`, `size`, `color`) unidos con `AND`
- [x] **Semántica SKU estricta**: `EXISTS (SELECT 1 FROM Sku s WHERE s.product = p [AND s.size = :size] [AND s.color = :color])`
- [x] `@EntityGraph(attributePaths = {"skus"})` conservado → **sin N+1**
- [x] Orden: `default` (inserción) · `name-asc` · `name-desc`
- [x] `CatalogService.listarProductos(family, size, color, sort)` — `@Transactional(readOnly = true)`
- [x] Validación de `sort`: enum propio, valor desconocido → **`400`** vía `GlobalExceptionHandler`
- [x] `family`/`size`/`color` desconocidos → **`200 []`** (datos, no errores)
- [x] `ProductController` — `@GetMapping` con los 4 `@RequestParam(required = false)`
- [x] **Sin parámetros ⇒ `findAll()` de siempre** — no-regresión de `GET /api/v1/products`

## 4. Backend — la búsqueda semántica filtra por familia (R9)

- [x] `ProductSearchService` — si `family` viene, `.filterExpression("family == '<valor>'")` en el `SearchRequest`
- [x] **Validar `family` contra las familias existentes antes de construir la expresión** (nunca concatenar el query param crudo)
- [x] `family` desconocido o con `'` → `200 []`, sin llegar a consultar
- [x] **Eliminar `maxPrice`** de `ProductSearchRequest` y de la firma del controller
- [x] `@Operation` del controller actualizado (ya no documenta `maxPrice`)

## 5. Frontend — tipos y API client

- [x] `types/commerce.ts` — `interface FamilyResponse { family: string; productCount: number }`
- [x] `types/commerce.ts` — `interface ProductFilters { family?; size?; color?; sort? }`
- [x] `types/commerce.ts` — `type SortOption = "default" | "name-asc" | "name-desc"`
- [x] `lib/api.ts` — `getFamilies(): Promise<FamilyResponse[]>`
- [x] `lib/api.ts` — `getProducts(f?: ProductFilters): Promise<Product[]>` con `URLSearchParams`, omitiendo los vacíos

## 6. Frontend — `/search` **ANTES** de tocar la home (R6)

> **Orden obligatorio (mitigación del riesgo de §6 del plan)**: la ruta nueva
> se crea y se testea **antes** de vaciar la portada. Nunca se borra código
> funcionando sin tener su sustituto en verde.

- [x] `app/search/page.tsx` — barra semántica, grid de resultados, `ProductCardSkeleton` y estado de error
- [x] Copiar la lógica desde `app/page.tsx` **sin reescribirla** (mismo comportamiento que antes)
- [x] Verificar `npx tsc --noEmit` con las dos rutas conviviendo
- [x] Test `SearchPage.test.tsx` — pinta barra, resultados y skeleton

## 7. Frontend — portada `/` (R3)

- [x] `app/page.tsx` — reescrito: accesos editoriales a las familias de `getFamilies()`
- [x] Cada acceso → `<Link href={"/catalog?family=" + code}>` con nombre y `productCount`
- [x] Estilo editorial: `uppercase`, `tracking-widest`, paleta `neutral-*`, bloques anchos (**no** fila de chips)
- [x] Skeleton mientras carga · `getFriendlyErrorMessage()` si falla
- [x] **Eliminar** el grid de productos, la barra de búsqueda y el estado de resultados de la home
- [x] Test `HomePage.test.tsx` — pinta los accesos como enlaces y **no** lista productos

## 8. Frontend — sección `/catalog` con columna lateral (R4, R5)

- [x] `components/CatalogFilters.tsx` — familia (lista con conteo), talla, color, orden
- [x] **Escritorio**: columna fija a la izquierda, grid de `ProductCard` en el resto
- [x] **Móvil** (`< lg`): botón **«Filtrar»** + panel con el **mismo** componente
- [x] Scroll continuo: **sin** «cargar más», sin paginación, sin fin de listado (D10)
- [x] Cambiar un filtro ⇒ llamada al backend con el parámetro (**no** filtro en cliente)
- [x] Valores de talla/color derivados de la respuesta del catálogo
- [x] Filtros activos marcados visualmente + acción «limpiar filtros»
- [x] `app/catalog/page.tsx` — `useSearchParams` **dentro de `<Suspense>`** (patrón `verify-email:104-108`)
- [x] Omitir de la URL los parámetros por defecto (URL limpia)
- [x] Recarga y «atrás» conservan/restauran el estado
- [x] Test `CatalogPage.test.tsx` — columna lateral, apertura del panel móvil, llamada al cambiar filtro, estado en URL

## 9. Frontend — Header (R7)

- [x] `Header.tsx:30-35` — «Colección» `<span>` → `<Link href="/catalog">`
- [x] `Header.tsx` — «Búsqueda Vectorial» `<span>` → `<Link href="/search">`
- [x] Conservar `aria-label` y estilos editoriales
- [x] Test `Header.test.tsx` — ambos `href` correctos

## 10. Tests

### Backend
- [x] `ProductControllerTest` — `GET /families` devuelve las 3 familias ordenadas con su conteo
- [x] `ProductControllerTest` — `GET /families` accesible **sin** sesión
- [x] `ProductControllerTest` — `?family=` devuelve sólo esa familia
- [x] `ProductControllerTest` — **caso trampa**: `?size=M&color=Negro` exige **ambos en el mismo SKU**
- [x] `ProductControllerTest` — dos parámetros combinados (AND)
- [x] `ProductControllerTest` — sin parámetros ⇒ idéntico a `findAll()` (no-regresión)
- [x] `ProductControllerTest` — `?sort=` desconocido → `400` · `?family=` desconocido → `200 []`
- [x] `CatalogSeedTest` — `V12` corre **dos veces** sin duplicar filas
- [x] `CatalogSeedTest` — contra una **BD construida desde cero**: 4 productos, matriz de precios completa (lección 3.2)
- [x] `ProductSearchServiceTest` — `family` se envía al `filterExpression`
- [x] `ProductSearchServiceTest` — `family` con `'` no se concatena sin validar → sin consulta

### Frontend
- [x] `HomePage.test.tsx` — accesos de la portada (R3) y **ausencia** de la barra de búsqueda
- [x] `CatalogPage.test.tsx` — columna lateral con familia/talla/color/orden (R4)
- [x] `CatalogPage.test.tsx` — botón «Filtrar» y apertura del panel en móvil (R4)
- [x] `CatalogPage.test.tsx` — cambiar filtro dispara `getProducts` con ese parámetro (R4)
- [x] `CatalogPage.test.tsx` — estado en URL y `Suspense` (R5)
- [x] `CatalogPage.test.tsx` — estado vacío con «limpiar filtros» (R10)
- [x] `SearchPage.test.tsx` — barra, resultados y skeleton (R6)
- [x] `Header.test.tsx` — `href` de «Colección» y «Búsqueda Vectorial» (R7)

## 11. Verificación

- [x] `cd backend && ./mvnw test` en verde — **165/165** (baseline 143)
- [x] `cd frontend && npx vitest run` en verde — **171/171** (baseline 147)
- [x] `npx tsc --noEmit` sin errores
- [x] `npx eslint src` → **3 errores**, todos preexistentes de `main` (0 nuevos).
      El de `page.tsx:22` desapareció al reescribir la portada, así que el recuento
      baja de 4 a 3: ninguna de las páginas nuevas añade hallazgos
- [x] `npm run build` OK — comprueba el `<Suspense>` de R5 en build de producción
      (`/`, `/catalog` y `/search` prerenderizan como estáticas)
- [x] `grep -rn "maxPrice" backend/src frontend/src` → **0 resultados** (R9)
- [x] `grep -rn "cargar más\|loadMore\|page=" frontend/src` → sin controles de
      paginación (D10). La única coincidencia es `page=` de `getMyOrders`, el
      paginado de **pedidos**, que no forma parte de esta tarea
- [x] `/spec-check catalog-family-filters` → **10/10 requisitos · 26/26 criterios**
- [x] **Prueba manual** en el navegador (0 mensajes de consola):

  > **Dos bugs encontrados y corregidos en esta prueba** (cada uno con su test):
  > el mensaje amigable ya terminaba en punto y se concatenaba con la pista
  > técnica — se leía «*minutos**..** Asegúrate*» —, y el contador de la sección
  > mostraba «1 prendas» con un único resultado.

  | Ruta | Qué comprobar | Resultado |
  |:---|:---|:---|
  | `/` | 3 accesos a familias con conteo; **sin** grid de productos; **sin** barra de búsqueda | ✅ 1/1/2 prendas, `cards: 0` |
  | `/catalog` | columna lateral con familia/talla/color/orden; los 4 productos | ✅ los 4 bloques presentes |
  | `/catalog?family=OUTERWEAR` | quedan 2 · `?size=M` → 3 · `?color=Camel` → 1 | ✅ 2 · 3 · 1 (H1 pasa a la familia) |
  | `/catalog?family=NOEXISTE` | estado vacío + «limpiar filtros» | ✅ «Sin resultados» + 2 accesos a limpiar |
  | URL compartible | recarga y «atrás» conservan los filtros | ✅ atrás → `?family=OUTERWEAR`, recarga conserva |
  | viewport móvil | botón «Filtrar» abre el panel | ✅ a 390px la columna desaparece y el panel abre con el mismo componente |
  | `/search` | búsqueda semántica sigue funcionando como antes | ✅ barra, `LIMPIAR`, estado de error y contador correctos |
  | Header | «Colección» → `/catalog`, «Búsqueda Vectorial» → `/search` | ✅ ambos `href` |
  | `POST /orders/checkout` | el checkout sigue en verde (regresión de la 3.2) | ✅ **201** → `ORD-6DB9E249` |

  > **Nota sobre `/search`**: en local no se pueden pintar resultados porque
  > `OPENAI_API_KEY` no está exportada y `application.properties` cae al fallback
  > `mock-key` (línea preexistente en `main`). El endpoint devuelve `500` antes de
  > llegar al filtro, así que se verifica el **estado de error** de R10 en navegador
  > y el filtro de familia en su test unitario. `family` desconocido y `family` con
  > comilla sí se comprueban en vivo: ambos devuelven `200 []` sin tocar OpenAI.

## 12. Documentación

- [x] `CHANGELOG.md` — entrada bajo *Añadido*
- [x] `README.md` — 2 endpoints nuevos y `maxPrice` retirado del semántico
- [x] `AGENTS.md` + `MEMORY.md` — estado actualizado (rama, tests, decisiones 3.1)
- [x] `specs/catalog-family-filters/plan.md` — §5 Alcance marcado si cambia algo
- [x] `specs/catalog-family-filters/spec.md` §4 — **26/26 casillas marcadas** (10/10 requisitos)
- [x] **No** hace falta ADR (D8): no cambia stack ni arquitectura
