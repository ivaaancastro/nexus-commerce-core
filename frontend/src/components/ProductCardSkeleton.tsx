import Skeleton from "./Skeleton";

/**
 * Skeleton de tarjeta de producto para el grid del catálogo.
 * Mantiene la misma estructura visual que ProductCard para evitar layout shifts.
 */
export default function ProductCardSkeleton() {
    return (
        <article className="flex flex-col justify-between border border-neutral-200 bg-white p-6">
            <div>
                {/* REF + Badge */}
                <div className="flex items-start justify-between mb-4">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-12" />
                </div>

                {/* Familia + Nombre */}
                <div className="mb-2">
                    <Skeleton className="h-3 w-16 mb-2" />
                    <Skeleton className="h-5 w-3/4" />
                </div>

                {/* Descripción */}
                <div className="space-y-2 mb-6">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-2/3" />
                </div>
            </div>

            <div>
                {/* Tallas */}
                <div className="pt-4 border-t border-neutral-100">
                    <Skeleton className="h-3 w-24 mb-2" />
                    <div className="flex flex-wrap gap-1.5">
                        <Skeleton className="h-6 w-8" />
                        <Skeleton className="h-6 w-8" />
                        <Skeleton className="h-6 w-8" />
                        <Skeleton className="h-6 w-8" />
                    </div>
                </div>

                {/* Botón */}
                <Skeleton className="h-10 w-full mt-6" />
            </div>
        </article>
    );
}
