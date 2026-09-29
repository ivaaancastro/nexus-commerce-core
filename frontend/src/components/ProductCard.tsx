import { Product, SemanticSearchResult } from "@/types/commerce";

interface ProductCardProps {
    product?: Product;
    semanticItem?: SemanticSearchResult;
}

export default function ProductCard({ product, semanticItem }: ProductCardProps) {
    const name = product?.name || semanticItem?.name || "Prenda Nexus";
    const reference = product?.referenceCode || semanticItem?.referenceCode || "0000/000";
    const family = product?.family || semanticItem?.family || "CATÁLOGO";
    const description = product?.description || semanticItem?.description;
    const similarity = semanticItem?.similarityScore;

    return (
        <article className="group flex flex-col justify-between border border-neutral-200 bg-white p-6 hover:border-black transition-all duration-300">
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

                <button className="w-full mt-6 bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-900 text-xs uppercase tracking-widest py-2.5 transition-colors duration-200">
                    Ver Detalle
                </button>
            </div>
        </article>
    );
}