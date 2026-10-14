import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminProductsPage from "@/app/admin/products/page";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import type { Product } from "@/types/commerce";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useParams: vi.fn(),
    usePathname: () => "/admin/products",
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMarkets: vi.fn(),
        listAdminProducts: vi.fn(),
        deleteAdminProduct: vi.fn(),
    },
}));

const producto: Product = {
    id: 1,
    referenceCode: "7201/001",
    name: "Blazer Prueba 72",
    family: "OUTERWEAR",
    description: "Producto de prueba",
    skus: [
        { id: 10, barcode: "720100000001", color: "Marino", size: "M" },
        { id: 11, barcode: "720100000002", color: "Marino", size: "L" },
    ],
};

function renderPagina() {
    return render(
        <AuthProvider>
            <MarketProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <AdminProductsPage />
                    </CartDrawerProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

/**
 * Tarea 7.2 (E.3) — listado del catálogo en la zona admin: carga, enlaces,
 * borrado con confirmación y traducción del 409 «tiene pedidos».
 */
describe("AdminProductsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getMarkets).mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("carga y pinta los productos con su número de SKUs y el enlace a editar", async () => {
        vi.mocked(api.listAdminProducts).mockResolvedValue([producto]);

        renderPagina();

        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();
        expect(screen.getByText("7201/001")).toBeInTheDocument();
        expect(screen.getByText("OUTERWEAR")).toBeInTheDocument();

        // Los SKUs se cuentan en servidor, la columna sólo los refleja
        const fila = screen.getByText("Blazer Prueba 72").closest("tr");
        expect(fila).not.toBeNull();
        const enlace = screen.getByRole("link", { name: "Editar" });
        expect(enlace).toHaveAttribute("href", "/admin/products/1/edit");
    });

    it("el enlace «Nuevo producto» apunta al formulario de alta", async () => {
        vi.mocked(api.listAdminProducts).mockResolvedValue([]);

        renderPagina();

        expect(
            await screen.findByRole("link", { name: /nuevo producto/i })
        ).toHaveAttribute("href", "/admin/products/new");
    });

    it("borrar pide confirmación, retira la fila y muestra el toast", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.listAdminProducts).mockResolvedValue([producto]);
        vi.mocked(api.deleteAdminProduct).mockResolvedValue(undefined);
        const confirmacion = vi.spyOn(window, "confirm").mockReturnValue(true);

        renderPagina();
        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: "Borrar" }));

        expect(confirmacion).toHaveBeenCalledTimes(1);
        expect(api.deleteAdminProduct).toHaveBeenCalledWith(1);
        expect(await screen.findByText(/Producto 7201\/001 borrado/)).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText("Blazer Prueba 72")).not.toBeInTheDocument()
        );
    });

    it("si el usuario cancela la confirmación no se borra nada", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.listAdminProducts).mockResolvedValue([producto]);
        vi.spyOn(window, "confirm").mockReturnValue(false);

        renderPagina();
        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: "Borrar" }));

        expect(api.deleteAdminProduct).not.toHaveBeenCalled();
        expect(screen.getByText("Blazer Prueba 72")).toBeInTheDocument();
    });

    it("un 409 («tiene pedidos») se muestra traducido en el aviso, sin volcado técnico", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.listAdminProducts).mockResolvedValue([producto]);
        vi.mocked(api.deleteAdminProduct).mockRejectedValue(
            new Error(
                'API Error [409]: {"status":409,"error":"Conflict",' +
                    '"code":"CATALOG_CONFLICT",' +
                    '"message":"No se puede borrar el producto 7201/001: tiene pedidos asociados"}'
            )
        );
        vi.spyOn(window, "confirm").mockReturnValue(true);

        renderPagina();
        expect(await screen.findByText("Blazer Prueba 72")).toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: "Borrar" }));

        expect(
            await screen.findByText(
                "No se puede borrar el producto 7201/001: tiene pedidos asociados"
            )
        ).toBeInTheDocument();
        // La fila sigue ahí: nada se borró
        expect(screen.getByText("Blazer Prueba 72")).toBeInTheDocument();
        expect(screen.queryByText(/API Error/)).not.toBeInTheDocument();
    });

    it("catálogo vacío muestra el estado vacío con acceso al alta", async () => {
        vi.mocked(api.listAdminProducts).mockResolvedValue([]);

        renderPagina();

        expect(
            await screen.findByText(/El catálogo está vacío/)
        ).toBeInTheDocument();
    });
});
