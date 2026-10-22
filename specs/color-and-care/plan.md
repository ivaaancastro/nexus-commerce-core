# Plan — Colores visibles en la PDP y cuidados de lavado editables

> **Tarea C de la hoja de ruta** (alcance aprobado en la sesión anterior) · documento de diseño (D1–D10) · **⏳ pendiente de aprobación**.
> El alcance vinculante está en `spec.md`; la checklist en `tasks.md` (tras la aprobación).
> **Basado en una auditoría del código real** (rutas y líneas citadas, comprobadas a mano).

---

## 1. Objetivo

Dos cosas que el usuario pidió tras la B:

1. **Colores visibles**: la PDP no muestra en ningún sitio el color. El dato
   **ya existe** (`skus.color`) y ya viaja al carrito, pero el selector de
   tallas pinta el array plano — con dos colores se verían dos botones «M»
   idénticos sin decir de qué color son. Se añade un **selector de color que
   agrupa las tallas de ese color**.
2. **Cuidados de lavado**: no existe en ninguna parte (grep «cuidado|lavado»
   sólo matchea la documentación). Se añade una **sección «Cuidados»
   editable en el CRUD admin** y visible en la PDP, con la **migración V16**.

**Fuera de alcance explícito**: **el catálogo de tarjetas no cambia** (decisión
del usuario) y la búsqueda sigue indexando lo mismo.

---

## 2. Estado real — auditoría (sobre `main` = 71b1ae3)

### 2.1 El color ya está modelado — sólo falta presentarlo

| Señal | Hallazgo |
|:---|:---|
| `Sku.java` L42-45 | **`@Column(nullable = false, length = 30) private String color;`** + `size` — el color es **del SKU, no del producto** (`Product.java` no lo tiene) |
| `V1__initial_schema.sql` L26 + semilla | `color VARCHAR(30) NOT NULL`; `(1, '843321900101', 'Marino', 'M')` — de ahí sale la facet «MARINO» |
| `V12__catalog_navigation_seed.sql` L39-49 | añade `Camel`, `Crudo`, `Negro` con `ON CONFLICT DO NOTHING` → **hoy hay 4 colores en catálogo** |
| `ProductResponse` / `SkuResponse` | el color **ya sale en la API** (`SkuResponse.color`) y el frontend lo tipa en `Sku.color` |
| **PDP** `products/[reference]/page.tsx` L218-232 | `product.skus.map(sku => …)` plano: **sólo `sku.size`**, el color ni se pinta. L285 es el único uso (`color={selectedSku.color}` al carrito) |
| `ProductCard.tsx` L137-153 | pinta «Tallas Disponibles» con `sku.size` — **no cambia** (alcance) |
| `catalog/page.tsx` L159-163 | los colores del filtro se **derivan en cliente** con `Set(product.skus.map(s => s.color))` — mismo patrón que aquí |
| Stock/precio | se piden por `selectedSku.id` (`api.getPrice`, `api.getStock` → `GET /inventory/skus/{id}`) — **ya son por SKU**, el filtro de color no toca nada |

### 2.2 Cuidados: no existe, pero hay un precedente estructural exacto

| Señal | Hallazgo |
|:---|:---|
| grep `cuidado\|lavado\|washing` | **cero** en `backend/` y `frontend/src/` |
| Precedente `description` | `products.description TEXT` (V1 L16) → `Product.description` (`@Column(columnDefinition = "TEXT")`) → `ProductResponse.description` → `@Size(max=2000)` en `ProductCreateRequest`/`ProductUpdateRequest` → `normalizarDescripcion()` (blank → `null`) → `<textarea rows={4}>` en `AdminProductForm` con validación espejo |
| PDP | `product-description` L310-320: párrafo de la descripción + un párrafo **hardcodeado** de acabados (L316-318) |
| Migraciones | **V16 está libre**; patrón `V15`: cabecera que explica el *por qué*, `ADD COLUMN IF NOT EXISTS` |

### 2.3 Puntos de fricción medidos (R8.3 candidatas)

| Test | Qué pisa |
|:---|:---|
| `AdminProductForm.test.tsx` L126 | aserta el payload **exacto** `updateAdminProduct(7, {name, family, description})` — añadir `careInstructions` al body lo rompe |
| `ProductDetailPage.test.tsx` L233-248 | **R7**: orden de DOM `galería → panel → descripción` — la sección de cuidados debe ir **después** de la descripción para no tocar esa precedencia (o declarar R8.3) |
| `ProductDetailPage.test.tsx` L55 | fixture con **un solo SKU** (Marino/M) — el selector nuevo debe seguir pintando ese flujo igual |
| `AdminProductEditPage.test.tsx` L73-85, `AdminProductsPage` | la ficha de edición monta `AdminProductForm`; si gana campo, el payload de L126 es el que hay que declarar |

---

## 3. Decisiones de diseño

### D1 — El selector de color es **sólo frontend y se deriva de los SKUs**

- `colores = [...new Set(product.skus.map(s => s.color))]` en orden de
  **primera aparición** (el orden natural del catálogo, no alfabético: es el
  mismo criterio que ya usa el filtro de catálogo).
- **Cero diff de API** para esta mitad: `Sku.color` ya llega.
- Si sólo hay un color **se muestra igual** — hoy el color no se ve en la PDP
  y «COLOR: Marino» es información, no ruido (Zara lo muestra siempre).

### D2 — Cambiar de color conserva la talla si esa talla existe en el color

- Al elegir color se selecciona el primer SKU de ese color, **prefiriendo la
  misma `size`** que la seleccionada antes (M sigue siendo M si el color
  nuevo la tiene). Se pierde la talla sólo cuando no existe en ese color.
- El precio y el stock **ya se refetchan** al cambiar `selectedSku`, así que
  el filtro de color no toca ese flujo — sólo cambia qué fila se pide.

### D3 — «Cuidados» es un `TEXT` nullable, con el mismo recorrido que `description`

- **`V16__product_care_instructions.sql`**: `ALTER TABLE products ADD COLUMN
  IF NOT EXISTS care_instructions TEXT NULL;` — **sin backfill**: los
  productos existentes quedan `NULL` y la vitrina **no pinta la sección**.
- Entidad `Product.careInstructions` · `ProductResponse.careInstructions`
  (posible `null`) · `ProductCreateRequest`/`ProductUpdateRequest` con
  `@Size(max = 2000)` y normalización **blank → `null`** (espejo de
  `normalizarDescripcion`).
- **El admin lo escribe en texto plano con saltos de línea**: se respeta con
  `whitespace-pre-line` en la vitrina (los cuidados son una lista, no un
  párrafo).

### D4 — En la PDP va **después** de la descripción

- `data-testid="product-care"`, pintada **sólo si tiene contenido**.
- Ubicada tras la descripción para **no tocar la precedencia R7** (galería →
  panel → descripción) — añadir por el final no cambia ninguna comparación
  relativa ya existente.

### D5 — Un solo DTO: `ProductResponse` gana el campo para todo el catálogo

- **Alternativa descartada**: endpoint aparte `GET /products/{id}/care` —
  una petición más y dos fuentes de verdad para un campo escaso.
- Consecuencia honesta: `care_instructions` viaja también en el listado del
  catálogo (nullable, y la mayoría de filas van a `null`). Es exactamente lo
  que ya pasa con `description`. El campo se añade **al final del record**
  para minimizar el churn de los constructores posicionales en los tests.

### D6 — Sin reindex: los cuidados **no** entran en la búsqueda

- `ProductSearchService.toDocument()` indexa `name/family/referenceCode/
  description` — **no se toca**, igual que la frontera 7.2/D6. Reindexar por
  una nota de lavado no aporta y obligaría a un `POST /products/search/index`
  manual para algo que nadie busca. Se documenta en el README de la feature.

### D7 — Sin ADR, catálogo y admin intactos salvo el campo nuevo

- Migración + DTO + formulario: mismo patrón que **7.2, 7.4 y 7.5**, que
  **no crearon ADR** (sólo 7.1, con cambio de política de seguridad, lo hizo).
- **`/receipt`, devoluciones y panel de precios intactos** — `ProductResponse`
  sólo gana un campo.
- **La tarjeta del catálogo no cambia** (alcance del usuario).

### D8 — R8.3 que habrá que declarar

- `AdminProductForm.test` L126 (payload exacto) — pasa a incluir
  `careInstructions`.
- `ProductDetailPage.test` — nuevas pruebas para el selector (fixture con
  **2 colores**) y para la sección de cuidados; las 12 existentes **se
  mantienen**, y si alguna tocara el orden se declara.

### D9 — Verificación con el mismo rigor de las anteriores

- Unitarios backend **contra PostgreSQL real** (MockMvc) y frontend con RTL.
- Verificación **en navegador** sobre el stack real: PDP con **4 colores**
  (semilla `V12`), cambio de color conservando talla, sección de cuidados
  creada desde el panel y visible en la PDP, y **cuidado vacío → sin
  sección**. Capturas como evidencia.

---

### D10 — Las fotos son **por referencia**, no por color (decisión del usuario 2026-10-22)

- **El cambio de color NO cambia la galería**: la PDP cambia tallas, precio y
  stock (que van por `selectedSku.id`), y las fotos se quedan las de la
  referencia. Queda **escrito en la spec** para que no se lea como un olvido.
- Por qué no puede ser otra cosa **hoy** (verificado a mano):
  - `product-images.json` es plano **`referencia → [ficheros]`** (4 entradas,
    3 fotos por producto) — **sin color** en la clave ni en el valor.
  - Hay **un único set por producto**: el generador resuelve el color **una
    sola vez por referencia** («primer color emparejado», con la guarda
    anti-adivinar) — la foto de `0432/021` existe como *Marino*, y de *Camel*
    no hay ninguna.
  - `ProductGallery` recibe sólo `referenceCode` (L66) y hace él solo
    `getProductImages()`; hay **3 consumidores** de esa firma (galería de la
    PDP, `ProductCard` y la edición admin).
- Ampliarlo exigiría: convención de nombre por color, manifiesto de dos
  niveles, **regenerar assets** y un fallback para los colores sin foto —
  que **toca el contrato de la spec 3.3** y el pipeline de imágenes. Es un
  **feature aparte** (propuesto como `photos-per-color`), no un detalle de
  esta C.

## 4. Fuera de alcance

- ❌ **Las tarjetas del catálogo** — no cambian (decisión del usuario).
- ❌ **Fotos por color** — decisión del usuario 2026-10-22 (**D10**): la
  galería es por referencia y no cambia al cambiar de color.
- ❌ **Swatches con color hex**: la BD sólo guarda el *nombre* («Marino»);
  inventar un hex por color sería adivinar. El selector es **tipográfico**,
  como el resto de la PDP.
- ❌ **Búsqueda ni índice vectorial**: `toDocument()` intocado (D6), sin
  reindex.
- ❌ **`/receipt`, devoluciones, precios y stock** — sin cambios.
- ❌ **Fase 8 (Dockerfile)** — sigue después de esta.

---

## 5. Estimación y orden de implementación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | `V16` + entidad + DTOs + `AdminProductService` (crear/actualizar + normalización) | medio |
| **B** | Backend tests: service (normalización, blank→null) + controller (201/200, shape, 400 >2000) | medio |
| **C** | PDP: selector de color (D1/D2) + sección «Cuidados» (D4) | medio |
| **D** | Admin: `careInstructions` en `AdminProductForm` (textarea + validación espejo) | bajo |
| **E** | Frontend tests: PDP (selector con 2 colores, cuidados sí/no) + form (R8.3) + types | medio |
| **F** | Gates + verificación en navegador D9 + CHANGELOG + estado en la PR | bajo |

**Baselines** (tras `final-price-display`): frontend **461** · coverage
85,91/81,94/83,45/87,98 (umbrales 77/76/74/79 + `api.ts` ≥ 99) · backend
**345** · ESLint 0/0 · `tsc` 0 · build 0 · axe 14/14 · **migraciones V1–V15**.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| Romper el payload exacto que aserta `AdminProductForm.test` | R8.3 declarada en D8 y escrita en la spec antes de tocarla |
| Que la sección nueva mueva la precedencia R7 de la PDP | D4: se añade **después** de la descripción; test R7 existente como red |
| Romper los constructores posicionales de `ProductResponse` en los tests backend | D5: campo **al final** del record + recuento de callsites al implementar |
| Un cuidado a medias o en `null` pintando una sección vacía | D3: blank → `null` en servidor y **no pintar** sin contenido (test) |
| `CatalogSeedTest` o migraciones preexistentes | V16 **sólo añade columna** con `IF NOT EXISTS`, sin datos |
