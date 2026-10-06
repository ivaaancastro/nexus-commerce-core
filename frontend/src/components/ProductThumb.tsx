interface ProductThumbProps {
    /** Nombre del producto. El texto se muestra al lado, así que la caja es decorativa. */
    name: string;
    /** Familia textil: es lo que se pinta dentro de la caja. */
    family: string;
    /** Talla opcional, se añade a la familia si se pasa. */
    size?: string;
    /** Tamaño de la caja; varía según la pantalla que la usa. */
    className?: string;
}

/**
 * Placeholder visual de producto (Tarea 5.5, R8).
 *
 * <p>El proyecto **no tiene ni una imagen**: `Product` no tiene campo de imagen,
 * `public/` solo contiene los SVG de Next y `CartItem.imageUrl` nunca se asigna.
 * Esta caja reutiliza el fallback que ya usaba `CartItemRow`, de modo que
 * carrito, historial y ficha de pedido se vean idénticos.</p>
 *
 * <p>Si algún día llega un dataset de fotos, el cambio se acota a este
 * componente: los tres sitios ya lo consumen.</p>
 *
 * <p>Decorativa (`aria-hidden`): el nombre del producto se escribe al lado,
 * anunciarlo dos veces solo añade ruido.</p>
 */
export default function ProductThumb({
    name,
    family,
    size,
    className = "w-20 h-24",
}: ProductThumbProps) {
    void name;

    return (
        <div
            aria-hidden="true"
            data-testid="product-thumb"
            data-product-name={name}
            className={`bg-neutral-100 flex-shrink-0 overflow-hidden flex items-center justify-center ${className}`}
        >
            <span className="text-[10px] uppercase tracking-wider text-neutral-400 text-center leading-tight px-2">
                {size ? `${family} · ${size}` : family}
            </span>
        </div>
    );
}
