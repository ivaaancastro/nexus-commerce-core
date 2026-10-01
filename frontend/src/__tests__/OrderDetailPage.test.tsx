import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useParams } from "next/navigation";
import OrderDetailPage from "@/app/orders/[orderNumber]/page";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { AuthProvider } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Order } from "@/types/commerce";

vi.mock("next/navigation", () => ({
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getOrder: vi.fn(),
    },
}));

const mockOrder: Order = {
    id: 10,
    orderNumber: "ORD-TEST-99",
    idempotencyKey: "test-idem-key-uuid-1234",
    marketCode: "ES",
    currency: "EUR",
    status: "CONFIRMED",
    subtotalAmount: 66.07,
    taxAmount: 13.88,
    totalAmount: 79.95,
    createdAt: "2026-09-29T15:30:00Z",
    items: [
        {
            id: 1,
            skuId: 1,
            skuCode: "843321900101",
            warehouseCode: "WH_ARTEIXO",
            quantity: 1,
            unitPrice: 79.95,
            taxRate: 21.0,
            taxAmount: 13.88,
            totalAmount: 79.95,
        },
    ],
};

describe("OrderDetailPage Component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("debe recuperar el pedido y renderizar el ticket fiscal con sus metadatos e idempotencia", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue(mockOrder);

        render(
            <AuthProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <OrderDetailPage />
                    </CartDrawerProvider>
                </CartProvider>
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("ORD-TEST-99")).toBeInTheDocument();
            expect(screen.getByText("Pedido Confirmado")).toBeInTheDocument();
            expect(screen.getByText(/843321900101/i)).toBeInTheDocument();
            expect(screen.getByText(/66.07/i)).toBeInTheDocument();
            expect(screen.getByText(/13.88/i)).toBeInTheDocument();
            expect(screen.getAllByText(/79.95/i).length).toBeGreaterThanOrEqual(1);
        });
    });

    it("debe mostrar estado de 'Registro No Encontrado' si la API falla o no existe el pedido", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-INEXISTENTE" });
        vi.mocked(api.getOrder).mockRejectedValue(new Error("Order not found"));

        render(
            <AuthProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <OrderDetailPage />
                    </CartDrawerProvider>
                </CartProvider>
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Pedido no encontrado")).toBeInTheDocument();
            expect(screen.getByRole("link", { name: /Volver a la colección/i })).toBeInTheDocument();
        });
    });
});