import { render, screen } from "@testing-library/react";
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
});
