import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CatalogFilters from "@/components/CatalogFilters";
import type { ProductFilters } from "@/types/commerce";

/**
 * Tarea 4.1, R1 — panel de filtros del catálogo.
 *
 * Lo que protege (D1/D2 de specs/catalog-family-filters): la taxonomía se pinta
 * **tal y como la da el backend** y las selecciones se **acumulan**, porque el
 * backend combina familia/talla/color con AND. Un panel que reseteara todo al
 * cambiar de familia haría imposible llegar a esas combinaciones.
 */

const FAMILIES = [
    { family: "OUTERWEAR", productCount: 2 },
    { family: "KNITWEAR", productCount: 1 },
];
const SIZES = ["S", "M"];
const COLORS = ["Negro", "Beige"];

function pintar(filters: ProductFilters = {}, disabled = false) {
    const onChange = vi.fn();
    const view = render(
        <CatalogFilters
            families={FAMILIES}
            sizes={SIZES}
            colors={COLORS}
            filters={filters}
            onChange={onChange}
            disabled={disabled}
        />
    );
    return { ...view, onChange };
}

/** Los fieldsets salen en orden: Familia, Talla, Color, Orden. */
function grupos(container: HTMLElement) {
    return Array.from(container.querySelectorAll("fieldset"));
}

describe("CatalogFilters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("pinta las familias con el recuento que da el backend, sin derivarlas del listado", () => {
        // GIVEN un backend que reporta dos familias con sus recuentos
        // WHEN se pinta el panel
        const { container } = pintar();

        // THEN cada familia aparece con su recuento, en el orden dado
        const [familia] = grupos(container);
        expect(within(familia).getAllByRole("button")).toHaveLength(3); // Todas + 2 familias
        expect(within(familia).getByRole("button", { name: /OUTERWEAR/ })).toHaveTextContent("2");
        expect(within(familia).getByRole("button", { name: /KNITWEAR/ })).toHaveTextContent("1");
    });

    it("acumula: al elegir familia conserva talla, color y orden", async () => {
        // GIVEN filtros ya combinados por el usuario
        const user = userEvent.setup();
        const { onChange, container } = pintar({ size: "M", color: "Negro", sort: "name-asc" });

        // WHEN se elige una familia
        const [familia] = grupos(container);
        await user.click(within(familia).getByRole("button", { name: /OUTERWEAR/ }));

        // THEN sólo se añade `family`; el resto queda intacto (el backend hace AND)
        expect(onChange).toHaveBeenCalledWith({
            family: "OUTERWEAR",
            size: "M",
            color: "Negro",
            sort: "name-asc",
        });
    });

    it("«Todas» quita sólo la familia y deja intactos el resto", async () => {
        // GIVEN familia + talla + color a la vez
        const user = userEvent.setup();
        const { onChange, container } = pintar({ family: "OUTERWEAR", size: "M", color: "Negro" });
        const [familia] = grupos(container);

        // WHEN se pulsa «Todas» dentro del grupo de Familia
        await user.click(within(familia).getByRole("button", { name: "Todas" }));

        // THEN desaparece únicamente `family`
        expect(onChange).toHaveBeenCalledWith({ size: "M", color: "Negro" });
    });

    it("«Todos» quita sólo el color", async () => {
        const user = userEvent.setup();
        const { onChange, container } = pintar({ family: "OUTERWEAR", color: "Negro" });
        const [, , color] = grupos(container);

        await user.click(within(color).getByRole("button", { name: "Todos" }));

        expect(onChange).toHaveBeenCalledWith({ family: "OUTERWEAR" });
    });

    it("«Limpiar filtros» vacía todo de una vez", async () => {
        // GIVEN cuatro filtros activos
        const user = userEvent.setup();
        const { onChange } = pintar({
            family: "OUTERWEAR",
            size: "M",
            color: "Negro",
            sort: "name-desc",
        });

        // WHEN se pulsa «Limpiar filtros»
        await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

        // THEN el objeto de filtros queda vacío
        expect(onChange).toHaveBeenCalledWith({});
    });

    it("el botón «Limpiar filtros» sólo se pinta con filtros activos", () => {
        // GIVEN un panel sin ningún filtro
        const { rerender } = pintar();
        expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();

        // WHEN se activa un filtro
        rerender(
            <CatalogFilters
                families={FAMILIES}
                sizes={SIZES}
                colors={COLORS}
                filters={{ family: "OUTERWEAR" }}
                onChange={vi.fn()}
            />
        );

        // THEN aparece la vía para vaciarlo
        expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
    });

    it("un orden distinto de «Destacados» cuenta como filtro activo", () => {
        // GIVEN sólo un `sort` distinto del por defecto
        pintar({ sort: "name-asc" });

        // THEN hay filtros activos, aunque no haya familia/talla/color
        expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
    });

    it("con `disabled` bloquea la interacción para no acumular peticiones", () => {
        // GIVEN el panel mientras la página sigue cargando
        const { container } = pintar({}, true);

        // THEN el contenedor entero queda inerte
        expect(container.firstChild).toHaveClass("opacity-50");
        expect(container.firstChild).toHaveClass("pointer-events-none");
    });

    it("resalta con borde la opción activa y deja apagadas las demás", () => {
        // GIVEN una familia seleccionada
        const { container } = pintar({ family: "OUTERWEAR" });
        const [familia] = grupos(container);

        // THEN la elegida lleva el borde de activo y la otra queda transparente
        expect(within(familia).getByRole("button", { name: /OUTERWEAR/ })).toHaveClass(
            "border-neutral-900"
        );
        expect(within(familia).getByRole("button", { name: /KNITWEAR/ })).toHaveClass(
            "border-transparent"
        );
    });
});
