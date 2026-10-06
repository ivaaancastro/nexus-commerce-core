import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ProductDetailPage from "@/app/products/[reference]/page";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import { Market, Product, StockInfo } from "@/types/commerce";
import { User } from "@/types/auth";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    useParams: () => ({ reference: "0432/021" }),
    usePathname: () => "/products/0432/021",
    useSearchParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        searchByReference: vi.fn(),
        getPrice: vi.fn(),
        getStock: vi.fn(),
        getMarkets: vi.fn(),
        getCurrentUser: vi.fn(),
    },
}));

const MARKETS: Market[] = [
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
];

const mockUser: User = {
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
};

const mockProduct: Product = {
    id: 1,
    referenceCode: "0432/021",
    name: "Blazer Cruzada Estructura",
    family: "OUTERWEAR",
    skus: [{ id: 1, barcode: "8412345678900", size: "M", color: "Marino" }],
};

const mockStock: StockInfo = {
    skuId: 1,
    totalAvailable: 5,
    inStock: true,
    breakdown: [
        {
            warehouseCode: "WH_ARTEIXO",
            warehouseName: "Centro Logístico Sabón",
            countryCode: "ES",
            quantityAvailable: 5,
            quantityReserved: 0,
            netAvailable: 5,
        },
    ],
};

const mockPrice = {
    skuId: 1,
    marketCode: "ES",
    currency: "EUR",
    finalPrice: 79.95,
    originalPrice: 79.95,
    hasDiscount: false,
    netAmount: 66.07,
    taxAmount: 13.88,
    taxRate: 21,
};

/** Mismo árbol que layout.tsx: MarketProvider envuelve a CartProvider (D5). */
function renderPage() {
    return render(
        <AuthProvider>
            <MarketProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <ProductDetailPage />
                    </CartDrawerProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

describe("ProductDetailPage — mercado activo (spec market-currency-selector)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.mocked(api.searchByReference).mockResolvedValue(mockProduct);
        vi.mocked(api.getStock).mockResolvedValue(mockStock);
        vi.mocked(api.getPrice).mockResolvedValue(mockPrice);
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
        vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("R4 — pide el precio con el mercado activo, no con «ES» hardcodeado", async () => {
        // GIVEN — el usuario eligió UK en el selector del header
        localStorage.setItem(
            "nexus-market",
            JSON.stringify({ code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 })
        );

        // WHEN
        renderPage();

        // THEN — el identificador 1 es el SKU «M» del fixture
        await waitFor(() =>
            expect(api.getPrice).toHaveBeenCalledWith(1, "UK")
        );
        expect(api.getPrice).toHaveBeenCalledTimes(1);
    });

    it("R4 — sin precio en el mercado pinta «No disponible» y corta el botón", async () => {
        // GIVEN — el endpoint de precios responde 404 para ese mercado
        vi.mocked(api.getPrice).mockRejectedValue(
            new Error('API Error [404]: {"message":"Sin precio"}')
        );

        // WHEN
        renderPage();

        // THEN — estado, no error técnico, y sin toast de fallo
        expect(
            await screen.findByText(/no disponible en España/i)
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /añadir a la bolsa/i }))
            .toBeDisabled();
        expect(screen.queryByText(/API Error/i)).not.toBeInTheDocument();

        // El stock sí se pinta: la prenda existe, lo que falta es su precio.
        expect(api.getStock).toHaveBeenCalledWith(1);
        expect(screen.getByText(/5 uds\. disponibles/i)).toBeInTheDocument();
    });

    it("R8 — el desglose impositivo usa la etiqueta neutra «Impuestos»", async () => {
        // GIVEN / WHEN
        renderPage();

        // THEN
        expect(await screen.findByText(/impuestos \(21%\)/i)).toBeInTheDocument();
        expect(screen.queryByText(/IVA/i)).not.toBeInTheDocument();
    });

    it("R8b — el aviso de envío gratuito usa la divisa del mercado activo", async () => {
        // GIVEN — el usuario eligió UK en el selector del header
        localStorage.setItem(
            "nexus-market",
            JSON.stringify({ code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 })
        );

        // WHEN
        renderPage();

        // THEN — se traduce la moneda, no el valor (50 sigue siendo 50)
        expect(
            await screen.findByText(/envío gratuito en pedidos superiores a 50 GBP/i)
        ).toBeInTheDocument();
        expect(screen.queryByText(/50€/)).not.toBeInTheDocument();
    });
});
