import ProductImage from "@/components/ProductImage";
import { getProductImages, imageAlt } from "@/lib/product-images";

interface ProductGalleryProps {
    referenceCode: string;
    name: string;
    family: string;
    /** `sizes` de las imágenes (R6); lo decide la página que la monta. */
    sizes: string;
}

/**
 * Cuántas imágenes de la cabeza de la galería van `eager`.
 *
 * <p>2 es la primera fila en escritorio (`md:grid-cols-2`); en móvil, donde
 * sólo se ve una, se adelanta la segunda — unos 10 KB que no compensan dejar
 * la mitad visible de una imagen diferida.</p>
 *
 * <p>Con todas las imágenes con el mismo tamaño, el navegador resuelve el LCP
 * por un empate de pintado: si la que gana queda `lazy`, Next 16 avisa en
 * desarrollo. Con las dos primeras eager eso no puede pasar.</p>
 */
const EAGER_IMAGES = 2;

/**
 * `sizes` de la galería (R6), derivado del layout real de la ficha —
 * contenedor `max-w-6xl px-6`, tarjeta `p-8 sm:p-12`, rejilla de 12 columnas
 * con `md:gap-x-12` y galería de 2 columnas con `gap-2`.
 *
 * <p>Cada tramo es el ancho medido de la imagen, **redondeado hacia arriba** para
 * que el navegador nunca pida menos de lo que ocupa la caja. Ojo: el ancho útil
 * es el del `<img>`, no el de su contenedor — el borde de la tarjeta resta
 * 2 px, y esos 2 px bastan para cruzar de bucket a DPR alto (278 px × 3 = 834
 * pediría `1080w` cuando `828w` ya es exacto).</p>
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

/**
 * Galería de la ficha de producto (Tarea 3.3, R7).
 *
 * <p>1 columna por debajo de 768px y 2 columnas a partir de ahí, con `gap-2`.
 * Es un bloque vertical sin lightbox ni carrusel, en línea con el scroll puro
 * que ya elegimos para la navegación del catálogo.</p>
 *
 * <p>Si el manifiesto no tiene la referencia se pinta **una sola** caja de
 * placeholder: la ficha conserva su layout y no se pide ningún fichero (R9).</p>
 */
export default function ProductGallery({
    referenceCode,
    name,
    family,
    sizes,
}: ProductGalleryProps) {
    const images = getProductImages(referenceCode);
    const items: (string | undefined)[] =
        images.length > 0 ? images : [undefined];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2" data-testid="product-gallery">
            {items.map((src, index) => (
                <ProductImage
                    key={src ?? "placeholder"}
                    src={src}
                    alt={imageAlt(name, index)}
                    sizes={sizes}
                    name={name}
                    family={family}
                    eager={index < EAGER_IMAGES}
                />
            ))}
        </div>
    );
}
