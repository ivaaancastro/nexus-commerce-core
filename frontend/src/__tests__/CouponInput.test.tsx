import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CouponInput } from "@/components/CouponInput";
import { CartProvider } from "@/context/CartContext";
import { MarketProvider } from "@/context/MarketContext";
import { api } from "@/lib/api";
import { CouponValidationResponse } from "@/types/commerce";

vi.mock("@/lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api")>();
    return {
        ...actual,
        api: {
            ...actual.api,
            validateCoupon: vi.fn(),
            // MarketContext pide la lista al montar; sin ella sigue con ES.
            getMarkets: vi.fn(),
        },
    };
});

const validateCouponMock = vi.mocked(api.validateCoupon);

beforeEach(() => {
    // MarketContext llama a getMarkets().then(...) al montar: sin retorno
    // prometido el mock devuelve undefined y el efecto revienta.
    vi.mocked(api.getMarkets).mockResolvedValue([
        { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    ]);
});

/** Respuesta válida del backend: 10 % sobre 89,95 → 9,00 de descuento. */
const VALIDA: CouponValidationResponse = {
    valid: true,
    message: "Cupón aplicado",
    discountAmount: 9,
    coupon: { code: "SAVE10", type: "PERCENTAGE", value: 10 },
};

const INVALIDA: CouponValidationResponse = {
    valid: false,
    message: "Este cupón ha expirado",
    discountAmount: 0,
    coupon: { code: "OLD", type: "PERCENTAGE", value: 10 },
};

function renderInput() {
    return render(
        <MarketProvider>
            <CartProvider>
                <CouponInput />
            </CartProvider>
        </MarketProvider>
    );
}

describe("CouponInput — V5 cupones (spec §2.4)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("no dispara la validación con menos de 3 caracteres (debounce)", async () => {
        // GIVEN
        validateCouponMock.mockResolvedValue(VALIDA);
        const user = userEvent.setup();
        renderInput();

        // WHEN — 2 caracteres y se espera más del doble del debounce
        await user.type(screen.getByLabelText("Código de cupón"), "AB");
        await new Promise((resolve) => setTimeout(resolve, 1100));

        // THEN — ni una llamada al backend
        expect(validateCouponMock).not.toHaveBeenCalled();
    });

    it("valida tras el debounce y muestra el descuento cuando es válido", async () => {
        // GIVEN
        validateCouponMock.mockResolvedValue(VALIDA);
        const user = userEvent.setup();
        renderInput();

        // WHEN
        await user.type(screen.getByLabelText("Código de cupón"), "save10");

        // THEN — la llamada sale con el código en mayúsculas y el subtotal
        // real del carrito (vacío: 0), en unidades mayores (§2.6A)
        await waitFor(
            () => expect(validateCouponMock).toHaveBeenCalledWith({ code: "SAVE10", subtotal: 0 }),
            { timeout: 2000 }
        );
        await waitFor(
            () => expect(screen.getByRole("status")).toHaveTextContent(/Cupón aplicado/),
            { timeout: 2000 }
        );
        // El importe se pinta como dinero (Intl.NumberFormat, D13), no como
        // porcentaje: «9,00 €» en el mercado ES activo por defecto.
        expect(screen.getByRole("status")).toHaveTextContent(/−?9,00\s?€/u);
    });

    it("muestra el mensaje del servidor cuando el cupón no es válido", async () => {
        // GIVEN
        validateCouponMock.mockResolvedValue(INVALIDA);
        const user = userEvent.setup();
        renderInput();

        // WHEN
        await user.type(screen.getByLabelText("Código de cupón"), "OLD10");

        // THEN
        await waitFor(
            () => expect(screen.getByRole("status")).toHaveTextContent("Este cupón ha expirado"),
            { timeout: 2000 }
        );
        // Nunca queda botón de «quitar»: un intento inválido no aplica cupón
        expect(screen.queryByRole("button", { name: "Quitar cupón" })).not.toBeInTheDocument();
    });

    it("ofrece quitar el cupón cuando la validación fue correcta", async () => {
        // GIVEN
        validateCouponMock.mockResolvedValue(VALIDA);
        const user = userEvent.setup();
        renderInput();

        // WHEN
        await user.type(screen.getByLabelText("Código de cupón"), "SAVE10");
        await waitFor(
            () => expect(screen.getByRole("status")).toHaveTextContent(/Cupón aplicado/),
            { timeout: 2000 }
        );

        // THEN — el botón existe y al pulsarlo retira el cupón del contexto
        const quitar = screen.getByRole("button", { name: "Quitar cupón" });
        await user.click(quitar);
        await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
        expect(screen.getByLabelText("Código de cupón")).toHaveValue("");
    });
});
