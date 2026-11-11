import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PayPage from "@/app/orders/[orderNumber]/pay/page";
import { api } from "@/lib/api";
import type { Order, PaymentSession } from "@/types/commerce";

/**
 * Fase 9 (R9.3, D14) — la pantalla de pago. Stripe se simula entero: lo que se
 * prueba es la página (carga, errores, navegación), no el Payment Element.
 */

const { pushMock, replaceMock, confirmPaymentMock, loadStripeMock } = vi.hoisted(() => ({
    pushMock: vi.fn(),
    replaceMock: vi.fn(),
    confirmPaymentMock: vi.fn(),
    loadStripeMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: replaceMock, back: vi.fn() }),
    useParams: () => ({ orderNumber: "ORD-PAY-1" }),
}));

vi.mock("@stripe/stripe-js", () => ({ loadStripe: loadStripeMock }));

vi.mock("@stripe/react-stripe-js", () => ({
    Elements: ({ children, options }: { children: ReactNode; options: { clientSecret: string } }) => (
        <div data-testid="elements" data-secret={options.clientSecret}>
            {children}
        </div>
    ),
    PaymentElement: () => <div data-testid="payment-element" />,
    useStripe: () => ({ confirmPayment: confirmPaymentMock }),
    useElements: () => ({}),
}));

// Header y ProtectedRoute tienen sus propios tests: aquí sólo estorban.
vi.mock("@/components/Header", () => ({ default: () => <header /> }));
vi.mock("@/components/ProtectedRoute", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/BackLink", () => ({ default: () => <button type="button">Volver</button> }));

vi.mock("@/lib/api", () => ({
    api: { getOrder: vi.fn(), getOrderPayment: vi.fn() },
}));

const pedido = { orderNumber: "ORD-PAY-1", currency: "EUR", totalAmount: 96.8, status: "PENDING" } as Order;
const sesion: PaymentSession = {
    clientSecret: "pi_secret_abc",
    publishableKey: "pk_test_abc",
    paymentStatus: "REQUIRES_PAYMENT",
};

describe("PayPage — pago con Stripe", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadStripeMock.mockResolvedValue({});
        vi.mocked(api.getOrder).mockResolvedValue(pedido);
        vi.mocked(api.getOrderPayment).mockResolvedValue(sesion);
    });

    it("carga el pedido y la sesión: total, Payment Element y botón «Pagar»", async () => {
        render(<PayPage />);

        expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
        expect(screen.getByTestId("elements")).toHaveAttribute("data-secret", "pi_secret_abc");
        expect(screen.getByText("Pedido ORD-PAY-1")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Pagar / })).toBeEnabled();
        expect(loadStripeMock).toHaveBeenCalledWith("pk_test_abc");
        // Aviso honesto de modo test y de la reserva de 30 min
        expect(screen.getByText(/modo de pruebas/i)).toBeInTheDocument();
        expect(screen.getByText(/30 minutos/i)).toBeInTheDocument();
    });

    it("pago correcto: confirma sin redirección forzada y navega a la ficha con redirect_status", async () => {
        const usuario = userEvent.setup();
        confirmPaymentMock.mockResolvedValue({ paymentIntent: { status: "succeeded" } });

        render(<PayPage />);
        await usuario.click(await screen.findByRole("button", { name: /^Pagar / }));

        await waitFor(() =>
            expect(pushMock).toHaveBeenCalledWith("/orders/ORD-PAY-1?redirect_status=succeeded")
        );
        expect(confirmPaymentMock).toHaveBeenCalledWith(
            expect.objectContaining({
                redirect: "if_required",
                confirmParams: expect.objectContaining({
                    return_url: expect.stringMatching(/\/orders\/ORD-PAY-1$/),
                }),
            })
        );
    });

    it("pago aún en proceso (no succeeded): navega como «processing», sin afirmar éxito", async () => {
        const usuario = userEvent.setup();
        confirmPaymentMock.mockResolvedValue({ paymentIntent: { status: "processing" } });

        render(<PayPage />);
        await usuario.click(await screen.findByRole("button", { name: /^Pagar / }));

        await waitFor(() =>
            expect(pushMock).toHaveBeenCalledWith("/orders/ORD-PAY-1?redirect_status=processing")
        );
    });

    it("tarjeta rechazada: muestra el mensaje de Stripe, no navega y deja reintentar", async () => {
        const usuario = userEvent.setup();
        confirmPaymentMock.mockResolvedValue({
            error: { type: "card_error", message: "Tu tarjeta ha sido rechazada." },
        });

        render(<PayPage />);
        await usuario.click(await screen.findByRole("button", { name: /^Pagar / }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Tu tarjeta ha sido rechazada.");
        expect(pushMock).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: /^Pagar / })).toBeEnabled();
    });

    it("error técnico de Stripe (conexión, API…): no se enseña crudo, texto de respaldo amigable", async () => {
        const usuario = userEvent.setup();
        confirmPaymentMock.mockResolvedValue({
            error: { type: "api_connection_error", message: "An error occurred with our connection to Stripe." },
        });

        render(<PayPage />);
        await usuario.click(await screen.findByRole("button", { name: /^Pagar / }));

        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent(/No se ha podido completar el pago/);
        expect(alerta).not.toHaveTextContent(/connection to Stripe/);
    });

    it("error de Stripe sin mensaje: texto de respaldo amigable", async () => {
        const usuario = userEvent.setup();
        confirmPaymentMock.mockResolvedValue({ error: {} });

        render(<PayPage />);
        await usuario.click(await screen.findByRole("button", { name: /^Pagar / }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/No se ha podido completar el pago/);
    });

    it("409 (ya pagado, caducado o sin pasarela): redirige a la ficha del pedido", async () => {
        vi.mocked(api.getOrderPayment).mockRejectedValue(
            new Error('API Error [409]: {"code":"PAYMENT_CONFLICT","message":"sin pago pendiente"}')
        );

        render(<PayPage />);

        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/orders/ORD-PAY-1"));
        expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
    });

    it("otro fallo (red, 404, 502): alerta con mensaje amigable y sin Payment Element", async () => {
        vi.mocked(api.getOrderPayment).mockRejectedValue(
            new Error('API Error [502]: {"code":"PAYMENT_GATEWAY_ERROR"}')
        );

        render(<PayPage />);

        expect(await screen.findByRole("alert")).toHaveTextContent(/pasarela de pago/);
        expect(replaceMock).not.toHaveBeenCalled();
        expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
    });
});
