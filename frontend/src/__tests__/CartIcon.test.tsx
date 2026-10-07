import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CartIcon from "@/components/CartIcon";

/**
 * Tarea 4.1, R1 — icono de la bolsa con su contador.
 *
 * Dos reglas visuales: sin artículos no hay badge (un «0» pegado al icono
 * sólo añade ruido) y a partir de 100 el badge se queda en `99+` para que no
 * rompa el icono en móvil.
 */

const useCartMock = vi.hoisted(() => vi.fn());
vi.mock("@/context/CartContext", () => ({ useCart: () => useCartMock() }));

function pintar(totalItems: number) {
    useCartMock.mockReturnValue({ totalItems });
    return render(<CartIcon />);
}

describe("CartIcon", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sin artículos no pinta badge", () => {
        // GIVEN un carrito vacío
        const { container } = pintar(0);

        // THEN sólo queda el icono
        expect(container.querySelector("button span")).not.toBeInTheDocument();
    });

    it("con un artículo pinta el badge con su cuenta", () => {
        const { container } = pintar(1);

        expect(container.querySelector("button span")).toHaveTextContent("1");
    });

    it("a partir de 100 el badge se queda en «99+»", () => {
        // GIVEN un carrito con más de lo que el badge puede mostrar
        const { container } = pintar(120);

        // THEN no crece sin control
        expect(container.querySelector("button span")).toHaveTextContent("99+");
    });

    it("anuncia el número de artículos en el aria-label", () => {
        pintar(3);

        expect(
            screen.getByRole("button", { name: "Carrito con 3 artículos" })
        ).toBeInTheDocument();
    });

    it("el aria-label refleja también el carrito vacío", () => {
        pintar(0);

        expect(
            screen.getByRole("button", { name: "Carrito con 0 artículos" })
        ).toBeInTheDocument();
    });
});
