# Spec: Tarea 3.1 — Navegación por Familias y Filtros

> **Estado**: ✅ **APROBADA e IMPLEMENTADA** *(v2 — ampliación de alcance aprobada el 2026-10-06; 26/26 criterios verificados)*
> **Fecha**: 2026-10-06
> **Rama**: `feat/catalog-family-filters`
> **Plan**: `specs/catalog-family-filters/plan.md`

> **Delta de la v1**: la home pasa de *fuera de alcance* a **portada
> editorial**; la búsqueda semántica se muda a `/search`; los filtros pasan a
> **columna lateral** con panel móvil; se confirma **sin paginación nunca** (D10).

---

## 1. Requisitos

### R1 — Menú de familias desde el servidor

**Criterio**: existe un endpoint que devuelve la taxonomía real, calculada en
BD, con el número de productos de cada familia.

- `GET /api/v1/products/families` → `200` con `[{ family, productCount }]`.
- Ordenado por `family` ascendentemente.
- **Público** (ya cubierto por el `permitAll` de `/api/v1/products/**`).
- Cuenta **productos**, no SKUs: familia con 2 productos → `productCount: 2`.
- El menú y la portada se pintan **exclusivamente** de esta respuesta (D9) —
  no se calcula con `Set` ni con `reduce` sobre la lista de productos.

### R2 — Filtros de catálogo en backend

**Criterio**: `GET /api/v1/products` acepta filtros opcionales y combinables.

| Parámetro | Tipo | Valores | Efecto |
|:---|:---|:---|:---|
| `family` | texto | cualquier familia | igualdad exacta con `products.family` |
| `size` | texto | talla de SKU | `products.skus.size` |
| `color` | texto | color de SKU | `products.skus.color` |
| `sort` | enum | `default` \| `name-asc` \| `name-desc` | orden de respuesta; `default` por defecto |

- Todos opcionales; **sin parámetros ⇒ comportamiento idéntico al actual**
  (regresión cero sobre `GET /api/v1/products`).
- Se combinan con **AND**: `family=OUTERWEAR&size=M` ⇒ OUTERWEAR **y** M.
- **Semántica SKU**: `size` y `color` se evalúan **sobre el mismo SKU** — un
  producto pasa si existe **al menos un SKU que cumpla todos** los criterios
  SKU a la vez. Con `size=M&color=Negro` no aparece un producto cuyo único
  SKU con `size=M` sea `Marino` aunque tenga otro SKU en `Negro` talla L.
  (Si fuera «algún SKU por criterio» se enseñaría producto que no se puede
  comprar con la selección hecha.)
- **Respuesta**: `List<ProductResponse>` — **sin paginación**. No es sólo una
  decisión técnica: es **regla de producto** (D10, D4b) — *el catálogo nunca
  se pagina*.
- **Sin N+1**: las consultas nuevas conservan
  `@EntityGraph(attributePaths = {"skus"})`, como el resto del repositorio.

### R3 — Portada `/` con accesos a secciones

**Criterio**: al entrar a la app se ve un menú editorial de secciones, no un
listado de productos.

- La ruta `/` **deja de listar productos** — se retira el grid y el estado de
  resultados de catálogo de `page.tsx` actual.
- Muestra los accesos de las familias devueltas por **R1**, cada uno como
  `<Link href="/catalog?family={code}">` con nombre y `productCount`.
- Estilo editorial: mayúsculas, `tracking-widest`, paleta `neutral-*` y
  bloques que ocupan ancho (acceso grande, no fila de chips).
- Mientras carga → skeletons; si falla → mensaje con `getFriendlyErrorMessage()`.
- **No** contiene la barra de búsqueda semántica (se mudó a `/search`, R6).

### R4 — Sección `/catalog` con columna lateral de filtros

**Criterio**: la vista de sección tiene filtros en columna izquierda en
escritorio y panel en móvil, con scroll continuo.

- **Escritorio**: columna fija a la izquierda con **familia** (lista con su
  conteo), **talla**, **color** y **orden**. El resto del ancho es el grid de
  `ProductCard`.
- **Mismo componente** de filtros, renderizado dentro de un panel desplegable
  desde un botón **«Filtrar»** cuando no hay espacio para la columna
  (`< lg` por ejemplo). El panel móvil es parte de este requisito, no un
  extra: se testea su apertura.
- **Scroll continuo**: se pintan todos los productos devueltos. **No** hay
  «cargar más», paginación ni fin de listado (D10).
- Al cambiar cualquier filtro se vuelve a llamar al backend con el parámetro
  nuevo — **no** se filtra en cliente el resultado de `getProducts()` vacío.
- Los valores posibles de talla y color se derivan de la respuesta del
  catálogo (no hay endpoint de facetas; **no se añade uno**).
- Los filtros activos se reflejan visualmente (selección marcada) y pueden
  limpiarse de una vez.

### R5 — Estado de filtros en la URL

**Criterio**: el estado vive en el query string y es compartible.

- Formato: `/catalog?family=OUTERWEAR&size=M&color=Marino&sort=name-asc`.
- Parámetros **omitidos** cuando toman su valor por defecto (URL limpia).
- Recargar la página **conserva** los filtros.
- «Atrás»/«adelante» del navegador restauran el estado anterior.
- Implementado con `useSearchParams` de `next/navigation` **envuelto en
  `<Suspense>`** — exigencia del Next.js instalado (D8): sin el boundary el
  build de producción falla con *Missing Suspense boundary with useSearchParams*.
  Se replica el patrón de `verify-email/page.tsx:104-108`.
- ⚠️ La prop `searchParams` de `page` es **`Promise`** en esta versión de
  Next.js (`page.md:72-77`); se usa el hook, que no tiene ese cambio.

### R6 — Búsqueda semántica en `/search`

**Criterio**: la búsqueda semántica se muda desde la home a su propia ruta
sin perder ninguna funcionalidad.

- Nueva ruta `/search` con **todo** lo que hoy hace la home: `SemanticSearchBar`,
  grid de resultados (`ProductCard` con `semanticItem`), `ProductCardSkeleton`
  mientras carga y estado de error.
- Sigue llamando a `GET /api/v1/products/search/semantic`.
- **Se traslada, no se reescribe**: mismo comportamiento de antes de la mudanza.
- Tras la mudanza, `/` **ya no** contiene barra de búsqueda ni resultados.
- El enlace «Búsqueda Vectorial» del `Header` apunta aquí (R7).

### R7 — El Header navega

**Criterio**: los dos destinos que el Header ya anuncia dejan de ser `<span>`.

- «Colección» → `<Link href="/catalog">`.
- «Búsqueda Vectorial» → `<Link href="/search">`.
- Se conservan `aria-label`, estilos editoriales y el resto de la cabecera.

### R8 — Semilla V12 e índice

**Criterio**: hay catálogo suficiente para que los filtros se vean, y la
migración es segura desde una BD vacía **y** desde una ya poblada.

- `V12__catalog_navigation_seed.sql` añade **3 productos** (1 por familia):
  `OUTERWEAR`, `KNITWEAR` y `FOOTWEAR` — las 3 familias que `V1:17` ya declara.
- Cada producto con sus SKUs, **precios para los 4 mercados** y stock en los
  2 almacenes (lección de la 3.2: la matriz de precios ha de estar completa
  desde migraciones, no desde filas residuales).
- **Diseño de datos pensado para que los filtros afloren diferencias**:

  | Producto | Familia | SKUs | Color | Tallas |
  |:---|:---|:---|:---|:---|
  | `0432/021` Blazer Cruzada Estructura *(existe)* | OUTERWEAR | 2 | Marino | M, L |
  | `0611/018` Abrigo Lana Oversize | OUTERWEAR | 1 | Camel | M |
  | `0815/004` Jersey Punto Lana | KNITWEAR | 1 | Crudo | L |
  | `1240/007` Zapatilla Piel Minimal | FOOTWEAR | 2 | Negro | M, L |

  Con esto: familia `OUTERWEAR`→2 de 4 · `size=M`→3 de 4 · `size=L`→3 de 4 ·
  `color=Camel`→1 de 4. Los tres filtros **acortan** la lista de forma observable.
- **Idempotente y sin ids fijos**: `INSERT … SELECT` resolviendo por
  `products.reference_code` y `skus.barcode` (nunca `sku_id = 3`), con
  `ON CONFLICT DO NOTHING` sobre las claves naturales que ya existen:
  - `products` → `reference_code` (`V1:14`)
  - `skus` → `barcode` (`V1:25`)
  - `market_prices` → `uk_sku_market` (`V1:40`)
  - `stock_items` → `uk_sku_warehouse` (`V1:60`)
- **Índice nuevo**: `CREATE INDEX idx_products_family ON products (family);`
  para que `DISTINCT family` y `WHERE family = ?` no escaneen la tabla.

### R9 — La búsqueda semántica filtra por familia

**Criterio**: el parámetro `family` de `/search/semantic` deja de ser muerto.

- `GET /api/v1/products/search/semantic?query={q}&family={f}&limit={n}` aplica
  el filtro con `SearchRequest.Builder.filterExpression(String)` — verificado
  contra el jar instalado: `spring-ai-pgvector-store-1.0.0-M6.jar` contiene
  `PgVectorFilterExpressionConverter` y `SearchRequest$Builder` expone
  `filterExpression(String)`.
- Expresión de filtro: `family == '<valor>'` sobre la metadata que
  `ProductSearchService.java:72` ya guarda en cada documento.
- **El valor de `family` se valida contra las familias existentes antes de
  construir la expresión** — nunca se concatena un query param crudo dentro de
  la expresión (protección frente a comillas rotas / inyección de expresión).
- **`maxPrice` se retira** de la firma: param muerto (`ProductSearchService`
  lo descarta) y fuera de alcance por D6.
- No reindexa nada: la metadata `family` ya está en los documentos.

### R10 — Estados de la UI

**Criterio**: ninguna de las 3 rutas se rompe en ninguno de sus estados.

- **Carga**: skeletons reutilizando `ProductCardSkeleton` (patrón de la home).
- **Vacío**:
  - `/catalog` sin resultados → «Sin resultados para estos filtros» + acción
    para **limpiarlos**. Este estado prueba que el filtro llega al servidor
    (si el filtro fuese decorativo, jamás se vaciaría).
  - `/search` sin coincidencias → mensaje de búsqueda sin resultados.
  - `/` sin familias → portada vacía sin romper el render.
- **Error**: traducido con `getFriendlyErrorMessage()` (regla 9 de AGENTS.md),
  sin exponer el error técnico.
- Ninguna respuesta se procesa con `res.json()` sin tolerar `204`/body vacío
  (regla 8; `handleResponse` ya lo hace).

---

## 2. Modelo de Datos (V12)

Migración `V12__catalog_navigation_seed.sql` — **sin cambios de esquema**, sólo
semilla + un índice:

| Tabla | Operación | Idempotencia |
|:---|:---|:---|
| `products` | +3 filas | `ON CONFLICT (reference_code) DO NOTHING` |
| `skus` | +4 filas | `ON CONFLICT (barcode) DO NOTHING` |
| `market_prices` | +16 filas (4 SKUs × 4 mercados) | `ON CONFLICT (sku_id, market_id) DO NOTHING` |
| `stock_items` | +8 filas (4 SKUs × 2 almacenes) | `ON CONFLICT (sku_id, warehouse_id) DO NOTHING` |
| índices | `CREATE INDEX IF NOT EXISTS idx_products_family ON products(family)` | `IF NOT EXISTS` |

Precios (misma cifra para las tallas de un producto):

| Producto | ES (EUR) | UK (GBP) | US (USD) | CH (CHF) |
|:---|---:|---:|---:|---:|
| Abrigo Lana Oversize | 149.95 | 149.99 | 179.95 | 169.00 |
| Jersey Punto Lana | 69.95 | 69.99 | 84.95 | 79.00 |
| Zapatilla Piel Minimal | 99.95 | 99.99 | 119.95 | 109.00 |

> `spring.jpa.hibernate.ddl-auto=validate` **debe seguir en verde**: V12 no
> altera ningún tipo de columna.

---

## 3. Contratos

### `GET /api/v1/products/families` → `200`

```json
[
  { "family": "FOOTWEAR",   "productCount": 1 },
  { "family": "KNITWEAR",   "productCount": 1 },
  { "family": "OUTERWEAR",  "productCount": 2 }
]
```

- `FamilyResponse(family: String, productCount: int)` — record inmutable.
- Nunca `404`; con catálogo vacío → `[]`.

### `GET /api/v1/products` → `200`

```
GET /api/v1/products?family=OUTERWEAR&size=M&color=Marino&sort=name-asc
GET /api/v1/products                       → igual que hoy (regresión)
```

- Respuesta: `List<ProductResponse>` **sin envolver** (mismo contrato que
  actualmente; añadir un paginaría el DTO y rompería a `/search` y a la portada).
- `sort` desconocido → `400` con `GlobalExceptionHandler`.
- `family`/`size`/`color` desconocidos → `200 []` (**no** son errores: son
  datos, y un dato inexistente simplemente no casa).

### `GET /api/v1/products/search/semantic` → `200`

```
GET /api/v1/products/search/semantic?query=abrigos&family=OUTERWEAR&limit=10
```

- `family` **opcional**; si va, se aplica como `filterExpression`.
- `maxPrice` **ya no existe** en la firma.
- `family` desconocido o sin documentos → `200 []`.

### Frontend

| Pieza | Detalle |
|:---|:---|
| `api.ts` | `getFamilies(): Promise<FamilyResponse[]>` · `getProducts(f?: ProductFilters): Promise<Product[]>` donde `ProductFilters = { family?, size?, color?, sort? }` |
| `types/commerce.ts` | `interface FamilyResponse { family: string; productCount: number }` · `interface ProductFilters { family?: string; size?: string; color?: string; sort?: SortOption }` · `type SortOption = "default" \| "name-asc" \| "name-desc"` |
| `app/page.tsx` | reescrito: accesos editoriales a las familias (**ya no lista productos**) |
| `app/catalog/page.tsx` | `"use client"` + componente interno con `useSearchParams` dentro de `<Suspense>` (patrón `verify-email`) · columna lateral + panel móvil |
| `app/search/page.tsx` | búsqueda semántica **migrada** desde la home |
| `components/Header.tsx:30-35` | `<span>` → `<Link>` (`/catalog`, `/search`) |

---

## 4. Criterios de Aceptación

- [x] **R1**: `GET /products/families` devuelve las 3 familias ordenadas con su conteo → test de controller
- [x] **R1**: el endpoint es accesible sin sesión
- [x] **R2**: `?family=` devuelve sólo esa familia → test
- [x] **R2**: `?size=M&color=Negro` exige **ambos en el mismo SKU** → test con el caso trampa
- [x] **R2**: dos parámetros combinados (AND) → test
- [x] **R2**: sin parámetros devuelve lo mismo que hoy → test de no-regresión
- [x] **R2**: `?sort=` desconocido → `400`; `?family=` desconocido → `200 []`
- [x] **R2**: la respuesta **no** lleva paginación → grep del contrato
- [x] **R3**: `/` pinta los accesos de las familias como enlaces y **no** lista productos → test
- [x] **R3**: un acceso navega a `/catalog?family=…` → test
- [x] **R4**: `/catalog` renderiza la columna lateral con familia/talla/color/orden → test
- [x] **R4**: en viewport estrecho aparece el botón «Filtrar» y el panel se abre → test
- [x] **R4**: cambiar un filtro dispara una llamada con ese parámetro → test
- [x] **R4**: no existe control de paginación ni «cargar más» → grep
- [x] **R5**: los filtros quedan en la URL y sobreviven a la recarga → test
- [x] **R5**: `<Suspense>` envuelve el componente que usa `useSearchParams` → `npm run build`
- [x] **R6**: `/search` pinta barra, resultados y skeleton → test
- [x] **R6**: la home ya **no** contiene la barra de búsqueda → test de la portada
- [x] **R7**: «Colección» → `/catalog` y «Búsqueda Vectorial» → `/search` con `href` → test de `Header`
- [x] **R8**: `V12` corre dos veces sin duplicar filas → test de idempotencia
- [x] **R8**: desde una **BD construida desde cero** hay 4 productos y la matriz de precios completa → test (lección 3.2)
- [x] **R8**: el índice `idx_products_family` existe → grep en `V12`
- [x] **R9**: `family` se envía al `filterExpression` → test de `ProductSearchService`
- [x] **R9**: `family` con comilla no se concatena sin validar → test
- [x] **R9**: `maxPrice` ya no aparece en la firma → grep
- [x] **R10**: estados vacío / carga / error en las 3 rutas → tests
- [x] `./mvnw test` · `npx vitest run` · `tsc --noEmit` · ESLint sin errores nuevos · `npm run build`

---

## 5. Casos de Error

| Caso | Comportamiento esperado |
|:---|:---|
| `sort=precio` (inválido) | `400` con estructura de `GlobalExceptionHandler` |
| `family=NOEXISTE`, `size=XL`, `color=Rosa` | `200 []` — la UI muestra el estado vacío de R10 |
| Filtro que da 0 resultados en `/catalog` | Mensaje «Sin resultados» + botón de limpiar filtros |
| El endpoint de familias devuelve `[]` | Portada vacía y sección sin filtro de familia; **ninguna** ruta rompe |
| Backend caído | `getFriendlyErrorMessage()`; sin toast técnico |
| `V12` sobre BD ya poblada | `ON CONFLICT DO NOTHING` → 0 duplicados, sin excepción |
| `V12` sobre BD vacía | 4 productos, 16 precios, 8 stock, 1 índice |
| `family` semántico con `'` o SQL | Validado contra familias reales antes de la expresión → `200 []` |
| Migrar `/search` rompa la home | Se crea `/search` **antes** de vaciar la portada; la home se testea antes de borrar |
| `useSearchParams` sin `<Suspense>` | **Prohibido** — rompe `npm run build` en producción |
| `searchParams` de `page` tratado como objeto | **Prohibido** — en esta versión es `Promise` |
| Añadir paginación o «cargar más» | **Prohibido** — regla de producto (D10) |

---

## 6. Trazabilidad

| Req | Backend | Frontend | Tests |
|:---|:---|:---|:---|
| R1 | `FamilyResponse`, `ProductController` (`/families`) | `api.getFamilies()` | controller |
| R2 | `ProductRepository`, `CatalogService`, `ProductController` | `api.getProducts(filtros)` | repository + controller |
| R3 | — | `app/page.tsx` (portada) | `HomePage.test.tsx` |
| R4 | — | `app/catalog/page.tsx` + `CatalogFilters` | `CatalogPage.test.tsx` |
| R5 | — | `useSearchParams` + `<Suspense>` | `CatalogPage.test.tsx` |
| R6 | — | `app/search/page.tsx` | `SearchPage.test.tsx` |
| R7 | — | `components/Header.tsx` | `Header.test.tsx` |
| R8 | `V12__catalog_navigation_seed.sql` | — | `CatalogSeedTest` (idempotencia + BD fresca) |
| R9 | `ProductSearchService` (`filterExpression`) | — | `ProductSearchServiceTest` |
| R10 | — | estados de las 3 rutas | tests de página |
