# Plan: V2 — Zoom/lightbox en la galería de la ficha

> **Estado**: ✅ **APROBADA por el usuario — 2026-10-26**
> **Fecha**: 2026-10-26
> **Rama**: `feat/zoom-lightbox`
> **Spec**: `specs/zoom-lightbox/spec.md`
> **Tarea de la hoja de ruta**: V2 del bloque «Mejoras de vitrina» — *«Zoom/lightbox en la galería de la ficha — revisa la decisión D5 de la 3.3 («sólo scroll»); sólo frontend»*.

---

## 1. Objetivos

- **O1** — Ampliar cualquier imagen de la galería de la ficha a **pantalla completa**
  (lightbox) sin salir de la página: clic en cualquier celda → visor modal con
  navegación entre las imágenes del producto.
- **O2** — **Zoom de precisión en escritorio** sobre la imagen ampliada: con puntero
  fino, la imagen se amplía ×2 siguiendo el cursor (patrón lupa).
- **O3** — **Cero regresión de la 3.3**: el grid vertical (1/2 columnas), el LCP
  (2 primeras `eager` + `fetchPriority="high"`), los `sizes`, los `alt`, los
  placeholders y el `ProductImage` compartido quedan **intactos** — los 6 tests
  existentes de `ProductGallery` pasan **sin tocar ninguna aserción**.
- **O4** — **Accesibilidad real**, no cosmética: diálogo modal (`role="dialog"` +
  `aria-modal`), Escape y ←/→, **trampa de foco**, devolución del foco al gatillo,
  contador anunciado (`role="status"`), y el gate axe **gana** una comprobación
  (PDP con el visor abierto): 14 → 15.
- **O5** — **Sólo frontend**: `git diff main --stat` sin `backend/`, sin migración,
  sin endpoint, **sin ADR**.

---

## 2. No-Objetivos

- **Carrusel horizontal / swipe / drag en la rejilla**: la galería sigue siendo
  *scroll vertical* (3.3 D5). Esta V2 **sólo añade una capa superpuesta** al
  pulsar una imagen; no cambia cómo se recorre el catálogo.
- **Pinch-zoom táctil**: en móvil el visor ya ocupa la pantalla; el zoom es de
  **escritorio (pointer fino)**. Se escribe como límite conocido.
- **Lightbox en las tarjetas** de `/catalog` y `/search`: allí la imagen navega a
  la ficha.
- Miniaturas/carrusel dentro del visor, descarga, compartir, lightbox a pantalla
  completa *real* (`requestFullscreen`).
- Prefetch de las imágenes vecinas del visor (sólo se renderiza la actual).
- Cualquier cambio de backend, BD, API, imágenes o manifiesto.
- Reescribir los specs cerrados de la 3.3: la revisión del criterio *«lightbox
  fuera de alcance»* queda **constatada aquí**, en la V2, sin editarlos.

---

## 3. Decisiones de Diseño

### D1 — Se amplía la 3.3, no se rehace

La 3.3 excluyó el lightbox «por coherencia con el scroll vertical» (su plan,
No-Objetivos). La hoja de ruta aprobó revisar eso en la V2. Decisión: **el grid
vertical, sus tests y sus medidas se conservan tal cual**; el visor entra como
 componente nuevo montado por `ProductGallery`. El único punto de fricción con la
 3.3 es su R8 («la galería no introduce controles interactivos»): queda
 **revisado por esta spec** — los controles interactivos nuevos viven en el
 **visor**, y la rejilla gana únicamente el botón por celda (R1).

### D2 — Gatillo: un `<button>` por celda, `ProductImage` intocado

- Cada celda **con imagen real** se envuelve en `<button type="button">` con
  `aria-label` en español («Ampliar imagen: {alt}»).
- **`ProductImage` no se toca**: se comparte con tarjeta y búsqueda, donde la
  imagen navega a la ficha; hacerla interactiva globalmente rompería R4/R5.
- **Placeholder sin manifiesto → celda no interactiva** (sin visor, sin peticiones,
  R9 de la 3.3 intacta).

### D3 — El visor es cliente; `GALLERY_SIZES` se muda a `lib/`

`ProductGallery` gana estado (¿abierto?, ¿qué índice?) y handlers ⇒ debe ser
**`"use client"`**. Pero la página (servidor) importa `GALLERY_SIZES` de ese
módulo para usarlo **como valor** en `sizes`, y un módulo cliente sólo puede
aportar componentes — consumir su constante desde servidor es un error. Decisión:

- `GALLERY_SIZES` se **muda a `src/lib/gallery-sizes.ts`** (mismo valor, sin
  tocar la fórmula medida en la 3.3 R6).
- El cambio en la ficha es **1 línea de import**; la spec lo declara (R8).
- `GALLERY_SIZES` queda `export` en el componente **por compatibilidad de tests**
  o se migra su import en los tests: se resuelve en tasks con diff mínimo —
  **ninguna aserción** se toca.

### D4 — Visor modal

- Componente nuevo **`src/components/ProductLightbox.tsx`** (sólo cliente),
  montado por `ProductGallery` cuando `open === true`.
- Overlay `fixed inset-0` **por encima del header** (header `z-50` ⇒ visor
  `z-[60]`), fondo oscuro editorial (`bg-neutral-950/95`), imagen centrada
  `object-contain`.
- Imagen grande con **caja de aspecto reservada** y `sizes="100vw"`: **cero CLS**
  al abrir. Se **reutiliza `ProductImage`** (mismo `alt`, mismo fallback
  `ProductThumb` si el fichero falla — defensa en profundidad).
- Controles lineales de la casa (`w-5 h-5`, stroke 1.5, blanco, hover opacidad,
  `transition-all duration-300`, **`motion-reduce:transition-none`**): **✕ cerrar**
  arriba-derecha, **‹ ›** a los lados **sólo si hay más de una imagen**, contador
  **«n / total»** centrado abajo.
- Sólo se renderiza la imagen **actual**; cambiar de índice cambia el `src`.
- Cierre: **✕**, **Escape** y **clic en el fondo** (con guarda anti-arrastre:
  sólo si el pulsado y el soltado empiezan en el fondo). Clic sobre la imagen **no**
  cierra (en móvil se navega con ‹ ›).
- **Scroll del body bloqueado** mientras está abierto y **restaurado** al cerrar
  (y en *cleanup* si la ruta cambia).

### D5 — Zoom de escritorio (patrón lupa)

- Condición: puntero fino — `@media (hover: hover) and (pointer: fine)`. Sin esa
  condición, el visor se comporta igual pero **sin zoom** (móvil/tablet táctil).
- Al puntero sobre la imagen: **`cursor-zoom-in`** y `transform: scale(2)` con
  `transform-origin` en la posición del cursor (**sigue al puntero**); al salir,
  vuelve a escala 1 con la transición de la casa.
- **×2 cabe en la fuente**: la caja del visor suele medir ~500–700 px de ancho y
  la imagen fuente es 1200×1600 ⇒ 2× no supera la resolución nativa.
- Sin estado persistente (no hay «modo zoom»): es una **propiedad del hover**.
- **`motion-reduce`**: transformación **sin animación**.
- Pinch y doble-tap: **fuera de alcance** (escrito en No-Objetivos).

### D6 — Accesibilidad (patrón `CartDrawer` + trampa)

- `role="dialog"` + `aria-modal="true"` + `aria-label="Galería ampliada de
  producto"` — mismo patrón que `CartDrawer` (que ya usa `role`/`aria-modal` y
  Escape).
- **Foco inicial** en el botón ✕; **trampa**: `Tab`/`Shift+Tab` circulan dentro
  del diálogo (implementación propia, sin dependencia nueva — *mejora documentada
  sobre el precedente: `CartDrawer` no trampa*).
- **Devuelve el foco** al botón que abrió el visor.
- ←/→ navegan (keydown mientras abierto); Escape cierra.
- Contador con **`role="status"`** ⇒ el cambio de imagen se anuncia.
- Todos los controles con `aria-label` en español.

### D7 — Gate axe: 14 → 15 comprobaciones

`e2e/a11y.spec.ts` gana **un test**: abre la ficha, pulsa la primera celda y
audita **con el visor abierto**. Sigue prohibido suprimir reglas (`axe.exclude()`
y `disableRules` fuera — convención D7 de la 4.3). Las 14 rutas existentes quedan
**sin tocar**.

### D8 — Tests de componente

- **`ProductGallery.test.tsx`**: los 6 tests actuales **intactos** (R8.3 si alguna
  query necesita ajuste por el wrapper — objetivo: 0 toques) + nuevos: celda con
  imagen es botón con `aria-label`; placeholder **no** es botón; abrir pinta el
  visor en el índice correcto.
- **Nuevo `ProductLightbox.test.tsx`**: abre con el índice dado · ✕/Escape/fondo
  cierran · ‹ › navegan (con wrap en los extremos) · contador · foco inicial en ✕
  · foco devuelto al gatillo · trampa de Tab · scroll del body se bloquea y se
  restaura · zoom sólo con puntero fino.
- **Sin E2E nuevos de humo** (las 5 siguen iguales); el único cambio en `e2e/` es
  el +1 de D7.

### D9 — Fronteras y proceso

- `git diff main --stat` **sin `backend/`**; sin migración, sin ADR, sin datos
  nuevos.
- Estado redactado **en la feature PR** (verdad tras el merge, sin PR/SHA) ⇒
  **sin PR de documentación de cierre** (convención D11 vigente).
- Ciclo SDD completo: plan + spec **aquí** → **aprobación** ⛔ → tasks → código →
  `/spec-check` → gates → docs.

---

## 4. Ficheros previstos

| Fichero | Acción |
|:---|:---|
| `src/components/ProductLightbox.tsx` | **nuevo** — visor modal + zoom |
| `src/lib/gallery-sizes.ts` | **nuevo** — `GALLERY_SIZES` (D3) |
| `src/components/ProductGallery.tsx` | **modificado** — `"use client"`, botones por celda, estado, monta el visor |
| `src/app/products/[reference]/page.tsx` | **modificado** — 1 línea: import de `GALLERY_SIZES` desde `lib` |
| `src/__tests__/ProductLightbox.test.tsx` | **nuevo** |
| `src/__tests__/ProductGallery.test.tsx` | **ampliado** — aserciones nuevas; las 6 actuales sin tocar |
| `e2e/a11y.spec.ts` | **ampliado** — +1 auditoría con el visor abierto |
| `CHANGELOG.md`, `AGENTS.md`, `MEMORY.md` | al cierre |

**Sin tocar**: `ProductImage.tsx`, `ProductCard.tsx`, manifiesto, `public/`,
`next.config`, `backend/`.

---

## 5. Estimación

- Tamaño: **S–M** (una pantalla de producto, sin datos nuevos).
- Bloques: visor (D4) · foco/teclado (D6) · zoom (D5) · integración rejilla (D2/D3)
  · tests (D8) · gate axe (D7) · gates de cierre + docs.
- Riesgos: **LCP/CLS** (mitigado: no se tocan `ProductImage` ni el grid y la caja
  del visor reserva aspecto) · **axe con diálogo abierto** (el +1 de D7 lo vuelve
  medible) · **imports de `GALLERY_SIZES`** (D3 acota el daño a 1 línea + tests).
