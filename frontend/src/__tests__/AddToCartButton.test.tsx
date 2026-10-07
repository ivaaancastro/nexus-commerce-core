import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AddToCartButton from "@/components/AddToCartButton";
import type { CartItem } from "@/types/commerce";

/**
 * Tarea 4.1, R1 — botón «Añadir a la bolsa».
 *
 * Protege dos cosas: que el `CartItem` que llega al contexto esté **completo**
 * (si falla un campo, el carrito persiste mal) y que la confirmación temporal
 * se vaya sola, sin dejar la capa encima del panel de compra.
 */

const useCartMock = vi.hoisted(() => vi.fn());
vi.mock("@/context/CartContext", () => ({ useCart: () => useCartMock() }));

const PROPS = {
    productId: 4321,
    referenceCode: "0432/021",
    name: "Abrigo de lana",
    family: "OUTERWEAR",
    skuId: 17,
    size: "M",
    color: "Negro",
    unitPrice: 89.99,
    currency: "EUR",
    imageUrl: "0432-021-1.webp",
};

/** El objeto que se espera en el carrito, campo a campo. */
const ESPERADO: CartItem = { ...PROPS, quantity: 1 };

describe("AddToCartButton", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useCartMock.mockReturnValue({ addItem: vi.fn() });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("al pulsar añade el CartItem completo con quantity 1", async () => {
        // GIVEN el botón de una ficha con todos los datos del SKU
        const user = userEvent.setup();
        render(<AddToCartButton {...PROPS} />);
        const addItem = useCartMock().addItem;

        // WHEN se pulsa
        await user.click(screen.getByRole("button", { name: "Añadir a la bolsa" }));

        // THEN el contexto recibe la línea entera, incluida la imagen
        expect(addItem).toHaveBeenCalledTimes(1);
        expect(addItem).toHaveBeenCalledWith(ESPERADO);
    });

    it("muestra la confirmación con el nombre y la talla elegida", async () => {
        const user = userEvent.setup();
        render(<AddToCartButton {...PROPS} />);

        await user.click(screen.getByRole("button", { name: "Añadir a la bolsa" }));

        expect(screen.getByText(/Añadido a la bolsa — Abrigo de lana \(Talla M\)/)).toBeInTheDocument();
    });

    it("la confirmación desaparece sola a los 2500 ms", async () => {
        // GIVEN temporizadores falsos para no esperar los 2,5 s reales.
        //
        // Excepción documentada a R7: aquí el clic es `fireEvent`, no userEvent.
        // user-event v14 se cuelga indefinidamente con los temporizadores falsos
        // de Vitest — comprobado con las cuatro combinaciones posibles
        // (`toFake` completo/`setTimeout` sólo × con/sin `advanceTimers` y con
        // `delay: null`): ninguna llega a devolver el clic. El resto de tests
        // del fichero usan userEvent con normalidad.
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        render(<AddToCartButton {...PROPS} />);

        // WHEN se añade y transcurre el tiempo de la confirmación
        fireEvent.click(screen.getByRole("button", { name: "Añadir a la bolsa" }));
        expect(screen.getByText(/Añadido a la bolsa/)).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(2500);
        });

        // THEN la capa ya no tapa el panel de compra
        expect(screen.queryByText(/Añadido a la bolsa/)).not.toBeInTheDocument();
    });

    it("con `disabled` no se puede añadir nada", async () => {
        // GIVEN una talla sin stock
        const user = userEvent.setup();
        render(<AddToCartButton {...PROPS} disabled />);
        const addItem = useCartMock().addItem;

        // WHEN se intenta pulsar
        const boton = screen.getByRole("button", { name: "Añadir a la bolsa" });
        expect(boton).toBeDisabled();
        await user.click(boton);

        // THEN el contexto no recibe nada
        expect(addItem).not.toHaveBeenCalled();
        expect(screen.queryByText(/Añadido a la bolsa/)).not.toBeInTheDocument();
    });
});
