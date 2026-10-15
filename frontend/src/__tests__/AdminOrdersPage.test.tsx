import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminOrdersPage from "@/app/admin/orders/page";
import { api } from "@/lib/api";
import type { AdminOrderPage, AdminOrderSummary } from "@/types/commerce";

/**
 * Tarea 7.4 (spec specs/admin-orders/, R1) — el listado de `/admin/orders`.
 *
 * Cubre: columnas de la tabla con cliente «—», filtros que mandan query params
 * al servidor (nunca `filter()` en cliente, R1.2/R1.3), paginación con el
 * `totalPages` del backend, lista vacía con y sin filtros y el estado de error
 * con reintentar. `getAdminOrders` se mockea como `Promise` resuelta ANTES de
 * renderizar (patrón del proyecto).
 */

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/admin/orders",
}));

vi.mock("@/lib/api", () => ({
    api: {
        getAdminOrders: vi.fn(),
    },
}));

function pedido(extras: Partial<AdminOrderSummary> = {}): AdminOrderSummary {
    return {
        id: 1,
        orderNumber: "ORD-7401A",
        status: "PENDING",
        marketCode: "ES",
        currency: "EUR",
        totalAmount: 96.8,
        createdAt: "2026-10-15T10:00:00Z",
        userEmail: "admin@nexus.dev",
        itemCount: 2,
        carrier: null,
        trackingNumber: null,
        returnRequested: false,
        ...extras,
    };
}

function pagina(
    orders: AdminOrderSummary[],
    extras: Partial<AdminOrderPage> = {}
): AdminOrderPage {
    return {
        orders,
        page: 0,
        size: 20,
        totalElements: orders.length,
        totalPages: 1,
        ...extras,
    };
}

describe("AdminOrdersPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Promesa resuelta ANTES de renderizar (patrón del proyecto)
        vi.mocked(api.getAdminOrders).mockResolvedValue(pagina([pedido()]));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("carga la página: columnas, enlace al detalle, «—» sin cliente y badge de devolución (R1)", async () => {
        vi.mocked(api.getAdminOrders).mockResolvedValue(
            pagina([
                pedido(),
                pedido({
                    id: 2,
                    orderNumber: "ORD-7401B",
                    status: "SHIPPED",
                    totalAmount: 48.4,
                    userEmail: null,
                    returnRequested: true,
                }),
            ])
        );

        render(<AdminOrdersPage />);

        expect(await screen.findByText("Gestión de pedidos")).toBeInTheDocument();

        // Enlace del nº al detalle (único sitio con controles de estado)
        const enlace = screen.getByRole("link", { name: "ORD-7401A" });
        expect(enlace).toHaveAttribute("href", "/admin/orders/ORD-7401A");

        // Pedido sin usuario (V7 nullable) → «—», no cadena vacía
        expect(screen.getByText("—")).toBeInTheDocument();

        // Estados, totales y devolución informativa (dentro de la tabla: el
        // select de filtro repite las mismas etiquetas de estado)
        const tabla = screen.getByRole("table");
        expect(within(tabla).getByText("Pendiente")).toBeInTheDocument();
        expect(within(tabla).getByText("Enviado")).toBeInTheDocument();
        expect(within(tabla).getByText("96.80 EUR")).toBeInTheDocument();
        expect(within(tabla).getByText("48.40 EUR")).toBeInTheDocument();
        expect(within(tabla).getByText("Solicitada")).toBeInTheDocument();

        expect(api.getAdminOrders).toHaveBeenCalledWith({
            page: 0,
            status: undefined,
            q: undefined,
        });
    });

    it("el select de estado manda el filtro al servidor y resetea la página (R1.2)", async () => {
        const usuario = userEvent.setup();
        render(<AdminOrdersPage />);
        await screen.findByText("Gestión de pedidos");

        await usuario.selectOptions(screen.getByLabelText("Estado"), "SHIPPED");

        expect(api.getAdminOrders).toHaveBeenLastCalledWith({
            page: 0,
            status: "SHIPPED",
            q: undefined,
        });
    });

    it("la búsqueda manda q recortado al servidor (R1.3)", async () => {
        const usuario = userEvent.setup();
        render(<AdminOrdersPage />);
        await screen.findByText("Gestión de pedidos");

        await usuario.type(screen.getByLabelText("Buscar pedido"), "  ORD-7401A  ");
        await usuario.click(screen.getByRole("button", { name: "Buscar" }));

        expect(api.getAdminOrders).toHaveBeenLastCalledWith({
            page: 0,
            status: undefined,
            q: "ORD-7401A",
        });
    });

    it("paginación: sólo avanza mientras el backend tenga páginas (R1.1)", async () => {
        const usuario = userEvent.setup();
        // El servidor ecoa la página que se le pidió (server-authoritative)
        vi.mocked(api.getAdminOrders)
            .mockResolvedValueOnce(pagina([pedido()], { totalPages: 3, totalElements: 5 }))
            .mockResolvedValueOnce(
                pagina([pedido()], { page: 1, totalPages: 3, totalElements: 5 })
            );

        render(<AdminOrdersPage />);
        await screen.findByText("Gestión de pedidos");

        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

        await usuario.click(screen.getByRole("button", { name: "Siguiente" }));

        expect(api.getAdminOrders).toHaveBeenLastCalledWith({
            page: 1,
            status: undefined,
            q: undefined,
        });
        expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    });

    it("lista vacía: editorial sin filtros y aviso distinto con filtros activos", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.getAdminOrders).mockResolvedValue(pagina([]));

        render(<AdminOrdersPage />);
        expect(
            await screen.findByText(/Todavía no hay pedidos/)
        ).toBeInTheDocument();

        // Con filtro activo el vacío es otra cosa: no hay coincidencias
        await usuario.type(screen.getByLabelText("Buscar pedido"), "ORD-NADA");
        await usuario.click(screen.getByRole("button", { name: "Buscar" }));

        expect(
            await screen.findByText(/Ningún pedido coincide con los filtros/)
        ).toBeInTheDocument();
    });

    it("un error de red se traduce y «Reintentar» recarga la página", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.getAdminOrders).mockReset();
        vi.mocked(api.getAdminOrders).mockRejectedValueOnce(new Error("network down"));
        vi.mocked(api.getAdminOrders).mockResolvedValue(pagina([pedido()]));

        render(<AdminOrdersPage />);

        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent(/Algo salió mal/);
        expect(screen.queryByRole("link", { name: "ORD-7401A" })).not.toBeInTheDocument();

        await usuario.click(screen.getByRole("button", { name: "Reintentar" }));

        expect(await screen.findByRole("link", { name: "ORD-7401A" })).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
