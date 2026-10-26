import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import WishlistPage from "@/app/wishlist/page";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider, useMarket } from "@/context/MarketContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { api } from "@/lib/api";
import type {
    Market,
    PriceBreakdown,
    Product,
    WishlistItem,
} from "@/types/commerce";
import type { User } from "@/types/auth";

/**
 * V3 wishlist (plan D8, R7) — la página `/wishlist` con árbol completo de
 * providers (mismo orden que `layout.tsx`).
 *
 * Cubre: lista pintada con miniatura y URL `%2F` · **precios R7.6/D13**: «desde»
 * = mínimo `finalPrice` entre SKUs del mercado activo, **re-fetch al cambiar de
 * mercado** y «No disponible en este mercado» · «Quitar» con toast · «Vaciar»
 * con `window.confirm` · estado vacío · «Reintentar» tras fallo de carga.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn() }),
    usePathname: () => "/wishlist",
    useSearchParams: () => new URLSearchParams(""),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMarkets: vi.fn(),
        getWishlist: vi.fn(),
        getPrice: vi.fn(),
        removeWishlistItem: vi.fn(),
        clearWishlist: vi.fn(),
    },
}));

const MARKETS: Market[] = [
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
];

const baseUser: User = {
    id: 1,
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "García",
    phone: "612345678",
    birthDate: "1990-05-20",
    gender: "FEMALE",
    height: 175,
    weight: 70,
    emailVerified: true,
    role: "USER",
};

const BLAZER: Product = {
    id: 1,
    referenceCode: "0432/021",
    name: "Blazer Cruzada Estructura",
    family: "OUTERWEAR",
    skus: [
        { id: 101, barcode: "843321900101", size: "M", color: "Marino" },
        { id: 102, barcode: "843321900102", size: "L", color: "Marino" },
    ],
};

const ABRIGO: Product = {
    id: 2,
    referenceCode: "0611/018",
    name: "Abrigo Lana Oversize",
    family: "OUTERWEAR",
    skus: [{ id: 103, barcode: "843321900201", size: "M", color: "Camel" }],
};

function item(id: number, product: Product): WishlistItem {
    return { id, addedAt: "2026-10-26T12:00:00+01:00", product };
}

/** Precios por mercado: el mínimo de BLAZER en ES es 90,30 (no 120,50). */
const PRECIOS: Record<string, Record<number, number>> = {
    ES: { 101: 120.5, 102: 90.3, 103: 75 },
    UK: { 101: 130, 102: 95, 103: 80 },
};

function mockPrecios() {
    vi.mocked(api.getPrice).mockImplementation(
        async (skuId: number, marketCode: string): Promise<PriceBreakdown> => {
            const precio = PRECIOS[marketCode]?.[skuId];
            if (precio === undefined) {
                throw new Error(`API Error [404]: sku ${skuId} sin precio`);
            }
            return {
                skuId,
                marketCode,
                currency: marketCode === "UK" ? "GBP" : "EUR",
                finalPrice: precio,
                originalPrice: precio,
                hasDiscount: false,
                netAmount: precio,
                taxAmount: 0,
                taxRate: 21,
            };
        }
    );
}

/** Conmutador de mercado para el caso de re-fetch (D13). */
function CambiarMercado() {
    const { setMarketCode } = useMarket();
    return (
        <button onClick={() => setMarketCode("UK")}>Cambiar a UK</button>
    );
}

function ui() {
    return (
        <AuthProvider>
            <MarketProvider>
                <CartProvider>
                    <WishlistProvider>
                        <CartDrawerProvider>
                            <CambiarMercado />
                            <WishlistPage />
                        </CartDrawerProvider>
                    </WishlistProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

function renderPagina() {
    return render(ui());
}

describe("WishlistPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
        vi.mocked(api.getWishlist).mockResolvedValue({
            items: [item(11, BLAZER), item(12, ABRIGO)],
        });
        vi.mocked(api.removeWishlistItem).mockResolvedValue(undefined);
        vi.mocked(api.clearWishlist).mockResolvedValue(undefined);
        mockPrecios();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it("pinta la lista: nombre, REF, miniatura y «Ver producto» con la URL codificada (R7.1)", async () => {
        renderPagina();

        expect(
            await screen.findByRole("heading", {
                name: "Blazer Cruzada Estructura",
            })
        ).toBeInTheDocument();
        expect(screen.getByText("REF. 0432/021")).toBeInTheDocument();
        expect(screen.getByText("Abrigo Lana Oversize")).toBeInTheDocument();

        const enlaces = screen.getAllByRole("link", { name: "Ver producto" });
        expect(enlaces).toHaveLength(2);
        expect(enlaces[0]).toHaveAttribute("href", "/products/0432%2F021");
        expect(enlaces[1]).toHaveAttribute("href", "/products/0611%2F018");
        expect(
            screen.getByRole("button", { name: "Vaciar favoritos" })
        ).toBeInTheDocument();
    });

    it("precio «desde» = mínimo finalPrice entre los SKUs del mercado activo (R7.6)", async () => {
        renderPagina();

        // BLAZER: 120,50 y 90,30 → «Desde 90,30» · ABRIGO: 75 → «Desde 75,00»
        await waitFor(() => {
            expect(screen.getByTestId("wishlist-price-1")).toHaveTextContent(
                /Desde 90,30/
            );
        });
        expect(screen.getByTestId("wishlist-price-2")).toHaveTextContent(
            /Desde 75,00/
        );
        // Se pidieron los 3 SKUs con el mercado activo
        expect(api.getPrice).toHaveBeenCalledWith(101, "ES");
        expect(api.getPrice).toHaveBeenCalledWith(103, "ES");
    });

    it("al cambiar de mercado se re-piden los precios con el código nuevo (D13)", async () => {
        renderPagina();
        await waitFor(() => {
            expect(screen.getByTestId("wishlist-price-1")).toHaveTextContent(
                /Desde 90,30/
            );
        });

        await userEvent.click(
            screen.getByRole("button", { name: "Cambiar a UK" })
        );

        // UK: mínimos 95 y 80 en libras, pedidos con el mercado "UK"
        await waitFor(() => {
            expect(screen.getByTestId("wishlist-price-1")).toHaveTextContent(
                /Desde 95,00/
            );
        });
        expect(screen.getByTestId("wishlist-price-2")).toHaveTextContent(
            /Desde 80,00/
        );
        expect(api.getPrice).toHaveBeenCalledWith(101, "UK");
    });

    it("producto sin precios en el mercado: «No disponible en este mercado» (R7.6)", async () => {
        vi.mocked(api.getPrice).mockRejectedValue(
            new Error("API Error [404]: sin precio")
        );

        renderPagina();

        // Las dos filas quedan sin precio: ningún importe inventado
        const avisos = await screen.findAllByText(
            "No disponible en este mercado"
        );
        expect(avisos).toHaveLength(2);
        expect(screen.queryByText(/Desde/)).not.toBeInTheDocument();
    });

    it("«Quitar»: borra la fila vía DELETE y confirma con toast (R7.2)", async () => {
        renderPagina();
        const quitar = await screen.findByRole("button", {
            name: "Quitar Blazer Cruzada Estructura de favoritos",
        });

        await userEvent.click(quitar);

        expect(api.removeWishlistItem).toHaveBeenCalledWith(1);
        await waitFor(() => {
            expect(
                screen.queryByRole("heading", {
                    name: "Blazer Cruzada Estructura",
                })
            ).not.toBeInTheDocument();
        });
        expect(screen.getByRole("status")).toHaveTextContent(
            "Producto eliminado de favoritos"
        );
        // El ABRIGO sigue ahí: sólo salió la fila que tocaba
        expect(screen.getByText("Abrigo Lana Oversize")).toBeInTheDocument();
    });

    it("«Vaciar»: sin confirm no se borra nada; con confirm se vacía la lista (R7.3)", async () => {
        const confirmar = vi.spyOn(window, "confirm");
        confirmar.mockReturnValue(false);
        renderPagina();

        const vaciar = await screen.findByRole("button", {
            name: "Vaciar favoritos",
        });
        await userEvent.click(vaciar);

        expect(confirmar).toHaveBeenCalled();
        expect(api.clearWishlist).not.toHaveBeenCalled();
        expect(screen.getByText("Abrigo Lana Oversize")).toBeInTheDocument();

        // Ahora se confirma
        confirmar.mockReturnValue(true);
        await userEvent.click(vaciar);

        await waitFor(() => {
            expect(api.clearWishlist).toHaveBeenCalledTimes(1);
        });
        expect(
            await screen.findByText(/Tu lista de favoritos está vacía/)
        ).toBeInTheDocument();
    });

    it("estado vacío: mensaje editorial y enlace a /catalog (R7.4)", async () => {
        vi.mocked(api.getWishlist).mockResolvedValue({ items: [] });

        renderPagina();

        expect(
            await screen.findByText(/Tu lista de favoritos está vacía/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Ver colección" })
        ).toHaveAttribute("href", "/catalog");
        // Sin filas no hay «Vaciar» ni precios que pedir
        expect(
            screen.queryByRole("button", { name: "Vaciar favoritos" })
        ).not.toBeInTheDocument();
        expect(api.getPrice).not.toHaveBeenCalled();
    });

    it("carga fallida: mensaje amigable y «Reintentar» re-pide la lista (R7.5)", async () => {
        vi.mocked(api.getWishlist)
            .mockRejectedValueOnce(new Error("API Error [500]: caída"))
            .mockResolvedValue({ items: [item(11, BLAZER)] });

        renderPagina();

        expect(
            await screen.findByText(/No se pudo cargar tu lista de favoritos/)
        ).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: "Reintentar" })
        );

        expect(
            await screen.findByRole("heading", {
                name: "Blazer Cruzada Estructura",
            })
        ).toBeInTheDocument();
        expect(api.getWishlist).toHaveBeenCalledTimes(2);
    });
});
