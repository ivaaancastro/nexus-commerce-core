import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CartItemRow from "@/components/CartItemRow";
import type { CartItem } from "@/types/commerce";

/**
 * Tarea 4.1, R1 — fila de una línea del carrito.
 *
 * El caso que más importa es el de decrementar estando en 1: tiene que
 * **eliminar la línea**, no dejarla a 0, o el carrito se queda con filas
 * muertas que el usuario no puede cerrar.
 */

const useCartMock = vi.hoisted(() => vi.fn());
vi.mock("@/context/CartContext", () => ({ useCart: () => useCartMock() }));

const item: CartItem = {
    productId: 4321,
    referenceCode: "0432/021",
    name: "Abrigo de lana",
    family: "OUTERWEAR",
    skuId: 17,
    size: "M",
    color: "Negro",
    quantity: 2,
    unitPrice: 89.99,
    currency: "EUR",
};

function montar(overrides: Partial<CartItem> = {}) {
    const updateQuantity = vi.fn();
    const removeItem = vi.fn();
    useCartMock.mockReturnValue({ updateQuantity, removeItem });

    const props = { ...item, ...overrides };
    const view = render(<CartItemRow item={props} />);
    return { ...view, updateQuantity, removeItem, item: props };
}

describe("CartItemRow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("muestra el nombre y la talla con el color", () => {
        // GIVEN una línea del carrito
        montar();

        // THEN el usuario ve qué es y qué talla/color tiene
        expect(
            screen.getByRole("heading", { name: "Abrigo de lana" })
        ).toBeInTheDocument();
        expect(screen.getByText(/Talla M · Negro/)).toBeInTheDocument();
    });

    it("total = precio unitario × cantidad, con dos decimales", () => {
        // GIVEN un artículo de 89,99 € y dos unidades
        montar({ quantity: 2, unitPrice: 89.99 });

        // THEN la línea suma 179,98 EUR
        expect(screen.getByText("179.98 EUR")).toBeInTheDocument();
    });

    it("«Aumentar cantidad» incrementa en uno sobre la cantidad actual", async () => {
        // GIVEN una línea con dos unidades
        const user = userEvent.setup();
        const { updateQuantity, item: props } = montar({ quantity: 2 });

        // WHEN se pulsa «+»
        await user.click(screen.getByRole("button", { name: "Aumentar cantidad" }));

        // THEN se pide actualizar la misma línea a 3
        expect(updateQuantity).toHaveBeenCalledTimes(1);
        expect(updateQuantity).toHaveBeenCalledWith(props.skuId, props.size, 3);
    });

    it("«Disminuir cantidad» con más de una unidad decrementa", async () => {
        const user = userEvent.setup();
        const { updateQuantity, removeItem, item: props } = montar({ quantity: 2 });

        await user.click(screen.getByRole("button", { name: "Disminuir cantidad" }));

        expect(updateQuantity).toHaveBeenCalledWith(props.skuId, props.size, 1);
        // Mientras queden unidades no se elimina la línea
        expect(removeItem).not.toHaveBeenCalled();
    });

    it("«Disminuir cantidad» con una unidad elimina la línea en vez de dejarla en 0", async () => {
        // GIVEN una línea ya en su mínima expresión
        const user = userEvent.setup();
        const { removeItem, updateQuantity, item: props } = montar({ quantity: 1 });

        // WHEN se vuelve a pulsar «−»
        await user.click(screen.getByRole("button", { name: "Disminuir cantidad" }));

        // THEN la línea desaparece: no queda ningún artículo a 0
        expect(removeItem).toHaveBeenCalledWith(props.skuId, props.size);
        expect(updateQuantity).not.toHaveBeenCalled();
    });

    it("«Eliminar … del carrito» retira la línea", async () => {
        const user = userEvent.setup();
        const { removeItem, item: props } = montar();

        await user.click(
            screen.getByRole("button", { name: `Eliminar ${props.name} del carrito` })
        );

        expect(removeItem).toHaveBeenCalledWith(props.skuId, props.size);
    });

    it("usa ProductThumb y nunca un <img> (Tarea 5.5, R8)", () => {
        // GIVEN el proyecto no tiene dataset de fotos
        const { container } = montar();

        // THEN la imagen es el placeholder editorial y no hay elementos <img>
        expect(screen.getByTestId("product-thumb")).toBeInTheDocument();
        expect(screen.getByTestId("product-thumb")).toHaveAttribute(
            "data-product-name",
            "Abrigo de lana"
        );
        expect(container.querySelector("img")).toBeNull();
    });
});
