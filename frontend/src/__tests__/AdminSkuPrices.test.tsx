import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminSkuPrices from "@/components/AdminSkuPrices";
import { api } from "@/lib/api";
import type { SkuPrice } from "@/types/commerce";

/**
 * Tarea 7.3 (spec R7) — bloque de precios por mercado de la ficha de producto.
 *
 * Cubre: los 4 mercados desde el propio GET (autosuficiente, R7.1), guardado
 * por fila con `onMensaje` («Precio guardado»), validación espejo en cliente
 * (base > 0 · descuento ≤ base · vacío → null) y el `400` del servidor.
 */

vi.mock("@/lib/api", () => ({
    api: {
        getAdminSkuPrices: vi.fn(),
        updateAdminSkuPrice: vi.fn(),
    },
}));

const precios: SkuPrice[] = [
    { marketCode: "CH", marketName: "Switzerland", currency: "CHF", taxRate: 8.1, basePrice: 99.9, discountPrice: null, isActive: true },
    { marketCode: "ES", marketName: "España", currency: "EUR", taxRate: 21, basePrice: 89.99, discountPrice: 79.99, isActive: true },
    { marketCode: "UK", marketName: "United Kingdom", currency: "GBP", taxRate: 20, basePrice: null, discountPrice: null, isActive: null },
    { marketCode: "US", marketName: "United States", currency: "USD", taxRate: 7.25, basePrice: null, discountPrice: null, isActive: null },
];

const precioGuardado: SkuPrice = {
    marketCode: "ES", marketName: "España", currency: "EUR", taxRate: 21,
    basePrice: 95, discountPrice: 79.99, isActive: true,
};

const onMensaje = vi.fn();

/** Fila de mercado a partir del nombre visible del mercado. */
function filaDe(marketName: string): HTMLElement {
    const celda = screen.getByText(marketName).closest("tr");
    if (!celda) throw new Error(`No se encontró la fila de ${marketName}`);
    return celda;
}

describe("AdminSkuPrices", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Promesa resuelta ANTES de renderizar (patrón del proyecto)
        vi.mocked(api.getAdminSkuPrices).mockResolvedValue(precios);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("pinta los 4 mercados del propio GET con los valores iniciales (R7.1)", async () => {
        render(<AdminSkuPrices skuId={10} skuLabel="M · Marino" onMensaje={onMensaje} />);

        expect(await screen.findByText("Variante M · Marino")).toBeInTheDocument();
        expect(api.getAdminSkuPrices).toHaveBeenCalledWith(10);

        // Valores iniciales (en number inputs jest-dom compara el valor numérico)
        expect(screen.getByLabelText("Precio base en Switzerland")).toHaveValue(99.9);
        expect(screen.getByLabelText("Precio base en España")).toHaveValue(89.99);
        expect(screen.getByLabelText("Descuento en España")).toHaveValue(79.99);

        // Sin fila aún (UK/US): inputs vacíos, señal de «crear en el primer guardado»
        expect(screen.getByLabelText("Precio base en United Kingdom")).toHaveValue(null);

        // 4 mercados con su checkbox «En venta» (ES activo; UK sin decisión)
        const casillas = screen.getAllByRole("checkbox", { name: "En venta" });
        expect(casillas).toHaveLength(4);
        expect(casillas[1]).toBeChecked();
    });

    it("guarda una fila: PUT al mercado y «Precio guardado» (R7.1)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.updateAdminSkuPrice).mockResolvedValue(precioGuardado);

        render(<AdminSkuPrices skuId={10} skuLabel="M · Marino" onMensaje={onMensaje} />);
        // Espera a que el GET resuelva y pinte la tabla
        await screen.findByText("España");

        const fila = filaDe("España");
        const boton = within(fila).getByRole("button", { name: "Guardar precio" });
        expect(boton).toBeDisabled();

        const base = within(fila).getByLabelText("Precio base en España");
        await usuario.clear(base);
        await usuario.type(base, "95");
        expect(boton).toBeEnabled();

        await usuario.click(boton);

        expect(api.updateAdminSkuPrice).toHaveBeenCalledWith(10, "ES", {
            basePrice: 95,
            discountPrice: 79.99,
            isActive: true,
        });
        expect(onMensaje).toHaveBeenCalledWith("Precio guardado");

        // Tras guardar, la fila queda sincronizada (sin cambios) y deshabilitada
        await waitFor(() =>
            expect(
                within(filaDe("España")).getByRole("button", { name: "Guardar precio" })
            ).toBeDisabled()
        );
        expect(within(filaDe("España")).getByLabelText("Precio base en España")).toHaveValue(95);
    });

    it("rechaza en cliente un descuento mayor que el base sin llamar al backend (R7.4)", async () => {
        const usuario = userEvent.setup();

        render(<AdminSkuPrices skuId={10} skuLabel="M · Marino" onMensaje={onMensaje} />);
        await screen.findByText("España");

        const fila = filaDe("España");
        const base = within(fila).getByLabelText("Precio base en España");
        const descuento = within(fila).getByLabelText("Descuento en España");

        await usuario.clear(base);
        await usuario.type(base, "10");
        await usuario.clear(descuento);
        await usuario.type(descuento, "20");

        await usuario.click(within(fila).getByRole("button", { name: "Guardar precio" }));

        expect(
            await within(filaDe("España")).findByText("El descuento no puede superar el precio base.")
        ).toBeInTheDocument();
        expect(api.updateAdminSkuPrice).not.toHaveBeenCalled();
        expect(onMensaje).not.toHaveBeenCalled();
    });

    it("rechaza en cliente una base igual a 0 (R7.4)", async () => {
        const usuario = userEvent.setup();

        render(<AdminSkuPrices skuId={10} skuLabel="M · Marino" onMensaje={onMensaje} />);
        await screen.findByText("United Kingdom");

        // UK arranca vacío: escribir «0» lo deja sucio y activa el guardado
        const fila = filaDe("United Kingdom");
        const base = within(fila).getByLabelText("Precio base en United Kingdom");
        await usuario.type(base, "0");

        await usuario.click(within(fila).getByRole("button", { name: "Guardar precio" }));

        expect(
            await within(filaDe("United Kingdom")).findByText(
                "El precio base debe ser un número mayor que 0 con máximo 2 decimales."
            )
        ).toBeInTheDocument();
        expect(api.updateAdminSkuPrice).not.toHaveBeenCalled();
    });

    it("un descuento vacío viaja como null, nunca como 0 (R7.4)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.updateAdminSkuPrice).mockResolvedValue({
            marketCode: "CH", marketName: "Switzerland", currency: "CHF", taxRate: 8.1,
            basePrice: 110, discountPrice: null, isActive: true,
        });

        render(<AdminSkuPrices skuId={10} skuLabel="M · Marino" onMensaje={onMensaje} />);
        await screen.findByText("Switzerland");

        const fila = filaDe("Switzerland");
        const base = within(fila).getByLabelText("Precio base en Switzerland");
        await usuario.clear(base);
        await usuario.type(base, "110");

        await usuario.click(within(fila).getByRole("button", { name: "Guardar precio" }));

        await waitFor(() =>
            expect(api.updateAdminSkuPrice).toHaveBeenCalledWith(10, "CH", {
                basePrice: 110,
                discountPrice: null,
                isActive: true,
            })
        );
        expect(onMensaje).toHaveBeenCalledWith("Precio guardado");
    });

    it("el 400 del servidor se muestra amigable y sin toast de éxito (R7.4)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.updateAdminSkuPrice).mockRejectedValue(
            new Error('API Error [400]: {"message":"El descuento no puede superar el precio base"}')
        );

        render(<AdminSkuPrices skuId={10} skuLabel="M · Marino" onMensaje={onMensaje} />);
        await screen.findByText("España");

        const fila = filaDe("España");
        const base = within(fila).getByLabelText("Precio base en España");
        await usuario.clear(base);
        await usuario.type(base, "95");
        await usuario.click(within(fila).getByRole("button", { name: "Guardar precio" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "El descuento no puede superar el precio base"
        );
        expect(onMensaje).not.toHaveBeenCalled();
    });
});
