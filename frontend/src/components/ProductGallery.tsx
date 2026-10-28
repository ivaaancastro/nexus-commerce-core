"use client";

import { useRef, useState } from "react";
import ProductImage from "@/components/ProductImage";
import ProductLightbox from "@/components/ProductLightbox";
import { getProductImages, imageAlt } from "@/lib/product-images";

interface ProductGalleryProps {
    referenceCode: string;
    name: string;
    family: string;
    /** `sizes` de las imágenes (R6 de la 3.3); lo decide la página que la monta. */
    sizes: string;
    /** Color activo (V6): si tiene fotos propias, la galería las muestra. */
    color?: string;
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
 * Galería de la ficha de producto (Tarea 3.3, R7; **ampliada en la V2** con
 * lightbox — `specs/zoom-lightbox/`).
 *
 * <p>1 columna por debajo de 768px y 2 columnas a partir de ahí, con `gap-2`.
 * El scroll vertical **no cambia**: la V2 sólo añade un botón por celda que
 * abre el visor {@link ProductLightbox} con la imagen pulsada (D2 —
 * `ProductImage` se comparte con tarjeta y buscador, así que no se toca).</p>
 *
 * <p>Si el manifiesto no tiene la referencia se pinta **una sola** caja de
 * placeholder **fuera de ningún botón**: no hay nada que ampliar, la ficha
 * conserva su layout y no se pide ningún fichero (R9 de la 3.3).</p>
 *
 * <p>Este componente pasa a cliente en la V2 (estado del visor), así que
 * `GALLERY_SIZES` vive ahora en `src/lib/gallery-sizes.ts`: la página (servidor)
 * lo consume como valor y el grafo de servidor no importa de módulos cliente.</p>
 */
export default function ProductGallery({
    referenceCode,
    name,
    family,
    sizes,
    color,
}: ProductGalleryProps) {
    const images = getProductImages(referenceCode, color);
    const items: (string | undefined)[] =
        images.length > 0 ? images : [undefined];

    const [abierto, setAbierto] = useState(false);
    const [indice, setIndice] = useState(0);
    /** Botón que abrió el visor: a él vuelve el foco al cerrar (R4 de la V2). */
    const gatilloRef = useRef<HTMLButtonElement | null>(null);

    return (
        <>
            <div
                className="grid grid-cols-1 md:grid-cols-2 gap-2"
                data-testid="product-gallery"
            >
                {items.map((src, index) => {
                    const alt = imageAlt(name, index);
                    const imagen = (
                        <ProductImage
                            key={src ?? "placeholder"}
                            src={src}
                            alt={alt}
                            sizes={sizes}
                            name={name}
                            family={family}
                            eager={index < EAGER_IMAGES}
                        />
                    );
                    if (!src) return imagen;
                    return (
                        <button
                            key={src}
                            type="button"
                            aria-label={`Ampliar imagen: ${alt}`}
                            className="block w-full cursor-zoom-in"
                            onClick={(e) => {
                                gatilloRef.current = e.currentTarget;
                                setIndice(index);
                                setAbierto(true);
                            }}
                        >
                            {imagen}
                        </button>
                    );
                })}
            </div>
            {abierto && (
                <ProductLightbox
                    images={images}
                    name={name}
                    family={family}
                    index={indice}
                    setIndex={setIndice}
                    onClose={() => {
                        setAbierto(false);
                        gatilloRef.current?.focus();
                    }}
                />
            )}
        </>
    );
}
