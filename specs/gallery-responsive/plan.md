# Plan: Tarea 3.3 — Galería de Imágenes Responsive

> **Estado**: 🟡 **EN PLANIFICACIÓN — PENDIENTE DE APROBACIÓN**
> **Fecha**: 2026-10-07
> **Rama**: `feat/gallery-responsive`

---

## 0. Preguntas previas

**¿Qué problema resuelve?**
El sistema **no tiene ni una sola imagen**: `Product` y `Sku` no tienen campo de
imagen, `public/` sólo contiene los 5 SVG de Next, y ni la tarjeta del catálogo
ni la ficha de producto pintan imagen alguna — todo es texto. Quien navega por
la colección ve nombres y precios, no prendas. La ficha es una hoja de texto a
dos columnas sin ningún sitio donde colocar una foto.

**¿Por qué ahora?**
La Tarea 3.1 construyó la navegación: portada → catálogo → ficha. Son las tres
capas de la vitrina y las tres son de texto. Presentar el producto es el
siguiente escalón lógico antes de encarar la Fase 4.

**¿Qué alternativas se consideraron?**

| # | Alternativa | Por qué se descarta |
|:--|:---|:---|
| A | Tabla `product_images` en BD (migración `V13`, entidades, DTOs, endpoint) | El usuario eligió explícitamente **no tocar el backend** para esta tarea. Modelado correcto, pero fuera del alcance acordado. |
| B | URLs externas de un servicio (picsum/unsplash) | Añade dependencia de red y de un tercero en producción; nada garantiza que respondan mañana. |
| C | Imágenes **SVG** generadas | `next/image` las sirve `unoptimized` automáticamente, con lo que **no hay `srcset` real** y no se ejercita la canalización de optimización que da nombre a la tarea. |
| D | Sólo estructura responsive sobre las cajas grises actuales | Construye el armazón sin nada que mostrar; no se puede verificar visualmente. |
| E | Lista manual de referencias dentro del generador | Hay que mantenerla a mano cada vez que se siembra un producto. Se sustituye por autodescubrimiento desde las migraciones. |
| F | Contar imágenes «a ciegas» con `onError` | Genera peticiones 404 y ruido en consola en cada carga. |

**¿Qué queda fuera de alcance?**
Ver §2 **No-Objetivos**.

---

## 1. Objetivos

- **O1** — La ficha `/products/[reference]` muestra una **galería de varias
  fotos** de la prenda con disposición responsive: 1 columna a ancho completo
  en móvil, 2 columnas + panel de compra fijo (`sticky`) en escritorio.
- **O2** — La `ProductCard` del catálogo y de la búsqueda muestra una **imagen
  única responsive** en su cabecera.
- **O3** — Las imágenes se sirven con `next/image` conforme a **Next 16**:
  `srcset`/`sizes` explícitos, carga diferida y **sin desplazamiento de layout
  (CLS)**; cuando no hay imagen se cae al placeholder existente.
- **O4** — Introducir el concepto de imagen **sin tocar el backend**: sin
  migración, sin DTO, sin endpoint, sin ADR.
- **O5** — Añadir a `AGENTS.md` la convención de estado acordada (la nota se
  redacta **en esta PR**; no habrá PR de documentación de cierre).

---

## 2. No-Objetivos

- **La portada `/`** — sigue siendo un menú editorial sin imágenes (decisión
  D1 de la Tarea 3.1). *Si al aprobar se desea incluirla, es el momento.*
- Las miniaturas de carrito, historial y detalle de pedido: `ProductThumb` se
  mantiene tal cual.
- Cualquier cambio de **backend**: BD, migración, entidades, DTOs, endpoints.
- **Lightbox, zoom, carrusel, swipe/drag** o indicador de paginación de la
  galería: se descartan por coherencia con el scroll vertical elegido en 3.1
  (D10, *«todo el contenido hacia abajo, estilo Zara»*).
- Subida o gestión de imágenes (no existe panel de administración).
- AVIF, CDN, storage externo, `remotePatterns`, dominios remotos.
- Sustituir los placeholders por fotos reales (el generador deja las rutas
  preparadas para hacerlo después).

---

## 3. Decisiones de Diseño

### D1 — Convención de rutas

```
public/products/{referencia}-{n}.webp      n ∈ 1..k
```

La referencia se normaliza sustituyendo `/` por `-` (una barra no puede ir en
un nombre de fichero): `0432/021` → `0432-021-1.webp`.

- `n = 1` es la **imagen principal**, la que usa la tarjeta del catálogo.
- Las imágenes **no** viven en la BD: la fuente de verdad es el frontend.

### D2 — Manifiesto estático (sin 404)

`src/data/product-images.json`:

```json
{ "0432/021": ["0432-021-1.webp", "0432-021-2.webp", "0432-021-3.webp"] }
```

- Generado por el mismo script que las imágenes.
- Se importa **estáticamente** (`resolveJsonModule` ya está activo en
  `tsconfig.json`): sin `fetch`, sin estado de carga, sin carrera.
- Acceso centralizado en `src/lib/product-images.ts` → `getProductImages(ref)`.
- **Si no hay entrada → placeholder.** Nunca se pide un fichero que no existe,
  por lo que no hay 404 ni ruido en consola (ver criterio de la Tarea 3.1
  *«sin mensajes de consola»*).

### D3 — Generador de imágenes

`frontend/scripts/generate-product-images.mjs`, ejecutable con `npm run images`.

- **Autodescubrimiento**: extrae las referencias con el patrón
  `'[0-9]{4}/[0-9]{3}'` de `backend/src/main/resources/db/migration/*.sql`.
  Hoy devuelve **exactamente** los 4 productos del catálogo y **cero falsos
  positivos** (verificado: no coinciden fechas, barras ni códigos de barras).
  Sembrar un producto nuevo ⇒ volver a ejecutar el script.
- Produce **3 imágenes por producto**: WebP **1200×1600** (relación 3:4),
  composición editorial neutra (tono derivado del *hash* de la referencia,
  coherente con la paleta `neutral-*`) y pie con la referencia.
- Escribe también `src/data/product-images.json`. Es **idempotente**.
- **`sharp` pasa a `devDependencies`** (hoy sólo está como dependencia
  transitiva de Next; usarlo en un script propio exige declararlo).

*Considerada y descartada*: dejar los SVG en texto plano (ver alternativa C).

### D4 — Sin cambio de backend

`ProductResponse` no cambia y no hay migración. Toda la información de imagen
vive en el frontend por convención.

**No procede ADR**: no cambia stack ni arquitectura — las imágenes son assets
estáticos servidos por el propio Next.

### D5 — Layout de la ficha

Reestructuración del `grid grid-cols-1 md:grid-cols-12` actual:

| Zona | Clases | Contenido |
|:---|:---|:---|
| Izquierda | `md:col-span-7` | **Galería**: `grid` de **1 columna** por debajo de 768px, **2 columnas** a partir de 768px, `gap-2` |
| Derecha | `md:col-span-5 md:sticky md:top-24` | Panel único: REF/familia, nombre, precio + impuestos, selector de tallas, desglose ATS, botón de compra, nota de envío y descripción |
| Móvil | `grid-cols-1` | Imágenes apiladas a ancho completo y **después** la información |

- Los **dos paneles actuales** (ficha estilística a la izquierda, compra a la
  derecha) **fusen en uno solo** a la derecha: la galería ocupa el hueco que
  ocupaba la ficha estilística.
- `top-24` (96px) es la convención ya usada en `catalog/page.tsx:213` y
  `cart/page.tsx:192`; el `Header` es `h-16` + `z-50`.

### D6 — Componentes nuevos

| Componente | Responsabilidad |
|:---|:---|
| `ProductImage.tsx` | Único punto para ruta + `alt` + `sizes` + **fallback**. Lo consumen tarjeta y galería. |
| `ProductGallery.tsx` | Lista de imágenes de la ficha. |

### D7 — `next/image` conforme a Next 16.3.7

Leídos `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`
(los docs indican que esta versión **no es la de tus datos de entrenamiento**):

- `fill` dentro de un contenedor `relative aspect-[3/4]`: reserva el espacio
  **sin CLS** y no requiere `width`/`height`.
- `sizes` **explícito por contexto**; si falta, el navegador asume `100vw` y
  descarga una imagen mayor de la necesaria. Valores de partida (a verificar en
  DevTools → Network durante la implementación):

  | Uso | Grid | `sizes` |
  |:---|:---|:---|
  | Tarjeta en `/catalog` | `1 / sm:2 / xl:3` + columna lateral | `(max-width: 640px) 100vw, (max-width: 1280px) 40vw, 25vw` |
  | Tarjeta en `/search` | `1 / sm:2 / lg:3` | `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw` |
  | Galería de la ficha | 1 col / 2 col dentro de 7/12 | `(max-width: 767px) 100vw, (max-width: 1200px) 30vw, 320px` |

- **`priority` está deprecado desde Next 16** ⇒ se usa `loading="eager"` +
  `fetchPriority="high"` en la **primera** imagen de la galería (elemento LCP);
  el resto va `lazy` por defecto. No se usa `preload` porque en una galería
  varias imágenes pueden ser LCP según el viewport.
- **No se toca `qualities`**: desde Next 16 es obligatorio declararla para usar
  valores distintos del default `[75]`, y no necesitamos otros. Tampoco `formats`.
- Opcional: `images.localPatterns: [{ pathname: '/products/**' }]` para
  restringir la canalización de optimización a nuestros assets.

### D8 — Fallback al placeholder

`onError` de `<Image>` → caja `ProductThumb` con el mismo aspecto 3:4. El
nombre del producto está junto a la imagen en los tres puntos de uso (tarjeta,
ficha, buscador), así que **no se pierde información accesible**.

### D9 — Texto alternativo

- Vista 1 y tarjeta: `alt={product.name}`.
- Vistas `2..n`: ``alt={`${name} — detalle ${n}`}``.
- Caja de fallback: `aria-hidden` (igual que hoy `ProductThumb`).

### D10 — Tests

- **Nuevos**: `ProductImage.test.tsx`, `ProductGallery.test.tsx`,
  `product-images.test.ts`.
- **Actualizados**: `CatalogPage.test.tsx`, `ProductDetailPage.test.tsx`,
  `Skeleton.test.tsx` (el esqueleto debe reflejar el nuevo layout).
- **Backend**: ninguno — no hay cambio de backend.
- Todo bug encontrado en la prueba manual se cierra con su test.

### D11 — Convención de estado (aprobada por el usuario el 2026-10-07)

Esta misma PR añade a `AGENTS.md` la nota: **el estado del proyecto se redacta
en la feature PR, formulado para ser verdad *después* del merge, sin números de
PR ni SHA** (esos viven en git y en GitHub). Consecuencia: **no habrá PR de
documentación de cierre** para la Tarea 3.3.

---

## 4. Orden de Implementación

1. Rama `feat/gallery-responsive` + `plan.md` + `spec.md` → **⛔ aprobación**.
2. `sharp` en `devDependencies` + `scripts/generate-product-images.mjs` +
   `npm run images` → genera `public/products/*.webp` y el manifiesto.
3. `src/lib/product-images.ts` + `ProductImage.tsx` + sus tests.
4. `ProductCard` con imagen → actualizar `CatalogPage.test.tsx`.
5. `ProductGallery.tsx` + reestructuración de la ficha (D5) → actualizar
   `ProductDetailPage.test.tsx` y `Skeleton.test.tsx`.
6. Verificar `sizes` en DevTools → añadir `localPatterns` si procede.
7. **Prueba manual en navegador** (servidores relanzados): 390px · 768px ·
   1440px, sin errores de consola, atrás/recarga conservan el estado.
8. Baselines: `tsc --noEmit` · `eslint` sin errores nuevos · `npm run build` ·
   `npx vitest run`.
9. `/spec-check gallery-responsive` → CHANGELOG, README, `AGENTS.md`,
   `MEMORY.md` **en esta misma rama** (D11: sin PR de cierre).

---

## 5. Criterios de Aceptación

- [ ] **O1**: la ficha muestra la galería — 1 columna en 390px, 2 columnas en
  ≥768px — y el panel de compra queda `sticky` al hacer scroll.
- [ ] **O2**: la tarjeta del catálogo y de la búsqueda muestra su imagen.
- [ ] **O3**: en DevTools → Network se observa `srcset` con varios anchos y la
  imagen servida se ajusta al viewport; no hay saltos de layout al cargar.
- [ ] **O3**: el `<img>` de la primera imagen de la galería es
  `loading="eager"` con `fetchPriority="high"`; el resto, `lazy`.
- [ ] **O3**: producto **sin** entrada en el manifiesto → placeholder, **sin
  peticiones 404** y sin errores de consola.
- [ ] **O4**: `git diff main --stat` **no** toca `backend/`.
- [ ] **O5**: `AGENTS.md` recoge la convención de estado y no existe PR de
  cierre documental.
- [ ] `npx tsc --noEmit` sin errores.
- [ ] ESLint con **0 errores nuevos** (base: 3 preexistentes).
- [ ] `npm run build` correcto.
- [ ] `npx vitest run` en verde con tests nuevos y actualizados.
- [ ] `npm run images` ejecutable dos veces con el mismo resultado.

---

## 6. Estimación

| Bloque | Peso |
|:---|:---|
| Spec + aprobación | — (bloqueo SDD) |
| Generador + manifiesto (2) | S |
| `ProductImage` + tests (3) | S |
| Tarjeta (4) | S |
| Galería + reestructuración de la ficha + skeletons (5) | **M** |
| Verificación, documentación y cierre (6–9) | S |

**Total: ~1 sesión larga.** El bloque 5 concentra el riesgo: reescribe el
layout de la ficha y arrastra tres tests.
