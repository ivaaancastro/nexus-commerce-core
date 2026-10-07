"use client";

import { useState } from "react";
import Image from "next/image";
import ProductThumb from "@/components/ProductThumb";

interface ProductImageProps {
    /** Ruta ya resuelta (`/products/…`); `undefined` → placeholder. */
    src: string | undefined;
    /** Texto alternativo (R8). */
    alt: string;
    /** Obligatorio: sin él el navegador asume `100vw` y descarga de más (R6). */
    sizes: string;
    /** Nombre del producto: alimenta el `data-product-name` del placeholder. */
    name: string;
    /** Familia textil: lo que se escribe dentro del placeholder. */
    family: string;
    /**
     * Sólo para la primera imagen de la galería, que es el LCP de la ficha.
     *
     * <p>Usa `loading="eager"` + `fetchPriority="high"` en vez de `priority`,
     * que está **deprecada desde Next 16**. Tampoco `preload`: en una galería
     * varias imágenes pueden ser LCP según el viewport (R6).</p>
     */
    eager?: boolean;
}

/**
 * Imagen de producto con reserva de aspecto y fallback (Tarea 3.3, R4).
 *
 * <p>Contenedor `aspect-[3/4]` + `<Image fill>`: el espacio está reservado
 * antes de que la imagen llegue, así que **no hay desplazamiento de layout** y
 * no hacen falta `width`/`height`.</p>
 *
 * <p>El placeholder es decorativo (`aria-hidden`, igual que `ProductThumb`):
 * el nombre del producto está visible junto a la imagen en los tres puntos de
 * uso — tarjeta, ficha y buscador —, así que no se pierde información.</p>
 */
export default function ProductImage({
    src,
    alt,
    sizes,
    name,
    family,
    eager = false,
}: ProductImageProps) {
    // Fallo de carga: misma respuesta que "no hay imagen", sin reintentos.
    const [failed, setFailed] = useState(false);

    if (!src || failed) {
        return (
            <div
                className="relative w-full aspect-[3/4] bg-neutral-100"
                data-testid="product-image-fallback"
            >
                <ProductThumb
                    name={name}
                    family={family}
                    className="absolute inset-0"
                />
            </div>
        );
    }

    return (
        <div
            className="relative w-full aspect-[3/4] bg-neutral-100 overflow-hidden"
            data-testid="product-image"
        >
            <Image
                src={src}
                alt={alt}
                fill
                sizes={sizes}
                loading={eager ? "eager" : "lazy"}
                fetchPriority={eager ? "high" : undefined}
                className="object-cover"
                onError={() => setFailed(true)}
            />
        </div>
    );
}
