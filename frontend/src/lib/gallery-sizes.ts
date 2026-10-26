/**
 * `sizes` de la galería de la ficha (Tarea 3.3, R6; migrado aquí en la V2 — D3).
 *
 * <p>Derivado del layout real de la ficha — contenedor `max-w-6xl px-6`, tarjeta
 * `p-8 sm:p-12`, rejilla de 12 columnas con `md:gap-x-12` y galería de 2 columnas
 * con `gap-2`. El literal es **idéntico** al que vivía en
 * `components/ProductGallery.tsx`: no se recalcula.</p>
 *
 * <p>Cada tramo es el ancho medido de la imagen, **redondeado hacia arriba** para
 * que el navegador nunca pida menos de lo que ocupa la caja. Ojo: el ancho útil
 * es el del `<img>`, no el de su contenedor — el borde de la tarjeta resta
 * 2 px, y esos 2 px bastan para cruzar de bucket a DPR alto (278 px × 3 = 834
 * pediría `1080w` cuando `828w` ya es exacto).</p>
 *
 * <p>Vive en `lib/` porque la galería pasa a ser un componente **cliente** (V2)
 * y la ficha (servidor) consume este valor como **dato**, no como componente:
 * el grafo de servidor no puede importar valores de un módulo cliente.</p>
 *
 * <ul>
 *   <li>`<640px`: 1 columna, `px-6` (48) + borde (2) + `p-8` (64) →
 *       `100vw - 114px`</li>
 *   <li>`640–767px`: igual pero con `p-12` (96) → `100vw - 146px`</li>
 *   <li>`768–1166px`: 2 columnas dentro del `col-span-7` → `30vw - 60px`</li>
 *   <li>`≥1167px`: `max-w-6xl` deja de crecer → fijo `280px`</li>
 * </ul>
 */
export const GALLERY_SIZES =
    "(max-width: 639px) calc(100vw - 114px), " +
    "(max-width: 767px) calc(100vw - 146px), " +
    "(max-width: 1166px) calc(30vw - 60px), " +
    "280px";
