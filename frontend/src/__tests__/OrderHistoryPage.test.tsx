import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OrderHistoryPage from "@/app/orders/page";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import { Market, OrderPage, OrderSummary } from "@/types/commerce";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace, push: vi.fn() }),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMyOrders: vi.fn(),
        getMarkets: vi.fn(),
        getPrice: vi.fn(),
    },
}));

const MARKETS: Market[] = [
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
];

function makeOrder(overrides: Partial<OrderSummary> = {}): OrderSummary {
    return {
        id: 10,
        orderNumber: "ORD-2026-001",
        status: "DELIVERED",
        currency: "EUR",
        totalAmount: 79.95,
        createdAt: "2026-09-15T10:00:00Z",
        itemCount: 2,
        items: [
            {
                productName: "Camisa Oxford",
                productFamily: "Camisas",
                size: "M",
                color: "Blanco",
                quantity: 1,
                totalAmount: 79.95,
            },
        ],
        returnRequested: false,
        ...overrides,
    };
}

function makePage(orders: OrderSummary[], overrides: Partial<OrderPage> = {}): OrderPage {
    return {
        orders,
        page: 0,
        size: 20,
        totalElements: orders.length,
        totalPages: 1,
        ...overrides,
    };
}

function renderHistory() {
    return render(
        <AuthProvider>
            {/* Mismo árbol que layout.tsx (D5) */}
            <MarketProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <OrderHistoryPage />
                    </CartDrawerProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

describe("OrderHistoryPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
        vi.mocked(api.getPrice).mockResolvedValue({
            skuId: 1,
            marketCode: "ES",
            currency: "EUR",
            finalPrice: 79.95,
            originalPrice: 79.95,
            hasDiscount: false,
            netAmount: 66.07,
            taxAmount: 13.88,
            taxRate: 21,
        });
        vi.mocked(api.getCurrentUser).mockResolvedValue({
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
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("debe renderizar la lista de pedidos con número, fecha y total", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockResolvedValue(makePage([makeOrder()]));

        // WHEN
        renderHistory();

        // THEN
        expect(await screen.findByText("ORD-2026-001")).toBeInTheDocument();
        // R9: el importe ya aparece dos veces — el de la línea y el del pedido
        expect(screen.getAllByText(/79\.95 EUR/)).toHaveLength(2);
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText(/15 de septiembre de 2026/)).toBeInTheDocument();
        expect(screen.getByText("1 pedido")).toBeInTheDocument();
        expect(api.getMyOrders).toHaveBeenCalledWith(0, 20);
    });

    it("R9 — cambiar de mercado no altera un pedido ya emitido", async () => {
        // GIVEN — pedido emitido en EUR mientras el usuario navega en UK
        localStorage.setItem(
            "nexus-market",
            JSON.stringify({ code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 })
        );
        vi.mocked(api.getMyOrders).mockResolvedValue(makePage([makeOrder()]));

        // WHEN
        renderHistory();

        // THEN — la divisa la manda el pedido persistido, no el mercado activo
        expect(await screen.findByText("ORD-2026-001")).toBeInTheDocument();
        expect(screen.getAllByText(/79\.95 EUR/)).toHaveLength(2);
        // Por importe y no por divisa suelta: el <select> del header (3.2)
        // muestra «UK / GBP» y empataría con cualquier texto GBP.
        expect(screen.queryByText(/79\.95 GBP/)).not.toBeInTheDocument();
    });

    it("R9 — pinta nombre y variante de cada producto en la tarjeta", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockResolvedValue(makePage([makeOrder()]));

        // WHEN
        renderHistory();

        // THEN
        expect(await screen.findByText("Camisa Oxford")).toBeInTheDocument();
        // R9: familia · talla · color — el color viaja en el DTO, la tarjeta debe pintarlo
        expect(screen.getByText(/Camisas · Talla M · Blanco/)).toBeInTheDocument();
        // R8: la caja decorativa reutiliza la familia · talla
        expect(screen.getByTestId("product-thumb")).toBeInTheDocument();
        expect(screen.getByText("1 unidad")).toBeInTheDocument();
    });

    it("R10 — marca «Devolución solicitada» cuando el backend lo indica", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockResolvedValue(
            makePage([makeOrder({ returnRequested: true })])
        );

        // WHEN
        renderHistory();

        // THEN
        expect(await screen.findByText("ORD-2026-001")).toBeInTheDocument();
        expect(
            screen.getByTestId("return-badge-ORD-2026-001")
        ).toHaveTextContent("Devolución solicitada");
    });

    it("R10 — no muestra el badge en los pedidos sin devoluciones", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockResolvedValue(
            makePage([makeOrder({ returnRequested: false })])
        );

        // WHEN
        renderHistory();

        // THEN
        expect(await screen.findByText("ORD-2026-001")).toBeInTheDocument();
        expect(
            screen.queryByTestId("return-badge-ORD-2026-001")
        ).not.toBeInTheDocument();
    });

    it("debe mostrar el badge propio de cada estado", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockResolvedValue(
            makePage([
                makeOrder({ id: 1, orderNumber: "ORD-A", status: "DELIVERED" }),
                makeOrder({ id: 2, orderNumber: "ORD-B", status: "SHIPPED" }),
                makeOrder({ id: 3, orderNumber: "ORD-C", status: "PENDING" }),
                makeOrder({ id: 4, orderNumber: "ORD-D", status: "CANCELLED" }),
            ], { totalElements: 4 })
        );

        // WHEN
        renderHistory();

        // THEN
        expect(await screen.findByText("ORD-A")).toBeInTheDocument();
        expect(screen.getByText("Entregado")).toBeInTheDocument();
        expect(screen.getByText("Enviado")).toBeInTheDocument();
        expect(screen.getByText("Pendiente")).toBeInTheDocument();
        expect(screen.getByText("Cancelado")).toBeInTheDocument();
    });

    it("debe enlazar cada pedido a su recibo", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockResolvedValue(
            makePage([makeOrder({ orderNumber: "ORD 001" })])
        );

        // WHEN
        renderHistory();
        const link = await screen.findByRole("link", { name: /ver recibo/i });

        // THEN
        expect(link).toHaveAttribute("href", "/receipt/ORD%20001");
    });

    it("debe declarar color explícito en los enlaces de la tarjeta para no heredar el del body", async () => {
        // GIVEN — globals.css cambia --foreground a #ededed con prefers-color-scheme: dark,
        // pero esta página fija fondos claros. Sin color propio el enlace sale casi
        // invisible sobre blanco (rgb(237,237,237)).
        vi.mocked(api.getMyOrders).mockResolvedValue(makePage([makeOrder()]));

        // WHEN
        renderHistory();
        const recibo = await screen.findByRole("link", { name: /ver recibo/i });
        const pedido = screen.getByRole("link", { name: /ver pedido/i });

        // THEN — basta con cualquier `text-neutral-*` explícito; lo que importa es
        // que ninguno de los dos enlaces dependa del color heredado.
        expect(recibo.className).toMatch(/text-neutral-\d+/);
        expect(pedido.className).toMatch(/text-neutral-\d+/);
    });

    it("debe enlazar cada pedido a su detalle, donde vive la sección de devoluciones", async () => {
        // GIVEN — la sección de devoluciones (Tarea 5.4) está en /orders/{orderNumber},
        // y el listado solo enlazaba al recibo: la función era inalcanzable desde la UI.
        vi.mocked(api.getMyOrders).mockResolvedValue(
            makePage([makeOrder({ orderNumber: "ORD 001" })])
        );

        // WHEN
        renderHistory();
        const link = await screen.findByRole("link", { name: /ver pedido/i });

        // THEN
        expect(link).toHaveAttribute("href", "/orders/ORD%20001");
    });

    it("debe mostrar el estado vacío con enlace a la colección", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockResolvedValue(makePage([]));

        // WHEN
        renderHistory();

        // THEN
        expect(
            await screen.findByText(/todavía no has hecho ningún pedido/i)
        ).toBeInTheDocument();

        const link = screen.getByRole("link", { name: /ver la colección/i });
        expect(link).toHaveAttribute("href", "/");
    });

    it("debe paginar cuando hay más de una página", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockResolvedValue(
            makePage([makeOrder()], { page: 0, totalPages: 3, totalElements: 45 })
        );

        // WHEN
        renderHistory();
        expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();

        const next = screen.getByRole("button", { name: /siguiente/i });
        vi.mocked(api.getMyOrders).mockResolvedValue(
            makePage([makeOrder({ id: 99, orderNumber: "ORD-002" })], {
                page: 1,
                totalPages: 3,
                totalElements: 45,
            })
        );

        await userEvent.click(next);

        // THEN
        await waitFor(() =>
            expect(api.getMyOrders).toHaveBeenCalledWith(1, 20)
        );
        expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
    });

    it("debe traducir el error técnico y ofrecer reintentar", async () => {
        // GIVEN
        vi.mocked(api.getMyOrders).mockRejectedValue(
            new Error("API Error [500]: Internal Server Error")
        );

        // WHEN
        renderHistory();

        // THEN
        expect(await screen.findByRole("button", { name: /reintentar/i })).toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });
});
