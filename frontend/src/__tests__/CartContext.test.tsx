import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CartProvider, useCart } from "@/context/CartContext";
import { CartItem } from "@/types/commerce";

const mockItem: CartItem = {
    productId: 1,
    referenceCode: "0432/021",
    name: "Camisa de Lino",
    family: "SHIRTS",
    skuId: 101,
    size: "M",
    color: "Blanco",
    quantity: 1,
    unitPrice: 89.95,
    currency: "EUR",
};

const mockItem2: CartItem = {
    productId: 2,
    referenceCode: "0432/022",
    name: "Pantalón Chino",
    family: "TROUSERS",
    skuId: 102,
    size: "L",
    color: "Beige",
    quantity: 1,
    unitPrice: 129.95,
    currency: "EUR",
};

function TestComponent() {
    const { items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal, taxEstimate, currency } = useCart();

    return (
        <div>
            <span data-testid="total-items">{totalItems}</span>
            <span data-testid="subtotal">{subtotal.toFixed(2)}</span>
            <span data-testid="tax">{taxEstimate.toFixed(2)}</span>
            <span data-testid="currency">{currency}</span>
            <span data-testid="item-count">{items.length}</span>

            <button onClick={() => addItem(mockItem)}>Add Item 1</button>
            <button onClick={() => addItem(mockItem2)}>Add Item 2</button>
            <button onClick={() => removeItem(101, "M")}>Remove Item 1</button>
            <button onClick={() => updateQuantity(101, "M", 3)}>Update Qty to 3</button>
            <button onClick={() => updateQuantity(101, "M", 0)}>Update Qty to 0</button>
            <button onClick={clearCart}>Clear Cart</button>

            <ul>
                {items.map((item) => (
                    <li key={`${item.skuId}-${item.size}`}>
                        {item.name} - Talla {item.size} - Qty: {item.quantity}
                    </li>
                ))}
            </ul>
        </div>
    );
}

describe("CartContext", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe("Estado inicial", () => {
        it("debe iniciar con carrito vacío", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            expect(screen.getByTestId("total-items")).toHaveTextContent("0");
            expect(screen.getByTestId("item-count")).toHaveTextContent("0");
            expect(screen.getByTestId("currency")).toHaveTextContent("EUR");
        });
    });

    describe("addItem", () => {
        it("debe añadir un item al carrito", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("1");
            expect(screen.getByTestId("item-count")).toHaveTextContent("1");
        });

        it("debe incrementar cantidad si el item mismo (skuId + size) ya existe", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Add Item 1"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("2");
            expect(screen.getByTestId("item-count")).toHaveTextContent("1");
        });

        it("debe añadir como línea diferente si la talla es distinta", () => {
            // Pre-cargar localStorage con dos items de distinta talla
            const itemTallaM = { ...mockItem, size: "M" };
            const itemTallaL = { ...mockItem, size: "L" };
            localStorage.setItem("nexus-cart", JSON.stringify([itemTallaM, itemTallaL]));

            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            expect(screen.getByTestId("item-count")).toHaveTextContent("2");
            expect(screen.getByTestId("total-items")).toHaveTextContent("2");
        });
    });

    describe("removeItem", () => {
        it("debe eliminar un item del carrito", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Remove Item 1"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("0");
            expect(screen.getByTestId("item-count")).toHaveTextContent("0");
        });
    });

    describe("updateQuantity", () => {
        it("debe actualizar la cantidad de un item", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Update Qty to 3"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("3");
        });

        it("debe eliminar el item si la cantidad es 0", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Update Qty to 0"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("0");
            expect(screen.getByTestId("item-count")).toHaveTextContent("0");
        });
    });

    describe("clearCart", () => {
        it("debe vaciar todo el carrito", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Add Item 2"));
            fireEvent.click(screen.getByText("Clear Cart"));

            expect(screen.getByTestId("total-items")).toHaveTextContent("0");
            expect(screen.getByTestId("item-count")).toHaveTextContent("0");
        });
    });

    describe("Cálculos derivados", () => {
        it("debe calcular subtotal correctamente", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));
            fireEvent.click(screen.getByText("Add Item 2"));

            const expectedSubtotal = (89.95 + 129.95).toFixed(2);
            expect(screen.getByTestId("subtotal")).toHaveTextContent(expectedSubtotal);
        });

        it("debe calcular impuesto estimado (21% IVA)", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));

            const expectedTax = (89.95 * 0.21).toFixed(2);
            expect(screen.getByTestId("tax")).toHaveTextContent(expectedTax);
        });
    });

    describe("Persistencia en localStorage", () => {
        it("debe persistir items en localStorage", () => {
            render(
                <CartProvider>
                    <TestComponent />
                </CartProvider>
            );

            fireEvent.click(screen.getByText("Add Item 1"));

            const stored = localStorage.getItem("nexus-cart");
            expect(stored).toBeTruthy();
            expect(JSON.parse(stored!)).toHaveLength(1);
        });
    });
});
