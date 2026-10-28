import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminCouponsPage from "@/app/admin/coupons/page";
import { api } from "@/lib/api";
import type { AdminCouponDetailResponse, AdminCouponPageResponse } from "@/types/commerce";

/**
 * V5 (spec specs/coupons/, §2.4/§3) — el listado de `/admin/coupons`.
 *
 * Cubre: tabla y datos, filtros que consultan la API en servidor (nunca un
 * `filter()` en cliente), creación con validación espejo de la jakarta,
 * edición con código inmutable, borrado con confirm y el `409` (cupón ya
 * usado) bajo la fila sin toast. `getAdminCoupons` se mockea como `Promise`
 * resuelta ANTES de renderizar (patrón del proyecto).
 */

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/admin/coupons",
}));

vi.mock("@/lib/api", () => ({
    api: {
        getAdminCoupons: vi.fn(),
        createAdminCoupon: vi.fn(),
        updateAdminCoupon: vi.fn(),
        deleteAdminCoupon: vi.fn(),
    },
}));

const MANANA = "2026-12-31T23:59:00Z";

function cupon(extras: Partial<AdminCouponDetailResponse> = {}): AdminCouponDetailResponse {
    return {
        id: 10,
        code: "SAVE10",
        type: "PERCENTAGE",
        value: 10,
        minOrderAmount: 0,
        maxDiscountAmount: undefined,
        validFrom: "2026-10-01T00:00:00Z",
        validUntil: MANANA,
        usageLimit: 0,
        usageCount: 3,
        perUserLimit: 0,
        active: true,
        createdAt: "2026-10-01T09:00:00Z",
        updatedAt: "2026-10-01T09:00:00Z",
        recentUsages: [],
        ...extras,
    };
}

function pagina(cupones: AdminCouponDetailResponse[], extras: Partial<AdminCouponPageResponse> = {}): AdminCouponPageResponse {
    return {
        coupons: cupones,
        page: 0,
        size: 20,
        totalElements: cupones.length,
        totalPages: 1,
        ...extras,
    };
}

describe("AdminCouponsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getAdminCoupons).mockResolvedValue(pagina([cupon()]));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("carga la tabla: código, tipo, valor, vigencia, usos y estado", async () => {
        render(<AdminCouponsPage />);

        const fila = await screen.findByText("SAVE10");
        const tr = fila.closest("tr");
        expect(tr).toBeDefined();
        const celdas = within(tr as HTMLElement).getAllByRole("cell");
        expect(celdas[1]).toHaveTextContent("Porcentaje");
        expect(celdas[2]).toHaveTextContent("10 %");
        expect(celdas[4]).toHaveTextContent("3");
        expect(celdas[5]).toHaveTextContent("Activo");
    });

    it("pinta un importe fijo con símbolo, no como porcentaje", async () => {
        vi.mocked(api.getAdminCoupons).mockResolvedValue(
            pagina([cupon({ code: "BAJA5", type: "FIXED", value: 5 })])
        );
        render(<AdminCouponsPage />);

        const celda = await screen.findByText(/5,00/);
        expect(celda).toBeInTheDocument();
    });

    it("el filtro de tipo consulta la API en servidor (sin filter() en cliente)", async () => {
        const user = userEvent.setup();
        render(<AdminCouponsPage />);
        await screen.findByText("SAVE10");

        await user.selectOptions(screen.getByLabelText("Tipo"), "FIXED");
        await user.click(screen.getByRole("button", { name: "Filtrar" }));

        await waitFor(() =>
            expect(api.getAdminCoupons).toHaveBeenCalledWith(0, 20, undefined, "FIXED", undefined)
        );
    });

    it("la búsqueda por código va al servidor en mayúsculas y en la página 0", async () => {
        const user = userEvent.setup();
        render(<AdminCouponsPage />);
        await screen.findByText("SAVE10");

        await user.type(screen.getByLabelText("Código"), "save");
        await user.click(screen.getByRole("button", { name: "Filtrar" }));

        await waitFor(() =>
            expect(api.getAdminCoupons).toHaveBeenCalledWith(0, 20, "SAVE", undefined, undefined)
        );
    });

    it("crear cupón: valida en cliente (espejo jakarta) antes de llamar a la API", async () => {
        const user = userEvent.setup();
        render(<AdminCouponsPage />);
        await screen.findByText("SAVE10");

        await user.click(screen.getByRole("button", { name: "Nuevo cupón" }));
        // Sin código ni fechas: dos errores de campo y CERO llamadas a la API
        await user.click(screen.getByRole("button", { name: "Crear cupón" }));

        expect(await screen.findByText("El código es obligatorio.")).toBeInTheDocument();
        expect(screen.getByText("La fecha de inicio es obligatoria.")).toBeInTheDocument();
        expect(api.createAdminCoupon).not.toHaveBeenCalled();
    });

    it("crear cupón: un código con minúsculas/espacios se normaliza y envía", async () => {
        const user = userEvent.setup();
        vi.mocked(api.createAdminCoupon).mockResolvedValue(cupon({ code: "SAVE10" }));
        render(<AdminCouponsPage />);
        await screen.findByText("SAVE10");

        await user.click(screen.getByRole("button", { name: "Nuevo cupón" }));
        // El formulario vive en su <section>: dentro de ella no hay ambigüedad
        // con el filtro de la tabla (que también se llama «Código»).
        const form = within(await screen.findByRole("region", { name: "Crear cupón" }));
        await user.type(form.getByLabelText("Código"), " save10");
        await user.type(form.getByLabelText("Porcentaje de descuento"), "10");
        await user.type(form.getByLabelText("Válido desde"), "2026-10-01T00:00");
        await user.type(form.getByLabelText("Válido hasta"), "2026-12-31T23:59");
        await user.click(form.getByRole("button", { name: "Crear cupón" }));

        await waitFor(() => expect(api.createAdminCoupon).toHaveBeenCalledTimes(1));
        expect(api.createAdminCoupon).toHaveBeenCalledWith(
            expect.objectContaining({ code: "SAVE10", type: "PERCENTAGE", value: 10 })
        );
    });

    it("editar: el código aparece deshabilitado (inmutable, §2.2)", async () => {
        const user = userEvent.setup();
        render(<AdminCouponsPage />);
        await screen.findByText("SAVE10");

        await user.click(screen.getByRole("button", { name: "Editar" }));

        const form = within(await screen.findByRole("region", { name: "Editar cupón" }));
        expect(form.getByLabelText("Código")).toBeDisabled();
        expect(form.getByText(/inmutable/)).toBeInTheDocument();
    });

    it("borrar: pide confirmación y recarga el listado tras el 204", async () => {
        const user = userEvent.setup();
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.mocked(api.deleteAdminCoupon).mockResolvedValue(undefined);
        render(<AdminCouponsPage />);
        await screen.findByText("SAVE10");

        await user.click(screen.getByRole("button", { name: "Borrar" }));

        expect(confirmSpy).toHaveBeenCalled();
        await waitFor(() => expect(api.deleteAdminCoupon).toHaveBeenCalledWith(10));
        // Recarga: se vuelve a pedir la página
        await waitFor(() => expect(api.getAdminCoupons).toHaveBeenCalledTimes(2));
    });

    it("borrar un cupón ya usado: 409 bajo la fila, sin toast y sin recarga", async () => {
        const user = userEvent.setup();
        vi.spyOn(window, "confirm").mockReturnValue(true);
        // Cuerpo real del handler `COUPON_HAS_USAGES` (GlobalExceptionHandler)
        vi.mocked(api.deleteAdminCoupon).mockRejectedValue(
            new Error(
                'API Error [409]: {"timestamp":"2026-10-28T10:00:00Z","status":409,' +
                    '"error":"Conflict","code":"COUPON_HAS_USAGES",' +
                    '"message":"No se puede borrar un cupón que ya se ha usado; desactívalo"}'
            )
        );
        render(<AdminCouponsPage />);
        await screen.findByText("SAVE10");

        await user.click(screen.getByRole("button", { name: "Borrar" }));

        expect(
            await screen.findByText(/No se puede borrar un cupón que ya se ha usado/)
        ).toBeInTheDocument();
        // Una sola petición inicial: sin recarga
        expect(api.getAdminCoupons).toHaveBeenCalledTimes(1);
    });

    it("estado vacío sin filtros invita a crear el primero", async () => {
        vi.mocked(api.getAdminCoupons).mockResolvedValue(pagina([]));
        render(<AdminCouponsPage />);

        expect(await screen.findByText(/Aún no hay cupones/)).toBeInTheDocument();
    });
});
