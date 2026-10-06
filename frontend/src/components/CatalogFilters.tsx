"use client";

import { FamilyResponse, ProductFilters, SortOption } from "@/types/commerce";

interface CatalogFiltersProps {
    /** Familias con su recuento. Pintadas SIEMPRE desde el backend, nunca derivadas de la lista. */
    families: FamilyResponse[];
    /** Tallas derivadas de la respuesta del catálogo, no de un catálogo fijo en cliente. */
    sizes: string[];
    colors: string[];
    filters: ProductFilters;
    onChange: (next: ProductFilters) => void;
    /** Mientras carga, se deshabilita la interacción para no acumular peticiones. */
    disabled?: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "default", label: "Destacados" },
    { value: "name-asc", label: "Nombre A → Z" },
    { value: "name-desc", label: "Nombre Z → A" },
];

const hayFiltrosActivos = (filters: ProductFilters) =>
    Boolean(filters.family || filters.size || filters.color || (filters.sort && filters.sort !== "default"));

/**
 * Tarea 3.1, R4 — panel de filtros del catálogo.
 *
 * El mismo componente se usa en la columna lateral de escritorio y dentro del
 * panel que abre «Filtrar» en móvil: no hay dos implementaciones que puedan
 * divergir.
 *
 * Tres decisiones que viven aquí y no en la página:
 *
 * - **La taxonomía viene del servidor.** La lista de familias se pinta de
 *   `GET /products/families` con sus recuentos, no de un `Set` calculado sobre
 *   los productos cargados. Si mañana cambia la semilla, el menú cambia solo.
 * - **Tallas y colores salen de la respuesta**, porque son dato de los SKUs
 *   realmente disponibles y no un catálogo fijo. Si un filtro deja 0 productos,
 *   la opción elegida se mantiene visible para poder deseleccionarla — es justo
 *   lo que necesita el estado vacío de R10.
 * - **Las selecciones se acumulan, no se sustituyen.** Cada opción sólo toca su
 *   campo y el resto se conserva; el backend combina los tres con AND (R2) y un
 *   panel que reseteara todo al cambiar de familia haría imposible llegar a esa
 *   combinación. «Todas/Todos» quita sólo su campo y «Limpiar filtros» vacía
 *   todo de una vez.
 */
export default function CatalogFilters({
    families,
    sizes,
    colors,
    filters,
    onChange,
    disabled = false,
}: CatalogFiltersProps) {
    const activos = hayFiltrosActivos(filters);

    /** Fusiona: cambia sólo lo que se le pide y conserva el resto. */
    const combinar = (parcial: Partial<ProductFilters>) => onChange({ ...filters, ...parcial });

    /** Quita un único campo dejando intactos los demás. */
    const quitar = (campo: keyof ProductFilters) => onChange({ ...filters, [campo]: undefined });

    const opcion = (activo: boolean) =>
        [
            "block w-full text-left text-xs uppercase tracking-wide py-1.5 pl-3 border-l-2 transition-all duration-300",
            activo
                ? "border-neutral-900 text-neutral-900 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300",
        ].join(" ");

    const casilla = (activo: boolean) =>
        `min-w-9 h-9 px-2 border text-[11px] uppercase tracking-wide transition-all duration-300 ${
            activo
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
        }`;

    return (
        <div className={`space-y-8 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
            {activos && (
                <button
                    type="button"
                    onClick={() => onChange({})}
                    className="text-[10px] uppercase tracking-widest text-neutral-500 underline underline-offset-4 hover:text-neutral-900 transition-colors"
                >
                    Limpiar filtros
                </button>
            )}

            <fieldset>
                <legend className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
                    Familia
                </legend>
                <div>
                    <button
                        type="button"
                        onClick={() => quitar("family")}
                        className={opcion(!filters.family)}
                    >
                        Todas
                    </button>
                    {families.map((item) => (
                        <button
                            key={item.family}
                            type="button"
                            onClick={() => combinar({ family: item.family })}
                            className={opcion(filters.family === item.family)}
                        >
                            {item.family}
                            <span className="ml-2 text-[10px] text-neutral-400">
                                {item.productCount}
                            </span>
                        </button>
                    ))}
                </div>
            </fieldset>

            <fieldset>
                <legend className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
                    Talla
                </legend>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => quitar("size")}
                        className={casilla(!filters.size)}
                    >
                        Todas
                    </button>
                    {sizes.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => combinar({ size: value })}
                            className={casilla(filters.size === value)}
                        >
                            {value}
                        </button>
                    ))}
                </div>
            </fieldset>

            <fieldset>
                <legend className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
                    Color
                </legend>
                <div>
                    <button
                        type="button"
                        onClick={() => quitar("color")}
                        className={opcion(!filters.color)}
                    >
                        Todos
                    </button>
                    {colors.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => combinar({ color: value })}
                            className={opcion(filters.color === value)}
                        >
                            {value}
                        </button>
                    ))}
                </div>
            </fieldset>

            <fieldset>
                <legend className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
                    Orden
                </legend>
                <div>
                    {SORT_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => combinar({ sort: option.value })}
                            className={opcion((filters.sort ?? "default") === option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </fieldset>
        </div>
    );
}
