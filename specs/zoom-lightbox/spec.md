# Spec: V2 — Zoom/lightbox en la galería de la ficha

> **Estado**: ✅ **APROBADA por el usuario — 2026-10-26** — en implementación
> **Fecha**: 2026-10-26
> **Rama**: `feat/zoom-lightbox`
> **Plan**: `specs/zoom-lightbox/plan.md` (D1–D9)

> **Alcance acordado en la hoja de ruta (bloque V1–V6, 2026-10-22)**: ampliar la
> galería de la ficha con **zoom/lightbox**, **revisando el criterio de la 3.3 que
> los excluía** y **sólo en frontend**. El grid vertical de la 3.3 se conserva.

---

## 1. Requisitos

### R1 — Gatillo por celda; `ProductImage` intocado

**Criterio**: cada imagen de la galería se puede ampliar sin tocar el componente
compartido.

- Cada celda de `ProductGallery` **con imagen real** envuelve su contenido en
  `<button type="button">` con `aria-label` en español del formato
  **«Ampliar imagen: {alt}»** (p. ej. «Ampliar imagen: Blazer Cruzada Estructura»).
- **`ProductImage.tsx` no se modifica**: la tarjeta del catálogo y la búsqueda
  siguen navegando con la imagen, sin comportamiento nuevo.
- **Placeholder sin manifiesto** (`src === undefined`) → la celda **no es botón**
  (no hay nada que ampliar): cero interacción, cero peticiones (R9 de la 3.3).
- El envoltorio **no altera atributos de carga**: `loading`, `fetchPriority` y
  `sizes` de cada imagen quedan idénticos a hoy (LCP intacto).

### R2 — Visor modal a pantalla completa

**Criterio**: al pulsar una celda se abre un diálogo modal con esa imagen.

- Componente **`src/components/ProductLightbox.tsx`** (cliente), montado por
  `ProductGallery` sólo cuando está abierto; se renderiza **al final del bloque
  de la galería** (no dentro de la rejilla).
- Overlay `fixed inset-0 z-[60]` — **por encima del header** (`z-50`) —, fondo
  `bg-neutral-950/95`, imagen centrada `object-contain`.
- La imagen grande va en caja **con relación de aspecto reservada** y
  `sizes="100vw"`: abrir el visor **no desplaza nada (CLS 0)** y no pide anchos de
  más.
- La imagen grande reutiliza **`ProductImage`** con el **mismo `alt`** que en la
  rejilla; si el fichero falla aparece el **mismo placeholder `ProductThumb`**
  (defensa en profundidad).
- Abre directamente en **el índice de la celda pulsada** (1ª celda → imagen 1).
- Sólo está montado **la imagen actual**; no hay prefetch de vecinas (No-Objetivos).

### R3 — Controles y navegación

**Criterio**: recorrer las imágenes del producto desde el visor.

- Controles lineales de la casa (`w-5 h-5` / `h-4 h-4`, stroke 1.5, texto blanco,
  hover a opacidad 70 %, `transition-all duration-300`, **`motion-reduce:transition-none`**):
  - **✕ Cerrar** arriba-derecha (`aria-label="Cerrar visor"`).
  - **‹ Anterior** / **Siguiente ›** a los lados, **sólo si `images.length > 1`**
    (`aria-label="Imagen anterior"` / `"Imagen siguiente"`).
  - **Contador** centrado abajo con el formato **«n / total»**.
- Navegación **circular**: en la primera, «‹» lleva a la última; en la última,
  «›» lleva a la primera.
- **Teclado** (mientras el visor está abierto): **←** = anterior, **›** = siguiente,
  **Escape** = cerrar.
- El contador lleva **`role="status"`** ⇒ cada cambio de imagen se anuncia a los
  lectores de pantalla.

### R4 — Cierre y bloqueo de scroll

**Criterio**: el visor se cierra por las tres vías y no deja efectos secundarios.

- Cierra con **✕**, con **Escape** y con **clic en el fondo**.
- **Guarda anti-arrastre**: el clic en el fondo sólo cierra si el pulsado *y* el
  soltado ocurrieron **sobre el fondo** (arrastrar desde la imagen hasta el fondo
  no cierra).
- Clic **sobre la imagen** no cierra (en móvil se navega con ‹ ›).
- Al abrir: **`document.body` pierde el scroll** (`overflow: hidden`); al cerrar
  se **restaura el valor anterior**, y también en *cleanup* si el componente se
  desmonta por navegación.
- Al cerrar: el **foco vuelve al botón de la celda** que lo abrió.

### R5 — Accesibilidad del diálogo

**Criterio**: el diálogo cumple el patrón modal esperado (patrón `CartDrawer`).

- `role="dialog"` + **`aria-modal="true"`** + `aria-label="Galería ampliada de
  producto"`.
- **Foco inicial**: botón ✕ al abrir.
- **Trampa de foco**: `Tab` y `Shift+Tab` circulan **sólo** dentro del diálogo
  (implementación propia, sin dependencia nueva).
- Todos los controles interactivos del visor son `<button>` con `aria-label` en
  español (WCAG 4.1.2).
- El **zoom (R6) no es necesario para acceder a la imagen** — es una mejora
  optativa de puntero; nada de información vive sólo en él.

### R6 — Zoom de escritorio (patrón lupa)

**Criterio**: en escritorio, la imagen del visor se amplía ×2 siguiendo al cursor.

- Condición de activación: **`@media (hover: hover) and (pointer: fine)`**. En
  puntero grueso/táctil **no hay zoom** (móvil ya la ve a pantalla completa).
- Sobre la imagen: **`cursor-zoom-in`** y `transform: scale(2)` con
  `transform-origin` en la **posición del cursor** dentro de la imagen
  (porcentajes recalculados al moverse).
- Al salir de la imagen: vuelve a `scale(1)` con la transición de la casa.
- **`motion-reduce`**: cambio de escala **sin transición**.
- No hay «modo zoom» persistente: es una **propiedad del hover**.
- **Pinch-zoom / doble-tap: fuera de alcance** (declarado en el plan No-Objetivos).

### R7 — Texto alternativo y anuncios

- Cada imagen del visor muestra el **mismo `alt`** que en la rejilla (R8 de la 3.3:
  nombre en la vista 1, «{nombre} — detalle n» en las demás) — **sin duplicar
  lógica**: se deriva de `imageAlt(name, index)`.
- El `aria-label` del gatillo cita ese `alt` (R1).
- El `role="status"` del contador anuncia «n / total» al navegar (R3).

### R8 — Cero regresión de la 3.3 y aislamiento de `GALLERY_SIZES`

**Criterio**: lo medido en la 3.3 sigue siendo cierto.

- `git diff` sobre `ProductImage.tsx`, `ProductCard.tsx`, manifiesto y
  `public/` → **vacío**.
- Grid (1 col / 2 col `md`, `gap-2`), **2 primeras `eager` + `fetchPriority="high"`**,
  `sizes` y placeholders: **sin cambios** — los **6 tests actuales** de
  `ProductGallery.test.tsx` pasan **sin que ninguna aserción preexistente cambie**
  (si alguna *query* exigiera ajuste por el wrapper, se declara **R8.3** en el test
  con diff = adiciones en lo posible).
- `ProductGallery.tsx` pasa a **`"use client"`** y, como consecuencia,
  **`GALLERY_SIZES` se muda a `src/lib/gallery-sizes.ts`** (mismo literal — no se
  recalcula): la ficha cambia **1 línea de import**; ningún otro consumidor.
- **`next.config` intocado** (`localPatterns` ya acota `/products/**`).

### R9 — Gate de accesibilidad: 14 → 15

**Criterio**: el visor abierto está auditado por axe, no sólo el cerrado.

- `e2e/a11y.spec.ts` añade **1 test**: abre la ficha, pulsa la primera celda y
  ejecuta la auditoría **con el visor abierto** (`audit(page, "… lightbox")`).
- Las **14 comprobaciones existentes no se tocan**; sin `axe.exclude()`, sin
  `disableRules`, sin supresiones (convención de la 4.3, D7).
- Resultado esperado: **15/15** en verde (sólo Chromium, como todo axe).

### R10 — Sólo frontend, sin ADR, sin PR de documentación

**Criterio**: fronteras del alcance.

- `git diff main --stat` **no** contiene nada bajo `backend/`; sin migración, sin
  entidad, sin DTO, sin endpoint, sin datos nuevos en el manifiesto.
- **No procede ADR**: no cambia stack ni arquitectura; es un componente de UI.
- El bloque «ESTADO ACTUAL» de `AGENTS.md`/`MEMORY.md` se redacta **en la feature
  PR**, formulado para ser verdad *después* del merge y **sin números de PR ni
  SHA** → **no habrá PR de documentación de cierre** (convención vigente D11).
- **Antes de escribir código**: leer la guía relevante de
  `frontend/node_modules/next/dist/docs/` (regla del AGENTS de frontend — Next
  16.3.7 tiene cambios respecto a versiones conocidas; verificar el contrato de
  `next/image` y las deprecaciones).

---

## 2. Modelo de Datos

**Sin cambios** — ni en BD ni en el manifiesto. El único «modelo» nuevo es el
estado de UI dentro de `ProductGallery`:

```
ProductGallery (cliente)
├── images        getProductImages(referenceCode)   ← misma fuente que hoy
├── abierto       boolean
├── índice        number (0-based)
└── triggerRef    HTMLElement | null   ← para devolver el foco al cerrar
```

---

## 3. Contratos

**API REST**: no aplica — no hay cambio de backend.

**Frontend**:

```ts
// src/lib/gallery-sizes.ts   (migración de ProductGallery — D3)
export const GALLERY_SIZES: string;   // literal idéntico al actual, sin recalcular
```

```tsx
// src/components/ProductLightbox.tsx
interface ProductLightboxProps {
    /** Rutas ya resueltas `/products/…` (mínimo 1). */
    images: string[];
    name: string;
    family: string;
    /** Índice 0-based con el que se abre. */
    index: number;
    setIndex: (i: number) => void;
    onClose: () => void;
}
// role="dialog" aria-modal; Escape/✕/fondo cierran; ‹ › circulan;
// contador role="status"; zoom ×2 sólo con (hover: hover) and (pointer: fine).
```

```tsx
// src/components/ProductGallery.tsx (props sin cambios)
interface ProductGalleryProps {
    referenceCode: string;
    name: string;
    family: string;
    sizes: string;
}
// Pasa a "use client"; cada celda con imagen real es un <button>;
// con [] (sin manifiesto) se comporta exactamente como hoy.
```

---

## 4. Criterios de Aceptación

- [ ] **R1**: cada celda con imagen es `<button>` con `aria-label` «Ampliar imagen:
      {alt}» → test
- [ ] **R1**: la celda placeholder **no** es botón → test
- [ ] **R1**: `ProductImage.tsx` con diff vacío → grep/diff
- [ ] **R2**: clic en la 2ª celda → visor abierto mostrando la imagen 2 → test
- [ ] **R2**: la imagen del visor lleva `sizes="100vw"` y caja con aspecto
      reservado → test
- [ ] **R2**: el `alt` del visor es el de la rejilla → test
- [ ] **R3**: ‹ › navegan con **wrap** en extremos; con 1 sola imagen **no** hay
      ‹ › → test
- [ ] **R3**: ←/→ y Escape se manejan con el visor abierto → test
- [ ] **R3**: contador con `role="status"` y formato «n / total» → test
- [ ] **R4**: ✕, Escape y clic en el fondo cierran → test
- [ ] **R4**: clic que empieza en la imagen y acaba en el fondo **no** cierra → test
- [ ] **R4**: `body` se bloquea al abrir y **se restaura** al cerrar (y en
      *cleanup*) → test
- [ ] **R4**: al cerrar, el foco **vuelve al gatillo** → test
- [ ] **R5**: `role="dialog"` + `aria-modal` + `aria-label` → test
- [ ] **R5**: foco inicial en ✕ y **trampa** de Tab/Shift+Tab → test
- [ ] **R6**: con puntero fino, hover ⇒ `scale(2)` con origen en el cursor; al
      salir ⇒ `scale(1)` → test (con `matchMedia` simulado)
- [ ] **R6**: sin `pointer: fine` **no** se aplica zoom → test
- [ ] **R6**: `motion-reduce` presente en las transiciones del visor → grep
- [ ] **R7**: gatillo, imagen y contador anuncian lo esperado → test (aserciones
      de rol/accessible name)
- [ ] **R8**: los **6 tests** de `ProductGallery` siguen verdes **sin tocar
      aserciones** → ejecución (R8.3 si algo tocado, declarada)
- [ ] **R8**: `GALLERY_SIZES` vive en `src/lib/gallery-sizes.ts` con literal
      **idéntico** → test + grep de imports
- [ ] **R8**: LCP: las 2 primeras siguen `eager` + `fetchPriority="high"` → test
      preexistente intacto
- [ ] **R9**: axe **15/15** (las 14 originales + PDP con visor abierto) →
      `npm run audit:a11y`
- [ ] **R10**: `git diff main --stat` sin `backend/` → grep
- [ ] **R10**: sin ADR nuevo y sin PR de documentación de cierre → revisión
- [ ] Guía de Next 16 leída antes de código (`node_modules/next/dist/docs/`) →
      revisión en tasks
- [ ] `npx tsc --noEmit` 0 · ESLint 0 errores/0 warnings · `npm run build` 0 ·
      `npx vitest run` en verde (**470 + los nuevos**) · E2E rápido **25/25**

---

## 5. Casos de Error

| Caso | Comportamiento esperado |
|:---|:---|
| Referencia sin manifiesto (`[]`) | Igual que hoy: una caja placeholder, **sin botones y sin visor** (R9 de la 3.3 intacta) |
| Fichero borrado tras el manifiesto | `onError` → `ProductThumb` **también en el visor** (mismo `ProductImage`) |
| Un solo archivo en manifiesto | Visor sin ‹ ›, contador «1 / 1» |
| Cerrar y reabrir rápido | Estado derivado (`abierto`/`índice`) sin carreras: el índice se fija al abrir desde la celda |
| Navegar de ruta con el visor abierto | *cleanup*: foco razonable, `body` restaurado, sin listeners huérfanos |
| Escritorio sin puntero fino (VM, tablet) | Visor y navegación íntegros, **sin zoom** — nunca un estado roto |
| `Tab` fuera del diálogo | La trampa lo devuelve: el foco no cae detrás de la capa |
| Arrastre imagen → fondo | **No cierra** (guarda anti-arrastre de R4) |
| Imagen que crece al cargar | Caja con aspecto reservado ⇒ **CLS 0** al abrir |
| Reordenar la rejilla o meter un carrusel | **Fuera de alcance** — la 3.3 y su scroll vertical siguen vigentes (D1) |
| Pinch-zoom en móvil | **Fuera de alcance** — escrito, no prometido (R6) |
| Tocar `ProductImage` para «reutilizar el botón» | **Prohibido** — se comparte con tarjeta/buscador (R1) |
| Suprimir reglas de axe si el diálogo choca | **Prohibido** — arreglar el diálogo (R9) |

---

## 6. Trazabilidad

| Req | Frontend | Tests |
|:---|:---|:---|
| R1 | `ProductGallery.tsx` (wrappers `button`) | `ProductGallery.test.tsx` |
| R2 | `ProductLightbox.tsx`, `ProductGallery.tsx` | `ProductLightbox.test.tsx` |
| R3 | `ProductLightbox.tsx` (controles + keys) | `ProductLightbox.test.tsx` |
| R4 | `ProductLightbox.tsx` (cierre, scroll, foco) | `ProductLightbox.test.tsx` |
| R5 | `ProductLightbox.tsx` (dialog, trampa) | `ProductLightbox.test.tsx` |
| R6 | `ProductLightbox.tsx` (zoom hover) | `ProductLightbox.test.tsx` |
| R7 | `ProductGallery.tsx` + `ProductLightbox.tsx` | ambos tests |
| R8 | `lib/gallery-sizes.ts` · `page.tsx` (1 import) | `ProductGallery.test.tsx` (los 6 intactos) + test de literal |
| R9 | — | `e2e/a11y.spec.ts` (+1) → `npm run audit:a11y` |
| R10 | `CHANGELOG.md` / `AGENTS.md` / `MEMORY.md` al cierre | revisión + `git diff` |
