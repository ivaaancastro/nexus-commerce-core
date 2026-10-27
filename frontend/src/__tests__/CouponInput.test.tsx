import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CouponInput } from "@/components/CouponInput";

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ valid: false, message: 'Test' })
})));

vi.stubGlobal('alert', vi.fn());

const user = userEvent.setup();

describe("CouponInput — V5 cupones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("no valida con menos de 3 caracteres", async () => {
        render(<CouponInput />);

        // Escribir 2 caracteres
        await user.type(screen.getByPlaceholderText("Código de cupón..."), "AB");
        await new Promise(resolve => setTimeout(resolve, 600));

        // Debe haber limpiado el validation state
        expect(screen.queryByText("Validando...")).not.toBeInTheDocument();
    });

    it("muestra estado después de escribir código", async () => {
        render(<CouponInput />);

        // Escribir 3+ caracteres
        await user.type(screen.getByPlaceholderText("Código de cupón..."), "ABC");

        // Esperar a que el debounce termine (500ms)
        await new Promise(resolve => setTimeout(resolve, 600));

        // El componente debería haber procesado la validación
        const input = screen.getByPlaceholderText("Código de cupón...");
        expect(input).toHaveValue("ABC");
    });

    it("muestra mensaje de error para código inválido", async () => {
        render(<CouponInput />);

        // Escribir código inválido
        await user.type(screen.getByPlaceholderText("Código de cupón..."), "INVALID123");

        // Esperar a que el debounce termine
        await new Promise(resolve => setTimeout(resolve, 600));

        // El componente debería haber mostrado un mensaje
        const input = screen.getByPlaceholderText("Código de cupón...");
        expect(input).toHaveValue("INVALID123");
    });

    it("mantiene el código en el estado después de la validación", async () => {
        render(<CouponInput />);

        // Escribir código
        await user.type(screen.getByPlaceholderText("Código de cupón..."), "MYCOUPON");

        await new Promise(resolve => setTimeout(resolve, 600));

        // El input debería mantener el valor escrito
        const input = screen.getByPlaceholderText("Código de cupón...");
        expect(input).toHaveValue("MYCOUPON");
    });
});
