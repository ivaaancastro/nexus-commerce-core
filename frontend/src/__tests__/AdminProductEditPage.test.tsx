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
 */
describe("EdicionProductoPage (admin)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getAdminProduct).mockResolvedValue(producto);
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
});
