import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BackLink from "@/components/BackLink";

/**
 * R5 de specs/order-detail-redesign: toda pantalla tiene una vía de vuelta.
 *
 * El detalle es el fallback: sin él el botón se quedaría mudo al entrar
 * directamente en la URL (recarga, enlace compartido), que es justo cuando
 * más se necesita volver atrás.
 */

const { backMock, pushMock } = vi.hoisted(() => ({
    backMock: vi.fn(),
    pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ back: backMock, push: pushMock }),
}));

/** jsdom expone `history.length` como getter de prototipo; se tapa en la instancia. */
function setHistoryLength(value: number) {
    Object.defineProperty(window.history, "length", {
        value,
        configurable: true,
    });
}

describe("BackLink", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("usa router.back() cuando hay una pantalla anterior en el historial", () => {
        setHistoryLength(3);

        render(<BackLink href="/orders" />);
        fireEvent.click(screen.getByTestId("back-link"));

        expect(backMock).toHaveBeenCalledTimes(1);
        expect(pushMock).not.toHaveBeenCalled();
    });

    it("cae a router.push(href) cuando el historial está vacío", () => {
        setHistoryLength(1);

        render(<BackLink href="/orders" />);
        fireEvent.click(screen.getByTestId("back-link"));

        expect(backMock).not.toHaveBeenCalled();
        expect(pushMock).toHaveBeenCalledWith("/orders");
    });

    it("respeta el destino de fallback de cada pantalla", () => {
        setHistoryLength(1);

        render(<BackLink href="/profile" />);
        fireEvent.click(screen.getByTestId("back-link"));

        expect(pushMock).toHaveBeenCalledWith("/profile");
    });

    it("muestra la flecha decorativa y el texto, con «Volver» por defecto", () => {
        setHistoryLength(1);

        const { rerender } = render(<BackLink href="/" />);

        expect(screen.getByTestId("back-link")).toHaveTextContent("Volver");
        expect(
            screen.getByText("←", { selector: '[aria-hidden="true"]' })
        ).toBeInTheDocument();

        rerender(<BackLink href="/" label="Mis pedidos" />);
        expect(screen.getByTestId("back-link")).toHaveTextContent("Mis pedidos");
    });

    it("es un botón real, operable con teclado", () => {
        setHistoryLength(1);

        render(<BackLink href="/" />);

        const button = screen.getByRole("button", { name: /volver/i });
        expect(button).toHaveAttribute("type", "button");
        button.focus();
        expect(button).toHaveFocus();
    });
});
