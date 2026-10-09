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
    // BackLink llama a `useRouter()` en montar; se devuelve un objeto para que
    // el clic sea testeable sin romper el render.
    useRouter: vi.fn(() => ({ back: vi.fn(), push: vi.fn() })),
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
    productName: "Camisa Oxford",
    productFamily: "Camisas",
    size: "M",
    color: "Blanco",
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
    returnDeadline: "2026-10-29T15:30:00Z",
    shippingAddress: {
        fullName: "Ana García",
        street: "Calle Mayor 1",
        city: "Madrid",
        postalCode: "28013",
        countryCode: "ES",
    },
    paymentMethod: "CARD",
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
    role: "USER",
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
            expect(screen.getByText("Detalle del pedido")).toBeInTheDocument();
            expect(
                screen.getByRole("heading", { level: 1, name: "Pedido" })
            ).toBeInTheDocument();
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
            expect(screen.getByText("Detalle del pedido")).toBeInTheDocument();
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

// ── Tarea 5.5 — Rediseño de la ficha ─────────────────────────────────────────

describe("OrderDetailPage — rediseño (spec order-detail-redesign)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        vi.mocked(useParams).mockReturnValue({ orderNumber: "ORD-TEST-99" });
    });

    it("R6 — copia el número de pedido con el botón «Copiar»", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });
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

        await screen.findByText("Detalle del pedido");
        fireEvent.click(screen.getByTestId("copy-order-number"));

        expect(writeText).toHaveBeenCalledWith("ORD-TEST-99");
        // Confirmación visible mientras dure el aviso de 2 s
        await waitFor(() => {
            expect(screen.getByTestId("copy-order-number")).toHaveTextContent("Copiado");
        });
    });

    it("R6 — sin navigator.clipboard no revienta la ficha", async () => {
        Object.defineProperty(navigator, "clipboard", {
            value: undefined,
            configurable: true,
        });
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

        await screen.findByText("Detalle del pedido");

        // El guard del try/catch evita el TypeError y la página sigue en pie
        expect(() =>
            fireEvent.click(screen.getByTestId("copy-order-number"))
        ).not.toThrow();
        expect(screen.getByTestId("order-number")).toHaveTextContent("ORD-TEST-99");
        expect(screen.getByTestId("copy-order-number")).toHaveTextContent("Copiar");
    });

    it("R3 — pinta nombre, familia, talla, color y referencia de cada producto", async () => {
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

        await screen.findByText("Detalle del pedido");

        expect(screen.getByText("Camisa Oxford")).toBeInTheDocument();
        expect(screen.getByText(/Camisas · Talla M · Blanco/)).toBeInTheDocument();
        expect(screen.getByText(/Referencia 843321900101 · Cantidad 1/)).toBeInTheDocument();
        // R8: la caja decorativa reutiliza el mismo placeholder que el carrito
        expect(screen.getByTestId("product-thumb")).toBeInTheDocument();
    });

    it("R4 — muestra la fecha de compra y el límite de devolución", async () => {
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

        expect(await screen.findByText("29 de septiembre de 2026")).toBeInTheDocument();
        // R4: el límite lo calcula el backend, el cliente solo lo pinta
        expect(screen.getByTestId("return-deadline")).toHaveTextContent(
            "29 de octubre de 2026"
        );
    });

    it("R1 y R2 — pinta la dirección de envío y el método de pago", async () => {
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

        await screen.findByText("Detalle del pedido");

        const address = screen.getByTestId("shipping-address");
        expect(address).toHaveTextContent("Ana García");
        expect(address).toHaveTextContent("Calle Mayor 1");
        expect(address).toHaveTextContent("28013");
        expect(address).toHaveTextContent("Madrid");

        // R2: la etiqueta es «Tarjeta», nunca un número de tarjeta
        const payment = screen.getByTestId("payment-method");
        expect(payment).toHaveTextContent("Tarjeta");
        expect(payment).not.toHaveTextContent(/\d{4}/);
    });

    it("R7 — las órdenes anteriores a V10 no pintan ni dirección ni pago vacíos", async () => {
        // Con sesión para que llegue hasta la sección de devoluciones
        localStorage.setItem("nexus-auth-token", "test-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
        vi.mocked(api.getMyReturns).mockResolvedValue([]);
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            returnDeadline: null,
            shippingAddress: null,
            paymentMethod: null,
        });

        render(
            <AuthProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <OrderDetailPage />
                    </CartDrawerProvider>
                </CartProvider>
            </AuthProvider>
        );

        await screen.findByText("Detalle del pedido");

        expect(screen.queryByTestId("shipping-address")).not.toBeInTheDocument();
        expect(screen.queryByTestId("payment-method")).not.toBeInTheDocument();
        expect(screen.queryByTestId("return-deadline")).not.toBeInTheDocument();
        // Sección de devoluciones conservada (Tarea 5.4)
        expect(screen.getByRole("heading", { name: "Devoluciones" })).toBeInTheDocument();
    });

    it("R10 — muestra el badge «Devolución solicitada» cuando alguna línea ya devolvió", async () => {
        vi.mocked(api.getOrder).mockResolvedValue({
            ...mockOrder,
            items: [{ ...baseItem, returnEligible: false, returnIneligibleReason: "ALREADY_RETURNED" }],
        });

        render(
            <AuthProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <OrderDetailPage />
                    </CartDrawerProvider>
                </CartProvider>
            </AuthProvider>
        );

        // Sin sesión no llega `getMyReturns`, así que sale del propio motivo
        expect(await screen.findByTestId("return-requested-badge")).toBeInTheDocument();
        expect(api.getMyReturns).not.toHaveBeenCalled();
    });

    it("R5 — ofrece volver a mis pedidos", async () => {
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

        await screen.findByText("Detalle del pedido");
        expect(screen.getByTestId("back-link")).toBeInTheDocument();
    });

    it("§5.7 — da las gracias solo al llegar desde el checkout", async () => {
        sessionStorage.setItem("nexus-just-checked-out", "ORD-TEST-99");
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

        expect(await screen.findByText("Gracias por tu compra")).toBeInTheDocument();
        expect(screen.getByText("Pedido confirmado")).toBeInTheDocument();
        // Se consume en cuanto se lee: una recarga no vuelve a dar las gracias
        expect(
            sessionStorage.getItem("nexus-just-checked-out")
        ).toBeNull();
    });
});
