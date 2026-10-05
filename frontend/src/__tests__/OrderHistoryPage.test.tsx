import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OrderHistoryPage from "@/app/orders/page";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import { OrderPage, OrderSummary } from "@/types/commerce";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace, push: vi.fn() }),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMyOrders: vi.fn(),
    },
}));

function makeOrder(overrides: Partial<OrderSummary> = {}): OrderSummary {
    return {
        id: 10,
        orderNumber: "ORD-2026-001",
        status: "DELIVERED",
        currency: "EUR",
        totalAmount: 79.95,
        createdAt: "2026-09-15T10:00:00Z",
        itemCount: 2,
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
            <CartProvider>
                <CartDrawerProvider>
                    <OrderHistoryPage />
                </CartDrawerProvider>
            </CartProvider>
        </AuthProvider>
    );
}

describe("OrderHistoryPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
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
        expect(screen.getByText(/79\.95 EUR/)).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText(/15 de septiembre de 2026/)).toBeInTheDocument();
        expect(screen.getByText("1 pedido")).toBeInTheDocument();
        expect(api.getMyOrders).toHaveBeenCalledWith(0, 20);
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

    it("debe declarar color explícito en el enlace al recibo para no heredar el del body", async () => {
        // GIVEN — globals.css cambia --foreground a #ededed con prefers-color-scheme: dark,
        // pero esta página fija fondos claros. Sin color propio el enlace sale casi
        // invisible sobre blanco (rgb(237,237,237)).
        vi.mocked(api.getMyOrders).mockResolvedValue(makePage([makeOrder()]));

        // WHEN
        renderHistory();
        const link = await screen.findByRole("link", { name: /ver recibo/i });

        // THEN
        expect(link.className).toContain("text-neutral-900");
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
