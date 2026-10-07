import { describe, it, expect } from "vitest";
import { JUST_CHECKED_OUT_KEY } from "@/lib/checkout";

/**
 * Tarea 4.1, R1 — la clave que separa «acabo de comprar» de «estoy mirando un
 * pedido viejo».
 *
 * La escribe `cart/page.tsx` al crear el pedido y la lee una sola vez
 * `orders/[orderNumber]/page.tsx` para decidir si enseña el resumen de compra.
 * Si se renombrara en un sitio y no en el otro, la ficha dejaría de saber que
 * la compra acaba de ocurrir — por eso queda fijada aquí.
 */
describe("JUST_CHECKED_OUT_KEY", () => {
    it("mantiene el valor que escribe el carrito y leen los pedidos", () => {
        expect(JUST_CHECKED_OUT_KEY).toBe("nexus-just-checked-out");
    });

    it("funciona como clave de sessionStorage: se marca y se borra", () => {
        // GIVEN la marca de una compra recién creada
        sessionStorage.setItem(JUST_CHECKED_OUT_KEY, "NX-1024");

        // THEN la ficha del pedido puede leerla…
        expect(sessionStorage.getItem(JUST_CHECKED_OUT_KEY)).toBe("NX-1024");

        // WHEN se ha consumido
        sessionStorage.removeItem(JUST_CHECKED_OUT_KEY);

        // THEN no queda rastro: la siguiente visita no se confunde
        expect(sessionStorage.getItem(JUST_CHECKED_OUT_KEY)).toBeNull();
    });
});
