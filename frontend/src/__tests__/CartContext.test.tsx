import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CartProvider, useCart } from "@/context/CartContext";
import { MarketProvider, useMarket } from "@/context/MarketContext";
import { api } from "@/lib/api";
import { CartItem, Market } from "@/types/commerce";

vi.mock("@/lib/api", () => ({
    api: {
        getMarkets: vi.fn(),
        getPrice: vi.fn(),
    },
}));

const MARKETS: Market[] = [
    { code: "CH", name: "Switzerland", currency: "CHF", taxRate: 8.1 },
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
    { code: "US", name: "United States", currency: "USD", taxRate: 7.25 },
];

/**
 * Precio por SKU idéntico al de los fixtures: así el re-precificado de los
 * tests existentes no mueve ningún importe y solo cambia la divisa.
 */
const PRICES: Record<number, number> = { 101: 89.95, 102: 129.95 };

function mockPricingEndpoint() {
    vi.mocked(api.getPrice).mockImplementation(async (skuId, market) => ({
        skuId,
        marketCode: market,
        currency: MARKETS.find((m) => m.code === market)?.currency ?? "EUR",
        finalPrice: PRICES[skuId] ?? 0,
        originalPrice: PRICES[skuId] ?? 0,
        hasDiscount: false,
        netAmount: 0,
        taxAmount: 0,
        taxRate: MARKETS.find((m) => m.code === market)?.taxRate ?? 21,
    }));
}

const mockItem: CartItem = {
    productId: 1,
    referenceCode: "0432/021",
    name: "Camisa de Lino",
    family: "SHIRTS",
    skuId: 101,
    size: "M",
    color: "Blanco",
    quantity: 1,
    unitPrice: 89.95,
    currency: "EUR",
};

const mockItem2: CartItem = {
    productId: 2,
    referenceCode: "0432/022",
    name: "Pantalón Chino",
    family: "TROUSERS",
    skuId: 102,
    size: "L",
    color: "Beige",
    quantity: 1,
    unitPrice: 129.95,
    currency: "EUR",
};

function TestComponent() {
    const { items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal, taxEstimate, currency } = useCart();
    const { markets, market, setMarketCode } = useMarket();

    return (
        <div>
            <span data-testid="total-items">{totalItems}</span>
            <span data-testid="subtotal">{subtotal.toFixed(2)}</span>
            <span data-testid="tax">{taxEstimate.toFixed(2)}</span>
            <span data-testid="currency">{currency}</span>
            <span data-testid="item-count">{items.length}</span>
            <span data-testid="market">{market.code}</span>
            <span data-testid="market-count">{markets.length}</span>
            <span data-testid="item-currency">{items[0]?.currency ?? "—"}</span>
            <span data-testid="item-unavailable">
                {items.some((item) => item.priceUnavailable) ? "sí" : "no"}
            </span>

            <button onClick={() => addItem(mockItem)}>Add Item 1</button>
            <button onClick={() => addItem(mockItem2)}>Add Item 2</button>
            <button onClick={() => removeItem(101, "M")}>Remove Item 1</button>
            <button onClick={() => updateQuantity(101, "M", 3)}>Update Qty to 3</button>
            <button onClick={() => updateQuantity(101, "M", 0)}>Update Qty to 0</button>
            <button onClick={clearCart}>Clear Cart</button>
            <button onClick={() => setMarketCode("UK")}>Switch to UK</button>
            <button onClick={() => setMarketCode("US")}>Switch to US</button>

            <ul>
                {items.map((item) => (
                    <li key={`${item.skuId}-${item.size}`}>
                        {item.name} - Talla {item.size} - Qty: {item.quantity}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Árbol completo de la app: MarketProvider envuelve a CartProvider (D5). */
function renderWithMarket() {
    return render(
        <MarketProvider>
            <CartProvider>
                <TestComponent />
            </CartProvider>
        </MarketProvider>
    );
}

describe("CartContext", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
        mockPricingEndpoint();
    });

    describe("Estado inicial", () => {
        it("debe iniciar con carrito vacío", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            expect(screen.getByTestId("total-items")).toHaveTextContent("0");
            expect(screen.getByTestId("item-count")).toHaveTextContent("0");
            expect(screen.getByTestId("currency")).toHaveTextContent("EUR");
        });
    });

    describe("addItem", () => {
        it("debe añadir un item al carrito", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("1");
            expect(screen.getByTestId("item-count")).toHaveTextContent("1");
        });

        it("debe incrementar cantidad si el item mismo (skuId + size) ya existe", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Add Item 1"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("2");
            expect(screen.getByTestId("item-count")).toHaveTextContent("1");
        });

        it("debe añadir como línea diferente si la talla es distinta", () => {
            // Pre-cargar localStorage con dos items de distinta talla
            const itemTallaM = { ...mockItem, size: "M" };
            const itemTallaL = { ...mockItem, size: "L" };
            localStorage.setItem("nexus-cart", JSON.stringify([itemTallaM, itemTallaL]));

            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            expect(screen.getByTestId("item-count")).toHaveTextContent("2");
            expect(screen.getByTestId("total-items")).toHaveTextContent("2");
        });
    });

    describe("removeItem", () => {
        it("debe eliminar un item del carrito", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Remove Item 1"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("0");
            expect(screen.getByTestId("item-count")).toHaveTextContent("0");
        });
    });

    describe("updateQuantity", () => {
        it("debe actualizar la cantidad de un item", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Update Qty to 3"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("3");
        });

        it("debe eliminar el item si la cantidad es 0", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Update Qty to 0"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("0");
            expect(screen.getByTestId("item-count")).toHaveTextContent("0");
        });
    });

    describe("clearCart", () => {
        it("debe vaciar todo el carrito", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Add Item 2"));
            fireEvent.click(screen.getByText("Clear Cart"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("0");
            expect(screen.getByTestId("item-count")).toHaveTextContent("0");
        });
    });

    describe("Cálculos derivados", () => {
        it("debe calcular subtotal correctamente", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Add Item 2"));

            const expectedSubtotal = (89.95 + 129.95).toFixed(2);
            expect(screen.getByTestId("subtotal")).toHaveTextContent(expectedSubtotal);
        });

        it("debe calcular impuesto estimado (21% IVA)", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));

            const expectedTax = (89.95 * 0.21).toFixed(2);
            expect(screen.getByTestId("tax")).toHaveTextContent(expectedTax);
        });
    });

    describe("Persistencia en localStorage", () => {
        it("debe persistir items en localStorage", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));

            const stored = localStorage.getItem("nexus-cart");
            expect(stored).toBeTruthy();
            expect(JSON.parse(stored!)).toHaveLength(1);
        });
    });

    describe("Re-precificado por mercado (R6, Tarea 3.2)", () => {
        /** El selector solo funciona cuando el endpoint ya ha devuelto la lista. */
        async function whenMarketsLoaded() {
            await waitFor(() =>
                expect(screen.getByTestId("market-count")).toHaveTextContent("4")
            );
        }

        it("debe re-precificar los artículos en la divisa del nuevo mercado", async () => {
            // GIVEN — carrito ya cargado mientras el mercado es ES
            localStorage.setItem("nexus-cart", JSON.stringify([mockItem]));
            renderWithMarket();
            await whenMarketsLoaded();
            await waitFor(() =>
                expect(screen.getByTestId("item-count")).toHaveTextContent("1")
            );
            expect(screen.getByTestId("item-currency")).toHaveTextContent("EUR");

            // WHEN
            fireEvent.click(screen.getByText("Switch to UK"));

            // THEN — la divisa del propio artículo, no solo la del contexto
            await waitFor(() =>
                expect(screen.getByTestId("item-currency")).toHaveTextContent("GBP")
            );
            expect(api.getPrice).toHaveBeenCalledWith(101, "UK");
        });

        it("debe conservar y marcar el artículo sin precio en el nuevo mercado (D6)", async () => {
            // GIVEN — ese mercado no tiene precio para el SKU
            localStorage.setItem("nexus-cart", JSON.stringify([mockItem]));
            vi.mocked(api.getPrice).mockRejectedValue(
                new Error('API Error [404]: {"message":"Sin precio"}')
            );

            renderWithMarket();
            await whenMarketsLoaded();
            fireEvent.click(screen.getByText("Switch to UK"));

            // THEN — se marca… y jamás se borra en silencio
            await waitFor(() =>
                expect(screen.getByTestId("item-unavailable")).toHaveTextContent("sí")
            );
            expect(screen.getByTestId("item-count")).toHaveTextContent("1");
        });

        it("debe calcular los impuestos con la tasa del mercado activo, no con 21%", async () => {
            // GIVEN — mercado por defecto ES (21%)
            renderWithMarket();
            await whenMarketsLoaded();

            fireEvent.click(screen.getByText("Add Item 1"));
            expect(screen.getByTestId("tax")).toHaveTextContent(
                (89.95 * 0.21).toFixed(2)
            );

            // WHEN — US grava al 7.25%
            fireEvent.click(screen.getByText("Switch to US"));

            // THEN
            await waitFor(() =>
                expect(screen.getByTestId("tax")).toHaveTextContent(
                    ((89.95 * 7.25) / 100).toFixed(2)
                )
            );
            expect(screen.getByTestId("market")).toHaveTextContent("US");
        });
    });
});
