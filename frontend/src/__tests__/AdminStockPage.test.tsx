import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminStockPage from "@/app/admin/stock/page";
import { api } from "@/lib/api";
import type { StockMatrix, StockCell } from "@/types/commerce";

/**
 * Tarea 7.3 (spec R6) — la matriz de stock de `/admin/stock`.
 *
 * Cubre: carga de la matriz (columnas de almacén, fila con su ATS), guardado
 * por celda con toast, validación espejo sin llamar al backend, el `409`
 * STOCK_CONFLICT traducido (sin toast de éxito) y los estados vacío/error.
 * `getAdminStock` se mockea como `Promise` resuelta ANTES de renderizar:
 * la página carga en un `useEffect` y React 18 no deja actuar al `findBy*`.
 */

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/admin/stock",
}));

vi.mock("@/lib/api", () => ({
    api: {
        getAdminStock: vi.fn(),
        updateAdminStockCell: vi.fn(),
    },
}));

const matriz: StockMatrix = {
    warehouses: [
        { code: "WH_ARTEIXO", name: "Centro Logístico Sabón", countryCode: "ES" },
        { code: "WH_ZARAGOZA", name: "Hub Europa Plataforma", countryCode: "ES" },
    ],
    rows: [
        {
            skuId: 1,
            productId: 1,
            referenceCode: "0432/021",
            productName: "Blazer Cruzada Estructura",
            color: "Marino",
            size: "M",
            cells: [
                { warehouseCode: "WH_ARTEIXO", quantityAvailable: 150, quantityReserved: 6, netAvailable: 144 },
                { warehouseCode: "WH_ZARAGOZA", quantityAvailable: 80, quantityReserved: 0, netAvailable: 80 },
            ],
        },
    ],
};

function celdaActualizada(warehouseCode: string, disponible: number, reservado: number): StockCell {
    return {
        warehouseCode,
        quantityAvailable: disponible,
        quantityReserved: reservado,
        netAvailable: Math.max(0, disponible - reservado),
    };
}

const errorStockConflict = () =>
    new Error(
        'API Error [409]: {"status":409,"error":"Conflict","code":"STOCK_CONFLICT",' +
            '"message":"No se puede fijar 2 unidades: hay 3 reservadas por pedidos en curso"}'
    );

describe("AdminStockPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Promesa resuelta ANTES de renderizar (patrón del proyecto)
        vi.mocked(api.getAdminStock).mockResolvedValue(matriz);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("carga la matriz: columnas por almacén, fila del SKU y ATS total (R1/R6.2)", async () => {
        render(<AdminStockPage />);

        expect(await screen.findByText("Existencias por almacén")).toBeInTheDocument();

        // Cabeceras de almacén con su nombre bajo el código
        expect(screen.getByText("WH_ARTEIXO")).toBeInTheDocument();
        expect(screen.getByText("Centro Logístico Sabón")).toBeInTheDocument();
        expect(screen.getByText("WH_ZARAGOZA")).toBeInTheDocument();

        // Fila del SKU: referencia enlazada a su ficha, producto y variante
        const enlace = screen.getByRole("link", { name: "0432/021" });
        expect(enlace).toHaveAttribute("href", "/admin/products/1/edit");
        expect(screen.getByText("Blazer Cruzada Estructura")).toBeInTheDocument();
        expect(screen.getByText("Marino · M")).toBeInTheDocument();

        // Celda con reservado (sólo lectura) y neto, y ATS de la fila = 144 + 80
        expect(await screen.findByText("reservado 6 · neto 144")).toBeInTheDocument();
        expect(screen.getByText("reservado 0 · neto 80")).toBeInTheDocument();
        expect(screen.getByText("224")).toBeInTheDocument();

        // Leyenda del plan D3: lo reservado lo mueve el checkout
        expect(screen.getByText(/Lo reservado lo mueve el checkout/)).toBeInTheDocument();
    });

    it("edita una celda y guarda: PUT con sólo el disponible, toast y celda actualizada (R6.3)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.updateAdminStockCell).mockResolvedValue(
            celdaActualizada("WH_ARTEIXO", 120, 6)
        );

        render(<AdminStockPage />);
        const input = await screen.findByLabelText("Disponible de 0432/021 en WH_ARTEIXO");
        // Cada celda tiene su propio botón «Guardar»: se acota al de ESTA celda
        const boton = within(input.parentElement as HTMLElement).getByRole("button", {
            name: "Guardar",
        });

        // Sin cambios no se puede guardar
        expect(boton).toBeDisabled();

        await usuario.clear(input);
        await usuario.type(input, "120");
        expect(boton).toBeEnabled();

        await usuario.click(boton);

        expect(api.updateAdminStockCell).toHaveBeenCalledWith(1, "WH_ARTEIXO", {
            quantityAvailable: 120,
        });

        // Toast de éxito (R6.3) y celda refrescada con la respuesta del servidor
        expect(await screen.findByText("Stock actualizado")).toBeInTheDocument();
        expect(await screen.findByText("reservado 6 · neto 114")).toBeInTheDocument();
        expect(screen.getByText("194")).toBeInTheDocument(); // ATS = 114 + 80

        // La celda deja de estar «sucia»: el botón vuelve a deshabilitarse
        await waitFor(() =>
            expect(
                within(input.parentElement as HTMLElement).getByRole("button", {
                    name: "Guardar",
                })
            ).toBeDisabled()
        );
    });

    it("valida en cliente antes de llamar: vacío o no entero -> error de campo (R6.4)", async () => {
        const usuario = userEvent.setup();

        render(<AdminStockPage />);
        const input = await screen.findByLabelText("Disponible de 0432/021 en WH_ARTEIXO");

        await usuario.clear(input);
        await usuario.click(
            within(input.parentElement as HTMLElement).getByRole("button", {
                name: "Guardar",
            })
        );

        expect(
            await screen.findByText("Introduce un número entero igual o mayor que 0.")
        ).toBeInTheDocument();
        expect(api.updateAdminStockCell).not.toHaveBeenCalled();
    });

    it("el 409 STOCK_CONFLICT se traduce en la celda y NO lanza el toast (R6.4)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.updateAdminStockCell).mockRejectedValue(errorStockConflict());

        render(<AdminStockPage />);
        const input = await screen.findByLabelText("Disponible de 0432/021 en WH_ARTEIXO");

        await usuario.clear(input);
        await usuario.type(input, "2");
        await usuario.click(
            within(input.parentElement as HTMLElement).getByRole("button", {
                name: "Guardar",
            })
        );

        // El mensaje del backend, ya amigable, bajo su propia celda
        expect(
            await screen.findByText("No se puede fijar 2 unidades: hay 3 reservadas por pedidos en curso")
        ).toBeInTheDocument();
        // Fallo = sin toast de éxito
        expect(screen.queryByText("Stock actualizado")).not.toBeInTheDocument();
    });

    it("matriz sin SKUs muestra el mensaje editorial (R1.5/R6.5)", async () => {
        vi.mocked(api.getAdminStock).mockResolvedValue({
            warehouses: matriz.warehouses,
            rows: [],
        });

        render(<AdminStockPage />);

        expect(
            await screen.findByText(/No hay variantes en el catálogo/)
        ).toBeInTheDocument();
    });

    it("un error de red al cargar se traduce y ofrece reintentar (R6.5)", async () => {
        vi.mocked(api.getAdminStock).mockRejectedValue(new Error("network down"));

        render(<AdminStockPage />);

        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent("Algo salió mal");
        expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "0432/021" })).not.toBeInTheDocument();
    });
});
