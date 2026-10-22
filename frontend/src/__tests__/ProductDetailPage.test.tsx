import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    role: "USER",
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

/**
 * Semilla tipo V12 (spec `color-and-care`): 4 colores con tallas distintas.
 * Las tallas no se repiten igual en todos — es justo lo que debe resolver el
 * selector (D2/R3).
 */
const PDP_COLORES: Product = {
    id: 2,
    referenceCode: "0432/021",
    name: "Blazer Cruzada Estructura",
    family: "OUTERWEAR",
    skus: [
        { id: 11, barcode: "8412345678901", size: "S", color: "Marino" },
        { id: 12, barcode: "8412345678902", size: "M", color: "Marino" },
        { id: 13, barcode: "8412345678903", size: "L", color: "Marino" },
        { id: 14, barcode: "8412345678904", size: "XL", color: "Marino" },
        { id: 21, barcode: "8412345678911", size: "S", color: "Camel" },
        { id: 22, barcode: "8412345678912", size: "M", color: "Camel" },
        { id: 31, barcode: "8412345678921", size: "M", color: "Crudo" },
        { id: 32, barcode: "8412345678922", size: "L", color: "Crudo" },
        { id: 41, barcode: "8412345678931", size: "S", color: "Negro" },
    ],
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

    it("R8 — la nota fiscal usa la etiqueta neutra «Impuestos incluidos»", async () => {
        // GIVEN / WHEN
        renderPage();

        // THEN — sin desglose base+impuesto: sólo el porcentaje (R1)
        expect(await screen.findByText(/impuestos incluidos \(21 %\)/i)).toBeInTheDocument();
        expect(screen.queryByText(/IVA/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/base:/i)).not.toBeInTheDocument();
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

/**
 * Tarea 7.2 (D9) — la vitrina con un producto recién creado desde el panel:
 * nace **sin SKUs**, así que el panel de compra no puede usar `selectedSku!`.
 *
 * Regresión del `TypeError: Cannot read properties of null (reading 'id')`
 * que rompía la ficha entera al abrir `/products/7201%2F005`.
 */
describe("ProductDetailPage — producto sin SKUs (Tarea 7.2)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.mocked(api.searchByReference).mockResolvedValue({
            ...mockProduct,
            referenceCode: "7201/005",
            name: "Abrigo Lana Verificación",
            skus: [],
        });
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
        vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("no crashea, anuncia que no hay variantes y oculta el botón de compra", async () => {
        // GIVEN / WHEN
        renderPage();

        // THEN — la ficha se pinta entera con su galería y descripción
        expect(await screen.findByText("Abrigo Lana Verificación")).toBeInTheDocument();
        expect(screen.getByText("Sin variantes disponibles todavía")).toBeInTheDocument();
        expect(
            screen.getByText(/no comprable hasta que tenga al menos un sku/i)
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /añadir a la bolsa/i })
        ).not.toBeInTheDocument();

        // Sin SKU seleccionado no se piden ni precio ni stock
        expect(api.getPrice).not.toHaveBeenCalled();
        expect(api.getStock).not.toHaveBeenCalled();
    });
});

describe("ProductDetailPage — color y cuidados (spec color-and-care)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.mocked(api.searchByReference).mockResolvedValue(PDP_COLORES);
        vi.mocked(api.getStock).mockResolvedValue(mockStock);
        vi.mocked(api.getPrice).mockResolvedValue(mockPrice);
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
        vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("R1/D1 — pinta el selector con los 4 colores y sólo las tallas del color activo", async () => {
        // GIVEN / WHEN
        renderPage();

        // THEN — los 4 colores de la semilla, visibles
        expect(await screen.findByTestId("product-color")).toBeInTheDocument();
        for (const color of ["Marino", "Camel", "Crudo", "Negro"]) {
            expect(screen.getByRole("button", { name: color })).toBeInTheDocument();
        }

        // El color inicial es el del primer SKU, y su talla la pide a la API
        expect(screen.getByText("Color: Marino")).toBeInTheDocument();
        expect(api.getPrice).toHaveBeenCalledWith(11, "ES");

        // Sólo las tallas de Marino (S/M/L/XL): las de Camel empiezan en S
        // pero no se mezclan en la misma rejilla (D2)
        expect(screen.getByRole("button", { name: "S" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "XL" })).toBeInTheDocument();
    });

    it("R3/D2 — cambiar de color conserva la talla si ese color la tiene", async () => {
        const usuario = userEvent.setup();
        renderPage();
        await screen.findByTestId("product-color");

        // GIVEN — el usuario elige la talla M de Marino
        await usuario.click(screen.getByRole("button", { name: "M" }));
        expect(api.getPrice).toHaveBeenLastCalledWith(12, "ES");

        // WHEN — pasa a Camel, que también tiene M
        await usuario.click(screen.getByRole("button", { name: "Camel" }));

        // THEN — sigue en M, pero ahora es la M de Camel (otro SKU, otro precio)
        expect(await screen.findByText("Color: Camel")).toBeInTheDocument();
        expect(api.getPrice).toHaveBeenLastCalledWith(22, "ES");
        expect(screen.getByText(/Barcode: 8412345678912/)).toBeInTheDocument();
    });

    it("R3/D2 — si el nuevo color no tiene esa talla, cae a la primera que tiene", async () => {
        const usuario = userEvent.setup();
        renderPage();
        await screen.findByTestId("product-color");

        // GIVEN — la talla XL seleccionada en Marino
        await usuario.click(screen.getByRole("button", { name: "XL" }));
        expect(api.getPrice).toHaveBeenLastCalledWith(14, "ES");

        // WHEN — pasa a Negro, que sólo tiene S
        await usuario.click(screen.getByRole("button", { name: "Negro" }));

        // THEN — cae a su única talla en vez de quedar sin selección
        expect(await screen.findByText("Color: Negro")).toBeInTheDocument();
        expect(api.getPrice).toHaveBeenLastCalledWith(41, "ES");
    });

    it("D1 — con un solo color el selector se pinta igual: es la única forma de verlo", async () => {
        // GIVEN — un producto con un único color
        vi.mocked(api.searchByReference).mockResolvedValue({
            ...PDP_COLORES,
            skus: PDP_COLORES.skus.filter((sku) => sku.color === "Marino"),
        });

        // WHEN / THEN
        renderPage();

        expect(await screen.findByTestId("product-color")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Marino" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Camel" })).not.toBeInTheDocument();
    });

    it("R4/D4 — pinta los cuidados con sus saltos de línea y después de la descripción", async () => {
        // GIVEN — un producto con cuidados escritos desde el panel
        vi.mocked(api.searchByReference).mockResolvedValue({
            ...PDP_COLORES,
            careInstructions: "No lavar con lejía\nSecar a la sombra\nNo planchar",
        });

        // WHEN / THEN
        renderPage();

        const cuidados = await screen.findByTestId("product-care");
        expect(cuidados).toHaveTextContent("No lavar con lejía");
        // El salto de línea viaja tal cual, sin partirse en párrafos (D4)
        expect(cuidados.textContent).toContain("\n");
        expect(cuidados.querySelector("p")).toHaveClass("whitespace-pre-line");

        // Y va DESPUÉS de la descripción, en el mismo sentido de lectura
        const descripcion = screen.getByTestId("product-description");
        expect(
            descripcion.compareDocumentPosition(cuidados) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it("R5 — sin cuidados no hay sección: ni bloque vacío ni título suelto", async () => {
        // GIVEN — el fixture sin `careInstructions` (como los productos previos)
        renderPage();

        // THEN
        expect(await screen.findByTestId("product-description")).toBeInTheDocument();
        expect(screen.queryByTestId("product-care")).not.toBeInTheDocument();
        expect(screen.queryByText("Cuidados")).not.toBeInTheDocument();
    });

    it("R8 — cambiar de color NO cambia la galería: las fotos son por referencia", async () => {
        const usuario = userEvent.setup();
        renderPage();
        await screen.findByTestId("product-color");

        const fotosDeLaReferencia = () =>
            screen.getAllByRole("img").map((img) => img.getAttribute("src"));
        const antes = fotosDeLaReferencia();
        expect(antes.length).toBeGreaterThan(0);

        // WHEN — el usuario elige otro color
        await usuario.click(screen.getByRole("button", { name: "Negro" }));

        // THEN — el color cambia, las fotos no (comprobación negativa, R8)
        expect(await screen.findByText("Color: Negro")).toBeInTheDocument();
        expect(api.getPrice).toHaveBeenLastCalledWith(41, "ES");
        expect(fotosDeLaReferencia()).toEqual(antes);
    });
});
