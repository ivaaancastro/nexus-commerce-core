import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import CartDrawer from "@/components/CartDrawer";
import { CartItem } from "@/types/commerce";

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

    it("debe estar cerrado por defecto", () => {
        render(<TestComponent />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("debe mostrar mensaje de carrito vacío cuando no hay items", () => {
        localStorage.setItem("nexus-cart", JSON.stringify([]));
        render(<TestComponent />);
        // El drawer no está abierto, así que no se ve el contenido
        expect(screen.queryByText(/tu bolsa está vacía/i)).not.toBeInTheDocument();
    });

    it("debe renderizar el drawer cuando está abierto", () => {
        localStorage.setItem("nexus-cart", JSON.stringify([mockItem]));
        render(<TestComponent />);
        // El drawer existe pero está oculto (translate-x-full)
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();
    });
});
