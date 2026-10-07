import Link from "next/link";
import { Product, SemanticSearchResult } from "@/types/commerce";
import ProductImage from "@/components/ProductImage";
import { getProductImages } from "@/lib/product-images";

/**
 * `sizes` de la tarjeta en `/catalog`.
 *
 * <p>Contenedor `max-w-7xl px-6`, `flex gap-10` con un `aside w-56` que sólo
 * aparece en `lg`, y rejilla `1 / sm:2 / xl:3 gap-6`. Cada tramo es el ancho
 * real de la imagen medido en el navegador — se redondea **siempre hacia
 * arriba** para que el navegador nunca pida una imagen más pequeña de la caja
 * y salga movida:</p>
 *
 * <ul>
 *   <li>`<640px`: 1 columna a ancho de tarjeta → `100vw - 50px`
 *       (`px-6` 48 + borde 2)</li>
 *   <li>`640–1023px`: 2 columnas, sin `aside` → `50vw - 44px`</li>
 *   <li>`1024–1279px`: 2 columnas con `aside` → `50vw - 176px`</li>
 *   <li>`≥1280px`: 3 columnas; `max-w-7xl` deja de crecer → fijo `307px`</li>
 * </ul>
 */
export const CATALOG_CARD_SIZES =
    "(max-width: 639px) calc(100vw - 50px), " +
    "(max-width: 1023px) calc(50vw - 44px), " +
    "(max-width: 1279px) calc(50vw - 176px), " +
    "307px";

/**
 * `sizes` de la tarjeta en `/search`.
 *
 * <p>Mismo contenedor `max-w-7xl px-6` pero **sin columna lateral**, con rejilla
 * `1 / sm:2 / lg:3 gap-6`:</p>
 *
 * <ul>
 *   <li>`<640px`: `100vw - 50px`</li>
 *   <li>`640–1023px`: `50vw - 44px`</li>
 *   <li>`1024–1294px`: 3 columnas creciendo → `100vw / 3 - 37px`</li>
 *   <li>`≥1295px`: el contenedor ya no crece → fijo `395px`</li>
 * </ul>
 */
export const SEARCH_CARD_SIZES =
    "(max-width: 639px) calc(100vw - 50px), " +
    "(max-width: 1023px) calc(50vw - 44px), " +
    "(max-width: 1294px) calc(100vw / 3 - 37px), " +
    "395px";

/**
 * Cuántas tarjetas de la cabeza de la rejilla van `eager`.
 *
 * <p>Es la primera fila en todos los breakpoints del proyecto: 3 columnas es el
 * máximo (`xl:grid-cols-3` en `/catalog`, `lg:grid-cols-3` en `/search`), y por
 * debajo se ve una sola columna, así que como mucho se adelantan 2 imágenes
 * adicionales — irrelevante, el manifiesto pesa ~10 KB por fichero fuente.</p>
 *
 * <p>Se adelantan por dos razones: están por encima del pliegue y, con todos
 * los tamaños idénticos, el navegador resuelve el LCP por un empate de pintado.
 * Si alguna queda `lazy`, Next 16 avisa en desarrollo de que una imagen
 * diferida ha ganado el LCP.</p>
 */
export const EAGER_CARDS = 3;

interface ProductCardProps {
    product?: Product;
    semanticItem?: SemanticSearchResult;
    /**
     * Las tarjetas de la primera fila (ver {@link EAGER_CARDS}). El resto va
     * `lazy` para no descargar las que están fuera del pliegue.
     */
    eager?: boolean;
    /**
     * Valor de `sizes` de la imagen (R6).
     *
     * <p>Debe corresponder con la rejilla que monta la tarjeta: si no se pasa,
     * el navegador asume `100vw` y descarga una imagen mucho mayor de la
     * necesaria.</p>
     */
    sizes?: string;
}

export default function ProductCard({
    product,
    semanticItem,
    sizes = CATALOG_CARD_SIZES,
    eager = false,
}: ProductCardProps) {
    const name = product?.name || semanticItem?.name || "Prenda Nexus";
    const reference = product?.referenceCode || semanticItem?.referenceCode || "0000/000";
    const family = product?.family || semanticItem?.family || "CATÁLOGO";
    const description = product?.description || semanticItem?.description;
    const similarity = semanticItem?.similarityScore;

    // Codificamos la referencia para soportar barras en la URL (ej: 0432/021 -> 0432%2F021)
    const productHref = `/products/${encodeURIComponent(reference)}`;

    return (
        <article className="group flex flex-col border border-neutral-200 bg-white hover:border-black transition-all duration-300">
            <ProductImage
                src={getProductImages(reference)[0]}
                alt={name}
                sizes={sizes}
                name={name}
                family={family}
                eager={eager}
            />

            <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                    <div className="flex items-start justify-between mb-4">
                        <span className="text-[10px] tracking-widest uppercase text-neutral-400">
                            REF. {reference}
                        </span>
                        {similarity !== undefined && (
                            <span className="bg-neutral-100 text-neutral-900 text-[10px] tracking-wider uppercase px-2 py-0.5 font-medium border border-neutral-300">
                                Match {(similarity * 100).toFixed(0)}%
                            </span>
                        )}
                    </div>

                    <div className="mb-2">
                        <span className="text-[11px] uppercase tracking-wider text-neutral-500 block mb-1">
                            {family}
                        </span>
                        <h3 className="text-base font-medium tracking-tight text-neutral-900 group-hover:text-black">
                            {name}
                        </h3>
                    </div>

                    {description && (
                        <p className="text-xs text-neutral-600 line-clamp-3 mb-6 font-light leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>

                <div>
                    {product?.skus && product.skus.length > 0 && (
                        <div className="pt-4 border-t border-neutral-100">
                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-2">
                                Tallas Disponibles
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {product.skus.map((sku) => (
                                    <span
                                        key={sku.id}
                                        className="text-[11px] uppercase px-2 py-0.5 border border-neutral-200 text-neutral-700 bg-neutral-50"
                                    >
                                        {sku.size}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <Link
                        href={productHref}
                        className="block text-center w-full mt-6 bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-900 text-xs uppercase tracking-widest py-2.5 transition-colors duration-200"
                    >
                        Ver Detalle
                    </Link>
                </div>
            </div>
        </article>
    );
}
