import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import CartDrawer from "@/components/CartDrawer";
import { CartItem } from "@/types/commerce";

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

const mockItem: CartItem = {
    productId: 1,
    referenceCode: "0432/021",
    name: "Camisa de Lino",
    family: "SHIRTS",
    skuId: 101,
    size: "M",
    color: "Blanco",
    quantity: 2,
    unitPrice: 89.95,
    currency: "EUR",
};

function TestComponent() {
    return (
        <CartProvider>
            <CartDrawerProvider>
                <CartDrawer />
            </CartDrawerProvider>
        </CartProvider>
    );
}

describe("CartDrawer", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("debe estar cerrado por defecto (translate-x-full)", () => {
        render(<TestComponent />);
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveClass("translate-x-full");
    });

    it("debe mostrar mensaje de carrito vacío cuando no hay items", () => {
        localStorage.setItem("nexus-cart", JSON.stringify([]));
        render(<TestComponent />);
        // El drawer existe pero está oculto
        expect(screen.getByText(/tu bolsa está vacía/i)).toBeInTheDocument();
    });

    it("debe renderizar el drawer cuando está abierto", () => {
        localStorage.setItem("nexus-cart", JSON.stringify([mockItem]));
        render(<TestComponent />);
        // El drawer existe pero está oculto (translate-x-full)
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();
    });

    it("R2 — Total = Subtotal y la parte incluida es informativa (no se suma)", () => {
        // GIVEN — 2 × 89,95 = 179,90, precio **final** con impuesto dentro (ES 21 %)
        localStorage.setItem("nexus-cart", JSON.stringify([mockItem]));
        render(<TestComponent />);

        // Acotamos al diálogo: fuera están los botones del artículo
        const drawer = within(screen.getByRole("dialog"));

        // THEN — la parte incluida es 179,90 × 21/121 = 31,22 …
        expect(drawer.getByText("Impuestos incluidos (21 %)")).toBeInTheDocument();
        expect(drawer.getByText(/31\.22/)).toBeInTheDocument();
        // … y la fila «Total» muestra exactamente el mismo importe que la fila
        // «Subtotal», sin sumar nada encima: el drawer anterior enseñaba
        // 217,68 cuando el checkout cobra 179,90.
        expect(
            within(drawer.getByText(/^Subtotal$/i).closest("div") as HTMLElement).getByText(/179\.90/)
        ).toBeInTheDocument();
        expect(
            within(drawer.getByText(/^Total$/i).closest("div") as HTMLElement).getByText(/179\.90/)
        ).toBeInTheDocument();
        expect(drawer.queryByText(/217\.68/)).not.toBeInTheDocument();
        expect(drawer.queryByText(/total estimado/i)).not.toBeInTheDocument();
        expect(drawer.queryByText(/impuestos estimados/i)).not.toBeInTheDocument();
    });
});
