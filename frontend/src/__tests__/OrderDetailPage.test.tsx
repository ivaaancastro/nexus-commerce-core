import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useParams } from "next/navigation";
import OrderDetailPage from "@/app/orders/[orderNumber]/page";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { AuthProvider } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Order, OrderItem, ProductReturn } from "@/types/commerce";
import { User } from "@/types/auth";

vi.mock("next/navigation", () => ({
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getOrder: vi.fn(),
        getCurrentUser: vi.fn(),
        getMyReturns: vi.fn(),
        createReturn: vi.fn(),
    },
}));

const baseItem: OrderItem = {
    id: 1,
    skuId: 1,
    skuCode: "843321900101",
    warehouseCode: "WH_ARTEIXO",
    quantity: 1,
    unitPrice: 79.95,
    taxRate: 21.0,
    taxAmount: 13.88,
    totalAmount: 79.95,
    returnEligible: false,
    returnIneligibleReason: "NOT_DELIVERED",
};

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
    items: [baseItem],
};

const mockUser: User = {
    id: 7,
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "García",
    birthDate: "1995-04-12",
    gender: "FEMALE",
    emailVerified: true,
};

/** Simula una sesión activa: sin token `AuthProvider` arranca en anónimo. */
function signIn() {
    localStorage.setItem("nexus-auth-token", "test-token");
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
}

function renderPage() {
    return render(
        <AuthProvider>
            <CartProvider>
                <CartDrawerProvider>
                    <OrderDetailPage />
                </CartDrawerProvider>
            </CartProvider>
        </AuthProvider>
    );
}

describe("OrderDetailPage Component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("debe recuperar el pedido y renderizar el ticket fiscal con sus metadatos e idempotencia", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue(mockOrder);

        renderPage();

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

        renderPage();

        await waitFor(() => {
            expect(screen.getByText("Pedido no encontrado")).toBeInTheDocument();
            expect(screen.getByRole("link", { name: /Volver a la colección/i })).toBeInTheDocument();
        });
    });

    // ── Devoluciones (Tarea 5.4) ───────────────────────────────────────────

    it("no pide devoluciones ni muestra la sección si no hay sesión", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue(mockOrder);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText("Pedido Confirmado")).toBeInTheDocument();
        });

        expect(screen.queryByRole("heading", { name: "Devoluciones" })).not.toBeInTheDocument();
        expect(api.getMyReturns).not.toHaveBeenCalled();
    });

    it("muestra el botón «Devolver» habilitado cuando la línea es elegible", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            status: "DELIVERED",
            items: [{ ...baseItem, returnEligible: true, returnIneligibleReason: null }],
        });
        vi.mocked(api.getMyReturns).mockResolvedValue([]);
        signIn();

        renderPage();

        const button = await screen.findByRole("button", { name: "Devolver" });
        expect(button).toBeEnabled();
        expect(screen.queryByText(/Plazo agotado/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Pedido aún no entregado/)).not.toBeInTheDocument();
    });

    it("explica por qué la línea no es devolvible según el motivo (R8)", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            items: [{ ...baseItem, returnEligible: false, returnIneligibleReason: "EXPIRED" }],
        });
        vi.mocked(api.getMyReturns).mockResolvedValue([]);
        signIn();

        renderPage();

        expect(
            await screen.findByText(/Plazo agotado — se compró el \d/)
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Devolver" })).not.toBeInTheDocument();
    });

    it("muestra «Pedido aún no entregado» cuando el pedido no está en estado DELIVERED", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            items: [{ ...baseItem, returnEligible: false, returnIneligibleReason: "NOT_DELIVERED" }],
        });
        vi.mocked(api.getMyReturns).mockResolvedValue([]);
        signIn();

        renderPage();

        expect(await screen.findByText("Pedido aún no entregado")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Devolver" })).not.toBeInTheDocument();
    });

    it("muestra «Ya devuelto» cuando la línea ya tiene una devolución", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            items: [{ ...baseItem, returnEligible: false, returnIneligibleReason: "ALREADY_RETURNED" }],
        });
        vi.mocked(api.getMyReturns).mockResolvedValue([
            {
                id: 5,
                orderItemId: 1,
                skuCode: "843321900101",
                status: "REQUESTED",
                reason: "Talla incorrecta",
                currency: "EUR",
                refundAmount: 79.95,
                requestedAt: "2026-10-01T10:00:00Z",
            } satisfies ProductReturn,
        ]);
        signIn();

        renderPage();

        expect(await screen.findByText(/Solicitada/)).toBeInTheDocument();
        expect(screen.getByText(/79\.95 EUR a devolver/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Devolver" })).not.toBeInTheDocument();
    });

    it("envía el formulario con el motivo y muestra el estado «Solicitada» con el importe", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            status: "DELIVERED",
            items: [{ ...baseItem, returnEligible: true, returnIneligibleReason: null }],
        });
        vi.mocked(api.getMyReturns).mockResolvedValue([]);
        vi.mocked(api.createReturn).mockResolvedValue({
            id: 5,
            orderItemId: 1,
            skuCode: "843321900101",
            status: "REQUESTED",
            reason: "Talla incorrecta",
            currency: "EUR",
            refundAmount: 79.95,
            requestedAt: "2026-10-05T10:00:00Z",
        });
        signIn();

        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "Devolver" }));
        fireEvent.change(screen.getByLabelText("Motivo de la devolución"), {
            target: { value: "  Talla incorrecta  " },
        });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar devolución" }));

        expect(await screen.findByText(/Solicitada/)).toBeInTheDocument();
        expect(api.createReturn).toHaveBeenCalledWith("ORD-TEST-99", {
            orderItemId: 1,
            reason: "Talla incorrecta",
        });
        expect(screen.getByText(/79\.95 EUR a devolver/)).toBeInTheDocument();
    });

    it("valida el motivo en cliente y no llama al backend si va en blanco (regla #9)", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            status: "DELIVERED",
            items: [{ ...baseItem, returnEligible: true, returnIneligibleReason: null }],
        });
        vi.mocked(api.getMyReturns).mockResolvedValue([]);
        signIn();

        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "Devolver" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar devolución" }));

        expect(await screen.findByText("Indica el motivo de la devolución.")).toBeInTheDocument();
        expect(api.createReturn).not.toHaveBeenCalled();
    });

    it("traduce el 409 con getFriendlyErrorMessage en lugar de pintar err.message crudo", async () => {
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            status: "DELIVERED",
            items: [{ ...baseItem, returnEligible: true, returnIneligibleReason: null }],
        });
        vi.mocked(api.getMyReturns).mockResolvedValue([]);
        vi.mocked(api.createReturn).mockRejectedValue(
            new Error(
                'API Error [409]: {"status":409,"error":"Conflict",' +
                    '"code":"RETURN_NOT_ALLOWED",' +
                    '"message":"Ha pasado el plazo de 30 días desde la compra."}'
            )
        );
        signIn();

        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "Devolver" }));
        fireEvent.change(screen.getByLabelText("Motivo de la devolución"), {
            target: { value: "Talla incorrecta" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar devolución" }));

        expect(
            await screen.findByText("Ha pasado el plazo de 30 días desde la compra.")
        ).toBeInTheDocument();
        // Nunca el error técnico crudo
        expect(screen.queryByText(/API Error/)).not.toBeInTheDocument();
    });
});
