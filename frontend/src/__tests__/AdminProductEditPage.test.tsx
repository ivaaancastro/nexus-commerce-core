import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import EdicionProductoPage from "@/app/admin/products/[id]/edit/page";
import { api } from "@/lib/api";
import type { Product } from "@/types/commerce";

const push = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
    useParams: () => ({ id: "7" }),
    usePathname: () => "/admin/products/7/edit",
}));

vi.mock("@/lib/api", () => ({
    api: {
        getAdminProduct: vi.fn(),
        updateAdminProduct: vi.fn(),
        deleteAdminProduct: vi.fn(),
        createAdminSku: vi.fn(),
        updateAdminSku: vi.fn(),
        deleteAdminSku: vi.fn(),
        // Tarea 7.3: la ficha monta el bloque de precios por SKU (R7.1)
        getAdminSkuPrices: vi.fn(),
        updateAdminSkuPrice: vi.fn(),
    },
}));

const producto: Product = {
    id: 7,
    referenceCode: "7201/001",
    name: "Blazer Prueba 72",
    family: "OUTERWEAR",
    description: "Producto de prueba",
    skus: [{ id: 10, barcode: "720100000001", color: "Marino", size: "M" }],
};

/**
 * Tarea 7.2 (E.5/E.6) — edición de producto: carga, galería de solo lectura,
 * alta/edición/borrado de SKUs con su validación, y borrado del producto
 * con la traducción del 409.
 *
 * **Cambio declarado 7.3 (R8.4)**: la página monta ahora el bloque
 * «Precios por mercado», así que el mock gana `getAdminSkuPrices`/
 * `updateAdminSkuPrice` y `beforeEach` resuelve la lectura. Ninguna
 * aserción preexistente cambia: los botones de precio se llaman
 * «Guardar precio» para no colisionar con «Guardar» de SKUs.
 */
describe("EdicionProductoPage (admin)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getAdminProduct).mockResolvedValue(producto);
        // SKU 10 sin precios aún: los 4 mercados con nulls (frontera 7.2 D9)
        vi.mocked(api.getAdminSkuPrices).mockResolvedValue(
            ["CH", "ES", "UK", "US"].map((code) => ({
                marketCode: code,
                marketName: code,
                currency: code === "ES" ? "EUR" : "USD",
                taxRate: 21,
                basePrice: null,
                discountPrice: null,
                isActive: null,
            }))
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("carga el producto: referencia deshabilitada y galería documentada (R2.4/D5)", async () => {
        render(<EdicionProductoPage />);

        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();
        expect(screen.getByText(/Editar · 7201\/001/)).toBeInTheDocument();
        expect(api.getAdminProduct).toHaveBeenCalledWith(7);

        // La referencia es inmutable: el campo está deshabilitado
        expect(screen.getByLabelText("Referencia")).toBeDisabled();

        // Galería: sólo lectura, con la receta del manifiesto en la propia UI
        expect(screen.getByText(/npm run images/)).toBeInTheDocument();
    });

    it("valida el SKU en cliente antes de llamar a la API", async () => {
        const usuario = userEvent.setup();
        render(<EdicionProductoPage />);
        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: /nuevo sku/i }));
        await usuario.click(screen.getByRole("button", { name: /^crear sku$/i }));

        expect(screen.getByText("El código de barras es obligatorio.")).toBeInTheDocument();
        expect(api.createAdminSku).not.toHaveBeenCalled();
    });

    it("crea un SKU, muestra el toast y recarga el producto", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.createAdminSku).mockResolvedValue({
            id: 11,
            barcode: "720100000099",
            color: "Camel",
            size: "L",
        });

        render(<EdicionProductoPage />);
        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: /nuevo sku/i }));
        await usuario.type(screen.getByLabelText("Código de barras"), "720100000099");
        await usuario.type(screen.getByLabelText("Color"), "Camel");
        await usuario.type(screen.getByLabelText("Talla"), "L");
        await usuario.click(screen.getByRole("button", { name: /^crear sku$/i }));

        expect(await screen.findByText(/SKU 720100000099 añadido/)).toBeInTheDocument();
        expect(api.createAdminSku).toHaveBeenCalledWith(7, {
            barcode: "720100000099",
            color: "Camel",
            size: "L",
        });
        // La mutación sube la versión y el efecto recarga el detalle
        await waitFor(() =>
            expect(vi.mocked(api.getAdminProduct).mock.calls.length).toBeGreaterThan(1)
        );
    });

    it("edita un SKU inline sin tocar el código de barras", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.updateAdminSku).mockResolvedValue({
            id: 10,
            barcode: "720100000001",
            color: "Camel",
            size: "L",
        });

        render(<EdicionProductoPage />);
        expect(await screen.findByText("720100000001")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: "Editar" }));

        // El código de barras se muestra como dato inmutable, no como input
        expect(screen.getByText(/720100000001 · inmutable/)).toBeInTheDocument();
        expect(screen.queryByLabelText("Código de barras")).not.toBeInTheDocument();

        const color = screen.getByLabelText("Color");
        await usuario.clear(color);
        await usuario.type(color, "Camel");
        await usuario.click(screen.getByRole("button", { name: "Guardar" }));

        expect(await screen.findByText("SKU actualizado")).toBeInTheDocument();
        expect(api.updateAdminSku).toHaveBeenCalledWith(7, 10, {
            color: "Camel",
            size: "M",
        });
    });

    it("borrar un SKU pide confirmación y recarga el detalle", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.deleteAdminSku).mockResolvedValue(undefined);
        const confirmacion = vi.spyOn(window, "confirm").mockReturnValue(true);

        render(<EdicionProductoPage />);
        expect(await screen.findByText("720100000001")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: "Borrar" }));

        expect(confirmacion).toHaveBeenCalledTimes(1);
        expect(await screen.findByText(/SKU 720100000001 borrado/)).toBeInTheDocument();
        expect(api.deleteAdminSku).toHaveBeenCalledWith(7, 10);
    });

    it("borrar el producto con pedidos -> 409 traducido y se queda en la página", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.deleteAdminProduct).mockRejectedValue(
            new Error(
                'API Error [409]: {"status":409,"error":"Conflict",' +
                    '"code":"CATALOG_CONFLICT",' +
                    '"message":"No se puede borrar el producto 7201/001: tiene pedidos asociados"}'
            )
        );
        vi.spyOn(window, "confirm").mockReturnValue(true);

        render(<EdicionProductoPage />);
        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: /borrar producto/i }));

        expect(
            await screen.findByText(
                "No se puede borrar el producto 7201/001: tiene pedidos asociados"
            )
        ).toBeInTheDocument();
        expect(push).not.toHaveBeenCalled();
    });

    it("borrar el producto sin pedidos navega de vuelta al listado", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.deleteAdminProduct).mockResolvedValue(undefined);
        vi.spyOn(window, "confirm").mockReturnValue(true);

        render(<EdicionProductoPage />);
        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: /borrar producto/i }));

        expect(api.deleteAdminProduct).toHaveBeenCalledWith(7);
        expect(push).toHaveBeenCalledWith("/admin/products");
    });

    it("7.3: monta «Precios por mercado» con los 4 mercados del SKU (R7.1)", async () => {
        render(<EdicionProductoPage />);

        // El bloque existe y pide los precios de SU SKU
        expect(await screen.findByText("Precios por mercado")).toBeInTheDocument();
        expect(await screen.findByText("Variante M · Marino")).toBeInTheDocument();
        expect(api.getAdminSkuPrices).toHaveBeenCalledWith(10);

        // Los 4 mercados con su botón de guardado por fila
        expect(await screen.findAllByRole("button", { name: "Guardar precio" })).toHaveLength(4);
        // Sin precio aún: el input de ES sale vacío (señal de «crear»)
        expect(screen.getByLabelText("Precio base en ES")).toHaveValue(null);
    });
});
