# Spec: Tarea 3.3 — Galería de Imágenes Responsive

> **Estado**: 🟡 **PENDIENTE DE APROBACIÓN** ⛔ *punto de bloqueo SDD*
> **Fecha**: 2026-10-07
> **Rama**: `feat/gallery-responsive`
> **Plan**: `specs/gallery-responsive/plan.md`

> **Alcance acordado con el usuario (2026-10-07)**: la galería se despliega en
> **la ficha de producto y en la tarjeta del catálogo**, y las imágenes son
> **archivos estáticos por convención** en `public/products/` — **sin tocar el
> backend**.

---

## 1. Requisitos

### R1 — Convención de rutas de imagen

**Criterio**: la ruta de una imagen se deduce de la referencia del producto,
sin consultar la BD.

- `public/products/{referencia-normalizada}-{n}.webp` con `n ≥ 1`.
- Normalización: la `/` de la referencia se sustituye por `-`
  (`0432/021` → `0432-021-1.webp`).
- `n = 1` es la **imagen principal**, la que se usa en la tarjeta.
- El formato es **WebP** y el tamaño fuente es **1200×1600** (3:4).
- No existe ninguna otra fuente de imágenes: no hay endpoint, ni campo en BD,
  ni URL remota.

### R2 — Manifiesto generado

**Criterio**: el frontend sabe qué imágenes existen **sin hacer peticiones
especulativas**.

- `src/data/product-images.json` mapea `referencia → [fichero, …]`:

  ```json
  { "0432/021": ["0432-021-1.webp", "0432-021-2.webp", "0432-021-3.webp"] }
  ```

- Se importa **estáticamente** (`resolveJsonModule` ya activo): sin `fetch`,
  sin estado de carga, sin carrera.
- La lectura pasa **siempre** por `src/lib/product-images.ts` →
  `getProductImages(referenceCode): string[]`.
- Referencia desconocida o sin entrada → `[]`, **nunca** una excepción.
- El manifiesto lo escribe el mismo script que genera las imágenes (R3): no se
  mantiene a mano.

### R3 — Generador de imágenes

**Criterio**: `npm run images` produce las imágenes y el manifiesto de forma
reproducible.

- Script: `frontend/scripts/generate-product-images.mjs`.
- **Autodescubre** las referencias con el patrón `'[0-9]{4}/[0-9]{3}'` en
  `backend/src/main/resources/db/migration/*.sql`.
  - Verificado: devuelve hoy **exactamente** `0432/021`, `0611/018`,
    `0815/004`, `1240/007` y **cero falsos positivos** (no coinciden fechas,
    códigos de barras ni `0000/000`).
  - Al sembrar un producto nuevo basta con re-ejecutarlo.
- Genera **3 imágenes por producto**: composición editorial neutra, tono
  derivado del *hash* de la referencia (paleta `neutral-*`) y pie con la
  referencia.
- Escribe también `src/data/product-images.json`.
- Es **idempotente**: dos ejecuciones consecutivas producen el mismo resultado
  (mismo contenido y misma lista de entradas).
- `sharp` se declara en **`devDependencies`** (hoy sólo llega como dependencia
  transitiva de Next; un script propio no debe depender de eso).

### R4 — Componente `ProductImage`

**Criterio**: hay un único punto del código que sabe resolver una imagen, su
texto alternativo y su fallback.

| Prop | Tipo | Descripción |
|:---|:---|:---|
| `src` | `string \| undefined` | Ruta ya resuelta (`/products/…`) |
| `alt` | `string` | Texto alternativo (R8) |
| `sizes` | `string` | Valor de `sizes` para el `srcset` (R6) |
| `name` | `string` | Nombre del producto (fallback y `data-product-name`) |
| `family` | `string` | Familia textil (texto del placeholder) |
| `eager` | `boolean?` | `loading="eager"` + `fetchPriority="high"` |

- `src === undefined` **o** fallo de carga (`onError`) → caja `ProductThumb`
  con el mismo aspecto (`aspect-[3/4]`), `aria-hidden`.
- Mientras carga, el contenedor tiene fondo `bg-neutral-100`: no hay destello
  blanco ni cambio de layout.
- `name` y `family` son **obligatorios**: la caja de fallback es decorativa, la
  información accesible la da el texto contiguo.

### R5 — Imagen en la `ProductCard`

**Criterio**: la tarjeta del catálogo y de la búsqueda muestra su imagen.

- Imagen a ancho completo en la cabecera del `<article>`, sin relleno lateral
  (el texto conserva su `p-6`).
- Fuente: `getProductImages(referenceCode)[0]`.
- **`/catalog` y `/search`** consumen el mismo componente; sólo cambia el valor
  de `sizes` (R6).
- Sin entrada en el manifiesto → la tarjeta se ve como hoy (caja gris), sin
  peticiones 404.

### R6 — Uso correcto de `next/image` en Next 16.3.7

**Criterio**: las imágenes se sirven adaptativamente y sin desplazamiento de
layout.

- Contenedor `relative aspect-[3/4]` + `<Image fill sizes={…}>`: el espacio
  está reservado **antes** de descargar, así que **la galería no desplaza nada**
  (medido: mantiene sus 454 px desde el primer pintado) y no hacen falta
  `width`/`height`.
- **CLS total de la ficha** (medido con `PerformanceObserver('layout-shift')`):
  el producto no llega de una sola tacada — precios y stock ATS vienen en
  peticiones posteriores y hacen crecer el panel de compra de 473 a 680 px —,
  así que el desplazamiento no puede ser literalmente 0. Medido: **0.000 en
  390px, 0.011 en 1440px y 0.039 en 768px**, siempre por debajo del umbral
  «bueno» de Core Web Vitals (0.1). **Ninguna fuente del desplazamiento es una
  imagen**: son los bloques del panel (precio, tallas, ATS) y, por arrastre de
  la fila de rejilla, la descripción que queda a su lado.
- `sizes` **obligatorio en cada uso** (si falta, el navegador asume `100vw` y
  descarga de más). Los valores son el **ancho real medido de la imagen** en
  cada tramo, redondeado siempre **hacia arriba** para no pedir nunca una imagen
  menor que la caja, y son verificables en DevTools → Network:

  | Uso | Grid | `sizes` |
  |:---|:---|:---|
  | Tarjeta en `/catalog` | `1 / sm:2 / xl:3` + `aside w-56` en `lg` | `(max-width: 639px) calc(100vw - 50px), (max-width: 1023px) calc(50vw - 44px), (max-width: 1279px) calc(50vw - 176px), 307px` |
  | Tarjeta en `/search` | `1 / sm:2 / lg:3`, sin lateral | `(max-width: 639px) calc(100vw - 50px), (max-width: 1023px) calc(50vw - 44px), (max-width: 1294px) calc(100vw / 3 - 37px), 395px` |
  | Galería de la ficha | 1 col / 2 col dentro de `col-span-7` | `(max-width: 639px) calc(100vw - 114px), (max-width: 767px) calc(100vw - 146px), (max-width: 1166px) calc(30vw - 60px), 280px` |

- **Primera fila**: `loading="eager"` + `fetchPriority="high"` en las **2**
  imágenes de cabeza de la galería y en las **3** de cabeza de una rejilla de
  tarjetas (3 columnas es el máximo en todo el proyecto). Son las que están por
  encima del pliegue, y como todas tienen el mismo tamaño el navegador resuelve
  el LCP por un empate de pintado: si la que gana queda `lazy`, Next 16 avisa en
  desarrollo de que una imagen diferida ha ganado el LCP. **`priority` NO se
  usa: está deprecado desde Next 16.** Tampoco `preload`, porque en una galería
  varias imágenes pueden ser LCP según el viewport.
- Resto de imágenes: `loading="lazy"` (valor por defecto).
- **No se modifica `qualities`** (Next 16 exige declararla para valores
  distintos del default `[75]`; no necesitamos otros) ni `formats`.
- Opcional: `images.localPatterns: [{ pathname: '/products/**' }]` para acotar
  la canalización de optimización a nuestros assets.

### R7 — Layout responsive de la ficha

**Criterio**: la ficha pasa de dos paneles de texto a galería + panel de
compra, con el orden del DOM correcto en móvil.

**Orden del DOM (que es el de móvil):** galería → panel de compra → descripción.

| Punto de ruptura | Disposición |
|:---|:---|
| `< 768px` | Una columna: imágenes a ancho completo apiladas, después el panel de compra, después la descripción |
| `≥ 768px` | `md:grid-cols-12`: galería en `md:col-span-7`, panel de compra en `md:col-span-5`, descripción **bajo la galería** en `md:col-span-7` |

- La **galería** es un `grid` de **1 columna** en móvil y **2 columnas** en
  escritorio, con `gap-2`.
- El **panel de compra** lleva `md:sticky md:top-24` (`top-24` = 96px, la
  convención ya usada en `catalog/page.tsx` y `cart/page.tsx`; el `Header` es
  `h-16` + `z-50`) y `md:self-start` para no estirarse.
- El orden de móvil se consigue con **colocación explícita de rejilla**
  (`md:col-start` / `md:row-start` / `md:row-span`), **no** reordenando el DOM:
  un lector de pantalla y el tabulador recorren galería → compra → descripción.
- **Panel más alto que el viewport**: `md:max-h-[calc(100vh-7rem)]` +
  `md:overflow-y-auto`, para que nada quede inalcanzable mientras hace *scroll*
  la galería.
- Los **dos paneles actuales fusen**: la ficha estilística desaparece como
  columna y su contenido (descripción) baja bajo la galería; el de compra
  conserva todo su contenido (REF, nombre, precio + impuestos, tallas,
  barcode, desglose ATS, botón, envío).

### R8 — Texto alternativo y accesibilidad

- Imagen principal y tarjeta: `alt={product.name}`.
- Vistas `2..n`: ``alt={`${name} — detalle ${n}`}``.
- Caja de fallback: `aria-hidden="true"` (patrón de `ProductThumb`): el nombre
  del producto está visible junto a la imagen en los tres puntos de uso.
- El `<img>` resultante lleva `alt` siempre: **nunca** un nodo de imagen sin
  texto alternativo.
- La galería no introduce controles interactivos, así que no hay trampas de
  foco.

### R9 — Estados de la UI

| Estado | Comportamiento |
|:---|:---|
| Cargando la ficha | `ProductDetailSkeleton` con cajas de aspecto 3:4 en las posiciones de la galería |
| Cargando cada imagen | Contenedor `bg-neutral-100` con la relación de aspecto reservada |
| Imagen inexistente (sin entrada en manifiesto) | Caja `ProductThumb` — **cero peticiones** |
| Imagen que falla al cargar (`onError`) | Caja `ProductThumb` — defensa en profundidad |
| Catálogo vacío / búsqueda sin resultados | Estados ya existentes, sin regresión |
| Backend caído | Comportamiento actual de la ficha, **sin cambios** |

### R10 — Sin cambio de backend y sin ADR

**Criterio**: la tarea es de frontend puro.

- `git diff main --stat` **no** contiene nada bajo `backend/`.
- No hay migración, ni entidad, ni DTO, ni endpoint.
- **No procede ADR**: no cambia stack ni arquitectura; las imágenes son assets
  estáticos servidos por Next.
- Esta PR añade a `AGENTS.md` la **convención de estado** aprobada por el
  usuario (D11 del plan): el estado se redacta en la feature PR, formulado
  para ser verdad *después* del merge, **sin números de PR ni SHA**. En
  consecuencia, **no habrá PR de documentación de cierre** de la tarea.

---

## 2. Modelo de Datos

**Sin cambios en BD.** El único modelo nuevo es el manifiesto del frontend:

```
src/data/product-images.json
├── tipo      Record<string, string[]>
├── clave     reference_code tal cual ("0432/021")
└── valor     nombres de fichero dentro de public/products/

public/products/
├── 0432-021-1.webp … 0432-021-3.webp   (Blazer Cruzada Estructura)
├── 0611-018-1.webp … 0611-018-3.webp   (Abrigo Lana Oversize)
├── 0815-004-1.webp … 0815-004-3.webp   (Jersey Punto Lana)
└── 1240-007-1.webp … 1240-007-3.webp   (Zapatilla Piel Minimal)
```

12 ficheros, 4 entradas en el manifiesto. Los productos llegados en el futuro
se cubren re-ejecutando `npm run images`.

---

## 3. Contratos

**API REST**: no aplica — no hay cambio de backend.

**Frontend**:

```ts
// src/lib/product-images.ts
export function getProductImages(referenceCode: string): string[];
// [] si la referencia no está en el manifiesto — nunca lanza.
```

```tsx
// src/components/ProductImage.tsx
interface ProductImageProps {
    src: string | undefined;
    alt: string;
    sizes: string;
    name: string;
    family: string;
    eager?: boolean;
}
```

```tsx
// src/components/ProductGallery.tsx
interface ProductGalleryProps {
    referenceCode: string;
    name: string;
    family: string;
    sizes: string;
}
// Renderiza getProductImages(referenceCode).length figuras; con [] no pinta nada.
```

**Script**:

```bash
npm run images   # → public/products/*.webp + src/data/product-images.json
```

---

## 4. Criterios de Aceptación

- [x] **R1**: `0432/021` resuelve a `/products/0432-021-1.webp` → test
- [x] **R1**: la normalización no deja ninguna `/` en el nombre de fichero → test
- [x] **R2**: `getProductImages()` devuelve las 3 rutas de una referencia real
- [x] **R2**: referencia desconocida → `[]` y no lanza → test
- [x] **R2**: el manifiesto se importa estáticamente (sin `fetch` en el código) → grep
- [x] **R3**: `npm run images` descubre las 4 referencias de las migraciones → test
- [x] **R3**: se ejecuta dos veces y el resultado no cambia (idempotencia) → test
- [x] **R3**: `sharp` aparece en `devDependencies` → `package.json`
- [x] **R4**: `src` undefined → caja de placeholder, sin `<img>` → test
- [x] **R4**: `onError` sobre un `<img>` → cambia a la caja de placeholder → test
- [x] **R4**: el `<img>` cargando tiene el contenedor `bg-neutral-100` → test
- [x] **R5**: `/catalog` pinta la imagen en la cabecera de la tarjeta → test
- [x] **R5**: `/search` pinta la imagen con su propio `sizes` → test
- [x] **R6**: cada uso de `<Image>` lleva `sizes` → grep sobre los componentes
- [x] **R6**: la primera fila (2 en la galería, 3 en una rejilla de tarjetas)
      es `loading="eager"` con `fetchPriority="high"` y **no** se usa `priority`
      → test + grep
- [x] **R6**: `next.config` no declara `qualities`/`formats` → grep
- [x] **R6**: en DevTools → Network aparece `srcset` con varios anchos y la
      imagen servida se ajusta al viewport → verificación manual
- [x] **R6**: la galería no desplaza nada al cargar (alto fijo desde el primer
      pintado) y el CLS total de la ficha se queda por debajo de 0.1 en las 3
      anchuras → verificación manual con `PerformanceObserver('layout-shift')`
- [x] **R7**: 390px → 1 columna, imágenes apiladas y panel de compra debajo → manual
- [x] **R7**: 768px y 1440px → galería a 2 columnas y panel `sticky` que se
      mantiene al hacer *scroll* → manual
- [x] **R7**: con el panel más alto que el viewport, todo su contenido es
      alcanzable → manual
- [x] **R7**: el orden del DOM es galería → compra → descripción → test
- [x] **R8**: la imagen principal tiene `alt` con el nombre del producto → test
- [x] **R8**: las vistas siguientes tienen `alt` con `— detalle n` → test
- [x] **R8**: la caja de fallback es `aria-hidden` → test
- [x] **R9**: el skeleton de la ficha refleja el nuevo layout → `Skeleton.test.tsx`
- [x] **R9**: producto sin manifiesto → placeholder **sin 404** y sin errores
      de consola → test + manual
- [x] **R10**: `git diff main --stat` no toca `backend/` → grep
- [x] **R10**: `AGENTS.md` recoge la convención de estado y no existe PR de
      cierre → revisión
- [x] `npx tsc --noEmit` · ESLint **0 errores nuevos** (base: 3) ·
      `npm run build` (14 rutas) · `npx vitest run` en verde (**206 tests**)
- [x] Navegador **sin mensajes de consola** en las 3 anchuras — sólo los dos
      hallazgos preexistentes documentados (info de React DevTools y el aviso
      del `<select>` del Header de la Tarea 3.2)

---

## 5. Casos de Error

| Caso | Comportamiento esperado |
|:---|:---|
| Referencia no presente en el manifiesto | `[]` → caja de placeholder; **cero peticiones** y **cero 404** |
| Fichero borrado tras generar el manifiesto | `onError` → caja de placeholder (defensa en profundidad) |
| Migración futura con un patrón `NNNN/NNN` no productivo | Sólo añade una entrada huérfana: se pinta placeholder al no existir el fichero… salvo que exista; en cualquier caso la UI nunca rompe |
| `npm run images` sin `sharp` instalado | Fallo claro del script con mensaje; no escribe un manifiesto a medias |
| Producto sembrado y script no re-ejecutado | Placeholder, sin errores: el catálogo sigue siendo usable |
| Imagen con peso excesivo | El generador fija 1200×1600 y calidad WebP; no se admiten fuentes mayores |
| Colocación de un `.svg` en `public/products/` | `next/image` lo sirve `unoptimized` automáticamente; funciona, pero **no** genera `srcset` |
| Panel `sticky` más alto que el viewport | `max-h` + `overflow-y-auto`: nada queda inalcanzable |
| Reordenar el DOM para conseguir el layout de escritorio | **Prohibido** — rompe el orden accesible y de tabulación en móvil (R7) |
| Usar `priority` porque «así se hacía antes» | **Prohibido** — deprecado en Next 16 |
| Añadir lightbox, carrusel o zoom | **Fuera de alcance** — contradice el scroll vertical elegido en 3.1 |
| Meter imágenes en la BD o en los DTO | **Fuera de alcance** — decisión explícita del usuario |

---

## 6. Trazabilidad

| Req | Frontend | Script / Assets | Tests |
|:---|:---|:---|:---|
| R1 | — | `public/products/*.webp` | `product-images.test.ts` |
| R2 | `src/lib/product-images.ts`, `src/data/product-images.json` | manifest | `product-images.test.ts` |
| R3 | `package.json` (`npm run images`) | `scripts/generate-product-images.mjs` | `generate-product-images.test` |
| R4 | `components/ProductImage.tsx` | — | `ProductImage.test.tsx` |
| R5 | `components/ProductCard.tsx` | — | `CatalogPage.test.tsx`, `SearchPage.test.tsx` |
| R6 | `ProductImage.tsx` (`sizes`, `eager`) | — | `ProductImage.test.tsx` |
| R7 | `app/products/[reference]/page.tsx`, `components/ProductGallery.tsx` | — | `ProductDetailPage.test.tsx` |
| R8 | `ProductImage.tsx` (`alt`) | — | `ProductImage.test.tsx` |
| R9 | `components/ProductDetailSkeleton.tsx` | — | `Skeleton.test.tsx` |
| R10 | `AGENTS.md` | — | revisión manual |
