# Tasks — Tarea 3.3: Galería de Imágenes Responsive

> **Spec**: `specs/gallery-responsive/spec.md` ✅ aprobada 2026-10-07 *(10 requisitos)*
> **Estado**: 🟡 **EN CURSO**
> **Plan**: `specs/gallery-responsive/plan.md`
> **Rama**: `feat/gallery-responsive`

---

## 0. Setup

- [x] `git checkout main && git pull`
- [x] `git checkout -b feat/gallery-responsive`
- [x] `specs/gallery-responsive/{plan,spec}.md` escritos y **aprobados por el usuario**
- [x] Leídos los docs de Next 16 en `node_modules/next/dist/docs/` antes de tocar frontend
- [x] Baseline verde: `npx tsc --noEmit` · `npx vitest run` (171) · ESLint 3 errores preexistentes

---

## 1. Generador de imágenes (R1, R3)

- [x] `sharp@^0.35.5` añadido a `devDependencies`
- [x] `package.json` → script `"images": "node scripts/generate-product-images.mjs"`
- [x] `scripts/generate-product-images.mjs`:
  - [x] Autodescubre referencias con `'[0-9]{4}/[0-9]{3}'` sobre `backend/.../db/migration/*.sql`
  - [x] Normaliza `/` → `-` para el nombre de fichero
  - [x] Genera **3 imágenes WebP 1200×1600** por producto (tono derivado del hash, pie con la REF)
  - [x] Escribe `src/data/product-images.json`
  - [x] Idempotente — verificado con `shasum`: misma suma en pasada 1 y 2
- [x] `npm run images` ejecutado → **12 ficheros** en `public/products/` (~118 KB) + manifiesto
- [x] Test `generate-product-images.test.ts` — descubre las 4 referencias, idempotencia, y no confunde códigos de barras ni fechas

---

## 2. Manifiesto y acceso (R2)

- [x] `src/data/product-images.json` generado (4 entradas, 12 rutas)
- [x] `src/lib/product-images.ts` → `getProductImages(referenceCode)` + `imageAlt()`
- [x] Devuelve `[]` sin lanzar para referencia desconocida
- [x] Import **estático** del JSON (sin `fetch` en el código)
- [x] Test `product-images.test.ts` — ruta, normalización, desconocida → `[]`

---

## 3. `ProductImage` (R4, R6, R8)

- [x] `src/components/ProductImage.tsx` (`src`, `alt`, `sizes`, `name`, `family`, `eager?`)
- [x] Contenedor `relative aspect-[3/4]` + `<Image fill sizes>` → la galería no desplaza nada (CLS de página medido en §7)
- [x] `eager` → `loading="eager"` + `fetchPriority="high"` · resto `lazy`
- [x] **Sin `priority`** (deprecada en Next 16) — verificado también en los tipos y con test-grep
- [x] Fallback a `ProductThumb` con `aria-hidden`: `src === undefined` **y** `onError`
- [x] Mientras carga, contenedor `bg-neutral-100`
- [x] `alt` (R8): nombre en la vista 1, `— detalle n` en las demás
- [x] `next.config.ts` → `images.localPatterns: [{ pathname: '/products/**' }]`
- [x] Sin `qualities` ni `formats` (default `[75]` de Next 16)
- [x] Test `ProductImage.test.tsx` — 8 tests: fallback, `sizes`, `eager`, `alt`, `onError`, aspecto, grep de `priority`

---

## 4. Tarjeta del catálogo (R5)

- [x] `ProductCard` → imagen a ancho completo en la cabecera del `<article>`
- [x] Fuente `getProductImages(referenceCode)[0]`
- [x] `CATALOG_CARD_SIZES` y `SEARCH_CARD_SIZES` exportados; `/search` pasa el suyo
- [x] Sin entrada en manifiesto → tarjeta con placeholder, sin 404
- [x] `CatalogPage.test.tsx` — imagen + `sizes` + aspecto · `SearchPage.test.tsx` — `sizes` propio y no el del catálogo
- [x] `ProductCardSkeleton` refleja la imagen para no producir layout shift

---

## 5. Galería y layout de la ficha (R7)

- [x] `src/components/ProductGallery.tsx` — con `[]` pinta **una** caja de placeholder (alineado con R9; §3 de la spec corregido)
- [x] 1 columna `<768px`, **2 columnas** `≥768px`, `gap-2`
- [x] `products/[reference]/page.tsx` → `md:grid-cols-12`: galería `col-span-7`, panel `col-span-5`
- [x] **Los dos paneles fusen**: descripción bajo la galería, compra a la derecha (REF, nombre, precio, tallas, barcode, ATS, botón)
- [x] Orden del DOM: **galería → panel → descripción** (sin reordenar con CSS)
- [x] Colocación explícita: `md:col-start` / `md:row-start` / `md:row-span-2`
- [x] Panel: `md:sticky md:top-24 md:self-start md:max-h-[calc(100vh-7rem)] md:overflow-y-auto`
- [x] Primera imagen `eager` (LCP)
- [x] `ProductDetailPage.test.tsx` — 5 tests nuevos: galería, orden del DOM, 7+5 columnas, panel sticky, descripción bajo la galería

---

## 6. Estados (R9)

- [x] `ProductDetailSkeleton` refleja el nuevo layout (3 cajas `aspect-[3/4]`, galería 1/2, panel sticky)
- [x] `Skeleton.test.tsx` — test R9 añadido
- [x] Producto sin manifiesto → placeholder **sin 404** ni errores de consola.
      En navegador: las 4 referencias sembradas tienen imagen y ninguna
      petición devuelve `naturalWidth === 0`. **No existe un producto sin
      manifiesto con los datos sembrados** (el manifiesto cubre las 4 refs), así
      que el ramal `src === undefined` → `ProductThumb` queda cubierto por
      `ProductImage.test.tsx` en jsdom

---

## 7. Verificación manual en navegador (obligatoria)

Verificado el 2026-10-07 en Chrome contra `localhost:3000` con backend en 8080,
emulando los 3 anchuras con DevTools (`390x844x3,mobile,touch`, `768x1024x2`,
`1440x900x1`).

- [x] **390px**: 1 columna, imágenes apiladas (371→276 px), orden vertical
      galería (y 194) → panel (y 1354) → descripción (y 1969), panel `sticky: static`
- [x] **768px** y **1440px**: galería a **2 columnas** (imgs 0/1 en la misma
      fila, la 3ª en la 2ª), panel `position: sticky` con `top: 96px` tras hacer
      scroll (galería ya en y −151, panel aún en y 96)
- [x] Panel más alto que el viewport ⇒ todo su contenido alcanzable: con
      viewport de 480 px el panel pasa a `max-height: 368px` +
      `overflow-y: auto` (568 px de contenido) y al llegar a `scrollTop` máximo
      el botón queda en 385–433 y el pie de envío en 361–464, dentro de la caja
      96–464 **y del viewport**
- [x] DevTools → Network: `srcset` con **15 anchos** (16w…3840w) y elección
      óptima del bucket: 390/DPR3 → pide `828` para 828 necesarios (**1.00×**),
      768/DPR2 → `384` (1.15×), 1440/DPR1 → `384` para 279 (1.26×, el bucket
      siguiente a 256), catálogo 390/DPR3 → `1080` para 1020 (1.06×); todas
      ellas el **bucket mínimo posible**, servidas por `/_next/image`
- [x] Saltos de layout: **0.000 en 390px, 0.011 en 1440px, 0.039 en 768px**
      (`PerformanceObserver('layout-shift')`, `buffered`). Las fuentes son el
      panel de compra (el precio y el bloque ATS llegan en peticiones
      posteriores y hacen crecer el panel de 473 a 680 px, arrastrando 41 px a
      la descripción) — **ninguna es una imagen**: la galería se mantiene en
      454 px desde el primer pintado. Todo por debajo del umbral «bueno» (0.1)
- [x] **Consola limpia en las 3 anchuras**: sólo `React DevTools` (info),
      `[HMR] connected` y el aviso `A form field element should have an id or
      name attribute` — **ambos preexistentes**: el primero es de desarrollo y
      el segundo viene del `<select aria-label="Mercado y divisa">` del Header
      (commit `0ae6f7f`, Tarea 3.2), sin cambios en esta rama. **Ni errores ni
      avisos de `next/image`**: el de LCP se resuelve con `EAGER_CARDS`/`EAGER_IMAGES`
- [x] Atrás y recarga conservan el estado: `/catalog?family=OUTERWEAR` →
      ficha → **atrás** ⇒ vuelve a `?family=OUTERWEAR` con el filtro activo y
      2 de 4 tarjetas; recarga de la ficha con `ignoreCache` ⇒ render correcto
- [x] `/catalog` muestran la imagen en las tarjetas (4/4, servidas por
      `/_next/image`); `/search` **no pudo verificarse en navegador**: la
      búsqueda semántica devuelve 500 porque no existe `OPENAI_API_KEY` en el
      entorno (limitación **preexistente** anotada en fases anteriores). Queda
      cubierto por `SearchPage.test.tsx` y por usar el mismo `ProductCard`
      verificado en `/catalog`

---

## 8. Baselines

- [x] `npx tsc --noEmit` sin errores
- [x] ESLint **0 errores nuevos** (base: 3 preexistentes)
- [x] `npx vitest run` en verde — **206 tests** (base: 171, +35)
- [x] `git diff main --stat` **no toca `backend/`** (R10)
- [x] `npm run build` — compilación y 14 rutas generadas sin errores

---

## 9. Documentación y cierre (R10)

- [x] `/spec-check gallery-responsive` → **31 criterios en verde** (hecho a
      mano: no hay fichero `.opencode/commands/spec-check.md` en el repo)
- [x] `CHANGELOG.md` — entrada en `[Unreleased]`
- [x] `README.md` — convención de imágenes (sección «Imágenes de Producto»)
- [x] `AGENTS.md` — **convención de estado** (D11): el estado se redacta en la
      feature PR, formulado para ser verdad tras el merge, **sin números de PR
      ni SHA** → por eso **no habrá PR de documentación de cierre**. Además
      regla de proceso 13 y sección 6.7 «Imágenes de Producto»
- [x] `MEMORY.md` — Tarea 3.3 completada + decisiones D1–D11
- [ ] Preguntar al usuario **antes** de cualquier commit y PR
