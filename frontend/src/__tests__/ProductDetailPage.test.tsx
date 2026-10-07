import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ProductDetailPage from "@/app/products/[reference]/page";
import { GALLERY_SIZES } from "@/components/ProductGallery";
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

/**
 * R7 de specs/gallery-responsive: la ficha pasa de dos paneles de texto a
 * galería + panel de compra sticky + descripción bajo la galería.
 */
describe("ProductDetailPage — galería responsive (spec gallery-responsive)", () => {
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

    it("R7 — monta la galería con las 3 imágenes del manifiesto", async () => {
        // GIVEN / WHEN
        renderPage();

        // THEN
        expect(await screen.findByTestId("product-gallery")).toBeInTheDocument();
        expect(screen.getAllByTestId("product-image")).toHaveLength(3);
    });

    it("R6 — la galería lleva su `sizes`, derivado del ancho de la imagen", async () => {
        // GIVEN / WHEN
        renderPage();

        // THEN
        expect(await screen.findByTestId("product-gallery")).toBeInTheDocument();
        const images = [
            ...screen.getByTestId("product-gallery").querySelectorAll("img"),
        ];

        expect(images).toHaveLength(3);
        images.forEach((img) => {
            expect(img).toHaveAttribute("sizes", GALLERY_SIZES);
        });

        // Regresión: la primera versión apuntaba al ancho del contenedor
        // (100vw, 278 px) y no al de la imagen (276 px). Esos 2 px bastaban
        // para cruzar de bucket a DPR alto y pedir 1080w en vez de 828w.
        expect(GALLERY_SIZES).toContain("calc(100vw - 114px)");
        expect(GALLERY_SIZES).not.toContain("(max-width: 767px) 100vw");
    });

    it("R7 — el orden del DOM es galería → panel de compra → descripción", async () => {
        // GIVEN / WHEN
        renderPage();
        await screen.findByTestId("product-gallery");

        // THEN — es también el orden de móvil: no se reordena con CSS
        const gallery = screen.getByTestId("product-gallery");
        const panel = screen.getByTestId("purchase-panel");
        const description = screen.getByTestId("product-description");

        const precedes = (a: Element, b: Element) =>
            (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

        expect(precedes(gallery, panel)).toBe(true);
        expect(precedes(panel, description)).toBe(true);
    });

    it("R7 — galería en 7 columnas y panel de compra en 5, sobre 12", async () => {
        // GIVEN / WHEN
        renderPage();
        await screen.findByTestId("product-gallery");

        // THEN
        const galleryWrapper = screen.getByTestId("product-gallery").parentElement;
        expect(galleryWrapper).toHaveClass("md:col-start-1");
        expect(galleryWrapper).toHaveClass("md:col-span-7");
        expect(galleryWrapper).toHaveClass("md:row-start-1");

        const panel = screen.getByTestId("purchase-panel");
        expect(panel).toHaveClass("md:col-start-8");
        expect(panel).toHaveClass("md:col-span-5");
    });

    it("R7 — el panel es sticky, no se estira y nada queda inalcanzable", async () => {
        // GIVEN / WHEN
        renderPage();
        await screen.findByTestId("product-gallery");

        // THEN
        const panel = screen.getByTestId("purchase-panel");
        expect(panel).toHaveClass("md:sticky");
        expect(panel).toHaveClass("md:top-24");
        expect(panel).toHaveClass("md:self-start");
        // Ocupa las dos filas (galería y descripción) para tener recorrido
        expect(panel).toHaveClass("md:row-span-2");
        // Si supera el viewport, scrollea dentro en vez de cortarse
        expect(panel).toHaveClass("md:max-h-[calc(100vh-7rem)]");
        expect(panel).toHaveClass("md:overflow-y-auto");
    });

    it("R7 — la descripción queda bajo la galería, no en una columna propia", async () => {
        // GIVEN / WHEN
        renderPage();
        await screen.findByTestId("product-gallery");

        // THEN
        const description = screen.getByTestId("product-description");
        expect(description).toHaveClass("md:col-start-1");
        expect(description).toHaveClass("md:col-span-7");
        expect(description).toHaveClass("md:row-start-2");
    });
});
