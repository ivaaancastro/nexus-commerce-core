import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminMetrics from "@/components/admin/AdminMetrics";
import { api } from "@/lib/api";
import type { AdminDashboard } from "@/types/commerce";

vi.mock("@/lib/api", () => ({
    api: {
        getAdminDashboard: vi.fn(),
    },
}));

/** Foto coherente: orderCount (12) = suma de no cancelados (3+5+2+2). */
const dashboard: AdminDashboard = {
    range: { days: 30, from: "2026-09-20T10:00:00Z" },
    sales: {
        orderCount: 12,
        byStatus: { PENDING: 3, CONFIRMED: 5, SHIPPED: 2, DELIVERED: 2, CANCELLED: 4 },
        revenue: [
            { currency: "EUR", total: 1234.56, orderCount: 7, avgTicket: 176.37 },
            { currency: "USD", total: 500, orderCount: 5, avgTicket: 100 },
        ],
    },
    products: { total: 42, skus: 120, families: 8 },
    users: { total: 15, admins: 2, suspended: 1, newInPeriod: 4 },
};

/** Periodo sin ventas: ceros visibles y `revenue` vacío (R6 — nunca NaN ni «—»). */
const dashboardVacio: AdminDashboard = {
    range: { days: 7, from: "2026-10-13T10:00:00Z" },
    sales: {
        orderCount: 0,
        byStatus: { PENDING: 0, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 },
        revenue: [],
    },
    products: { total: 42, skus: 120, families: 8 },
    users: { total: 15, admins: 2, suspended: 1, newInPeriod: 0 },
};

describe("AdminMetrics (Tarea 7.6)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("pinta los 4 bloques con los números de la foto", async () => {
        // GIVEN
        vi.mocked(api.getAdminDashboard).mockResolvedValue(dashboard);

        // WHEN
        render(<AdminMetrics />);

        // THEN — las 4 tarjetas con sus rótulos (R6)
        expect(await screen.findByRole("heading", { name: "Métricas" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Ventas" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Estados de pedido" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Catálogo" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Usuarios" })).toBeInTheDocument();

        // Ventas: orderCount con su etiqueta honesta («no cancelados») y periodo
        const ventas = within(screen.getByRole("region", { name: "Ventas" }));
        expect(ventas.getByText("12")).toBeInTheDocument();
        expect(ventas.getByText(/pedidos no cancelados · 30 días/i)).toBeInTheDocument();
        // Ingresos por moneda, cada uno formateado con su propio currency (R2).
        // es-ES (CLDR actual) no agrupa 4 cifras y separa el símbolo con nbsp.
        expect(ventas.getByText(/1234,56\s?€/)).toBeInTheDocument();
        expect(ventas.getByText(/500,00/)).toBeInTheDocument();
        expect(ventas.getAllByText(/ticket medio/i)).toHaveLength(2);

        // Estados: las 5 claves con su número (las barras son decorativas)
        const estados = within(screen.getByRole("region", { name: "Estados de pedido" }));
        expect(estados.getByText("Pendiente")).toBeInTheDocument();
        expect(estados.getByText("5")).toBeInTheDocument(); // CONFIRMED
        expect(estados.getByText("4")).toBeInTheDocument(); // CANCELLED sigue contando

        // Catálogo y usuarios (R3)
        const catalogo = within(screen.getByRole("region", { name: "Catálogo" }));
        expect(catalogo.getByText("42")).toBeInTheDocument();
        expect(catalogo.getByText("120")).toBeInTheDocument();
        const usuarios = within(screen.getByRole("region", { name: "Usuarios" }));
        expect(usuarios.getByText("15")).toBeInTheDocument();
        expect(usuarios.getByText("2")).toBeInTheDocument(); // admins
    });

    it("el selector de periodo vuelve a pedir la foto con el days nuevo (R6)", async () => {
        // GIVEN
        vi.mocked(api.getAdminDashboard).mockResolvedValue(dashboard);
        const user = userEvent.setup();
        render(<AdminMetrics />);
        await screen.findByRole("heading", { name: "Métricas" });
        expect(api.getAdminDashboard).toHaveBeenCalledWith(30); // default

        // WHEN — cambiar a 90 días
        await user.click(screen.getByRole("button", { name: /90 días/i }));

        // THEN — una llamada nueva con el period elegido, sin cálculo en cliente
        await waitFor(() => expect(api.getAdminDashboard).toHaveBeenCalledWith(90));
        expect(api.getAdminDashboard).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button", { name: /90 días/i }))
            .toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: /30 días/i }))
            .toHaveAttribute("aria-pressed", "false");
    });

    it("mientras no hay datos muestra el estado de carga", () => {
        // GIVEN — promesa que nunca se resuelve
        vi.mocked(api.getAdminDashboard).mockReturnValue(new Promise<AdminDashboard>(() => {}));

        // WHEN
        render(<AdminMetrics />);

        // THEN
        expect(screen.getByRole("status")).toHaveTextContent(/cargando métricas/i);
    });

    it("ante un error muestra el aviso con «Reintentar» y recuperación al pulsarlo", async () => {
        // GIVEN — falla la primera, responde la segunda
        vi.mocked(api.getAdminDashboard)
            .mockRejectedValueOnce(new Error("API Error [500]: caído"))
            .mockResolvedValueOnce(dashboard);
        const user = userEvent.setup();

        // WHEN
        render(<AdminMetrics />);

        // THEN — aviso amigable + botón (R6)
        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent(/no se pudieron cargar las métricas/i);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /reintentar/i }));

        expect(await screen.findByRole("region", { name: "Ventas" })).toBeInTheDocument();
        expect(api.getAdminDashboard).toHaveBeenCalledTimes(2);
    });

    it("periodo vacío: ceros visibles, sin ingresos y jamás NaN (R6)", async () => {
        // GIVEN
        vi.mocked(api.getAdminDashboard).mockResolvedValue(dashboardVacio);

        // WHEN
        render(<AdminMetrics />);

        // THEN — el 0 de ventas se ve, con su etiqueta, y no hay divisiones rotas
        const ventas = within(await screen.findByRole("region", { name: "Ventas" }));
        expect(ventas.getByText("0")).toBeInTheDocument();
        expect(ventas.getByText(/pedidos no cancelados · 7 días/i)).toBeInTheDocument();
        expect(ventas.getByText(/sin ingresos en el periodo/i)).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/NaN/);
        expect(document.body.textContent).not.toMatch(/—/);
    });
});
