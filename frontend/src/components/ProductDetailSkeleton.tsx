import Skeleton from "./Skeleton";

/**
 * Skeleton de la página de detalle de producto (PDP).
 *
 * <p>Replica el layout de la Tarea 3.3: galería a la izquierda (`col-span-7`),
 * panel de compra a la derecha (`col-span-5`, `sticky`) y descripción bajo la
 * galería, para que no haya desplazamiento de layout al llegar los datos.</p>
 */
export default function ProductDetailSkeleton() {
    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            {/* Header placeholder */}
            <div className="border-b border-neutral-200 bg-white">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>

            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
                {/* Breadcrumb */}
                <Skeleton className="h-3 w-32 mb-6" />

                <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-x-12 bg-white border border-neutral-200 p-8 sm:p-12">
                    {/* Galería: 1 columna en móvil, 2 en escritorio */}
                    <div className="md:col-start-1 md:col-span-7 md:row-start-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Skeleton className="w-full aspect-[3/4] rounded-none" />
                            <Skeleton className="w-full aspect-[3/4] rounded-none" />
                            <Skeleton className="w-full aspect-[3/4] rounded-none" />
                        </div>
                    </div>

                    {/* Panel de compra */}
                    <div className="md:col-start-8 md:col-span-5 md:row-start-1 md:row-span-2 md:self-start md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto">
                        <Skeleton className="h-3 w-40 mb-2" />
                        <Skeleton className="h-8 w-3/4 mb-6" />

                        {/* Precio */}
                        <div className="pb-6 border-b border-neutral-200">
                            <Skeleton className="h-8 w-28" />
                            <Skeleton className="h-3 w-48 mt-2" />
                        </div>

                        {/* Tallas */}
                        <div className="py-6">
                            <Skeleton className="h-3 w-28 mb-3" />
                            <div className="grid grid-cols-4 gap-2">
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                            </div>
                            <Skeleton className="h-3 w-32 mt-2" />
                        </div>

                        {/* Stock Omnicanal */}
                        <div className="pt-6 border-t border-neutral-100">
                            <Skeleton className="h-3 w-48 mb-3" />
                            <div className="space-y-2">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        </div>

                        {/* Botón de compra */}
                        <div className="pt-6">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-3 w-40 mx-auto mt-4" />
                        </div>
                    </div>

                    {/* Descripción bajo la galería */}
                    <div className="md:col-start-1 md:col-span-7 md:row-start-2 border-t border-neutral-200 pt-8">
                        <div className="space-y-3 text-xs leading-relaxed">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-11/12" />
                            <Skeleton className="h-3 w-4/5" />
                        </div>
                        <Skeleton className="h-3 w-2/3 mt-4" />
                    </div>
                </div>
            </main>
        </div>
    );
}
