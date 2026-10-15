import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminOrderDetailPage from "@/app/admin/orders/[orderNumber]/page";
import { api } from "@/lib/api";
import type {
    AdminOrderDetail,
    Order,
    OrderItem,
    OrderStatus,
} from "@/types/commerce";

/**
 * Tarea 7.4 (spec specs/admin-orders/, R2–R5) — el detalle de `/admin/orders`.
 *
 * Cubre: cabecera con cliente/dirección/pago tolerantes a nulls, el espejo de
 * la máquina de transiciones (sólo botones permitidos), confirmación de
 * `window.confirm` al cancelar, el éxito aplicado **con la respuesta del PUT**
 * sin re-fetch, el `409 ORDER_CONFLICT` traducido, el tracking full-replace
 * (habilitado sólo si cambió, vaciar limpia) y el 404 con enlace de vuelta.
 */

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useParams: () => ({ orderNumber: "ORD-7401A" }),
    usePathname: () => "/admin/orders/ORD-7401A",
}));

vi.mock("@/lib/api", () => ({
    api: {
        getAdminOrder: vi.fn(),
        updateAdminOrderStatus: vi.fn(),
        updateAdminOrderTracking: vi.fn(),
    },
}));

const item: OrderItem = {
    id: 501,
    skuId: 1,
    skuCode: "740100000001",
    warehouseCode: "WH_ARTEIXO",
    quantity: 2,
    unitPrice: 40,
    taxRate: 21,
    taxAmount: 16.8,
    totalAmount: 96.8,
    returnEligible: true,
    returnIneligibleReason: null,
    productName: "Blazer Prueba 74",
    productFamily: "OUTERWEAR",
    size: "M",
    color: "Marino",
};

const orden: Order = {
    id: 1,
    orderNumber: "ORD-7401A",
    idempotencyKey: "idem-ORD-7401A",
    marketCode: "ES",
    currency: "EUR",
    status: "PENDING",
    subtotalAmount: 80,
    taxAmount: 16.8,
    totalAmount: 96.8,
    createdAt: "2026-10-15T10:00:00Z",
    returnDeadline: "2026-11-14T10:00:00Z",
    shippingAddress: {
        fullName: "Ana García",
        street: "Calle Mayor 1",
        city: "Madrid",
        postalCode: "28013",
        countryCode: "ES",
    },
    paymentMethod: "CARD",
    carrier: null,
    trackingNumber: null,
    items: [item],
};

function detalle(extras: Partial<AdminOrderDetail> = {}): AdminOrderDetail {
    return {
        order: { ...orden },
        userEmail: "admin@nexus.dev",
        returnRequested: false,
        ...extras,
    };
}

function conEstado(estado: OrderStatus): AdminOrderDetail {
    return detalle({ order: { ...orden, status: estado } });
}

function conTracking(
    carrier: string | null,
    trackingNumber: string | null,
    estado: OrderStatus = "PENDING"
): AdminOrderDetail {
    return detalle({ order: { ...orden, status: estado, carrier, trackingNumber } });
}

/** Réplica del cuerpo que emite el `GlobalExceptionHandler` de la 7.4. */
const error409 = (code: string, message: string) =>
    new Error(
        `API Error [409]: {"timestamp":"2026-10-15T10:00:00+02:00","status":409,` +
            `"error":"Conflict","code":"${code}","message":"${message}"}`
    );

describe("AdminOrderDetailPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Promesa resuelta ANTES de renderizar (patrón del proyecto)
        vi.mocked(api.getAdminOrder).mockResolvedValue(detalle());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    it("pinta cabecera, cliente, dirección, pago, líneas con desglose y totales (R2.1/E.3)", async () => {
        render(<AdminOrderDetailPage />);

        expect(
            await screen.findByRole("heading", { name: "ORD-7401A" })
        ).toBeInTheDocument();

        expect(screen.getByText("admin@nexus.dev")).toBeInTheDocument();
        expect(screen.getByText(/Calle Mayor 1/)).toBeInTheDocument();
        expect(screen.getByText("Tarjeta")).toBeInTheDocument();
        expect(screen.getByText("Pendiente")).toBeInTheDocument();

        // Línea con su desglose fiscal
        expect(screen.getByText("Blazer Prueba 74 · M · Marino")).toBeInTheDocument();
        expect(screen.getByText(/2 × 40\.00 · Impuestos 21% \(16\.80\)/)).toBeInTheDocument();

        // Totales (una sola línea: 96.80 aparece en su celda y en el total)
        expect(screen.getByText("Subtotal")).toBeInTheDocument();
        expect(screen.getAllByText("96.80 EUR")).toHaveLength(2);

        expect(api.getAdminOrder).toHaveBeenCalledWith("ORD-7401A");
    });

    it("tolera los nulls pre-V10: sin dirección, pago o cliente se pintan «—» (E.3)", async () => {
        vi.mocked(api.getAdminOrder).mockResolvedValue(
            detalle({
                order: {
                    ...orden,
                    shippingAddress: null,
                    paymentMethod: null,
                },
                userEmail: null,
            })
        );

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        // Tres «—»: cliente, pago y dirección
        expect(screen.getAllByText("—")).toHaveLength(3);
    });

    it("el flag de devolución es informativo: badge sin botones de resolución (E.5)", async () => {
        vi.mocked(api.getAdminOrder).mockResolvedValue(
            detalle({ returnRequested: true })
        );

        render(<AdminOrderDetailPage />);

        expect(await screen.findByTestId("return-requested-badge")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /resolver/i })).not.toBeInTheDocument();
    });

    // ── Espejo de la máquina de transiciones (R3) ──────────────────────────

    it("PENDING sólo ofrece confirmar y cancelar — nunca enviar (R3.2)", async () => {
        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        expect(
            screen.getByRole("button", { name: "Marcar confirmado" })
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Marcar enviado" })
        ).not.toBeInTheDocument();
    });

    it("SHIPPED sólo ofrece entregar; un estado final no pinta transiciones", async () => {
        vi.mocked(api.getAdminOrder).mockResolvedValue(conEstado("SHIPPED"));
        const { unmount } = render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        expect(
            screen.getByRole("button", { name: "Marcar entregado" })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Cancelar pedido" })
        ).not.toBeInTheDocument();
        unmount();

        // DELIVERED: estado final, sin botones (R3.3)
        vi.mocked(api.getAdminOrder).mockResolvedValue(conEstado("DELIVERED"));
        render(<AdminOrderDetailPage />);
        expect(await screen.findByText(/Estado final/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Marcar/ })).not.toBeInTheDocument();
    });

    it("cancelar exige la confirmación de window (E.4)", async () => {
        const usuario = userEvent.setup();
        const confirmacion = vi.spyOn(window, "confirm").mockReturnValue(false);

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        await usuario.click(screen.getByRole("button", { name: "Cancelar pedido" }));

        expect(confirmacion).toHaveBeenCalledTimes(1);
        expect(api.updateAdminOrderStatus).not.toHaveBeenCalled();

        // Aceptado: ahora sí se manda el PUT
        confirmacion.mockReturnValue(true);
        await usuario.click(screen.getByRole("button", { name: "Cancelar pedido" }));

        expect(api.updateAdminOrderStatus).toHaveBeenCalledWith("ORD-7401A", {
            status: "CANCELLED",
        });
    });

    it("éxito: toast + panel actualizado con la respuesta del PUT, sin re-fetch (E.4)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.getAdminOrder).mockResolvedValue(conEstado("CONFIRMED"));
        // El PUT devuelve el detalle ya actualizado — no se vuelve a pedir
        vi.mocked(api.updateAdminOrderStatus).mockResolvedValue(conEstado("SHIPPED"));

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        await usuario.click(screen.getByRole("button", { name: "Marcar enviado" }));

        expect(await screen.findByText("Estado actualizado")).toBeInTheDocument();
        expect(screen.getByText("Enviado")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Marcar entregado" })
        ).toBeInTheDocument();
        expect(api.getAdminOrder).toHaveBeenCalledTimes(1);
    });

    it("el 409 ORDER_CONFLICT muestra el mensaje del servidor bajo el panel (R3.3)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.getAdminOrder).mockResolvedValue(conEstado("PENDING"));
        vi.mocked(api.updateAdminOrderStatus).mockRejectedValueOnce(
            error409(
                "ORDER_CONFLICT",
                "Transición no permitida: un pedido Pendiente no puede pasar a Enviado " +
                    "(sólo se puede mover a Confirmado, Cancelado)."
            )
        );

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        await usuario.click(screen.getByRole("button", { name: "Marcar confirmado" }));

        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent(/Transición no permitida/);
        // Sin toast de éxito cuando el servidor rechaza
        expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
        // El estado no cambió: el panel sigue con las transiciones de PENDING
        expect(
            screen.getByRole("button", { name: "Cancelar pedido" })
        ).toBeInTheDocument();
    });

    // ── Tracking (R5) ──────────────────────────────────────────────────────

    it("el guardado de tracking sólo se habilita si cambió y usa full-replace (E.5)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.getAdminOrder).mockResolvedValue(conTracking("SEUR", "SEUR-1"));
        vi.mocked(api.updateAdminOrderTracking).mockResolvedValue(
            conTracking("Nacex", "SEUR-1")
        );

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        const boton = screen.getByRole("button", { name: "Guardar seguimiento" });
        expect(boton).toBeDisabled();

        const campo = screen.getByLabelText("Transportista");
        expect(campo).toHaveValue("SEUR");
        await usuario.clear(campo);
        await usuario.type(campo, "Nacex");
        expect(boton).toBeEnabled();

        await usuario.click(boton);

        expect(api.updateAdminOrderTracking).toHaveBeenCalledWith("ORD-7401A", {
            carrier: "Nacex",
            trackingNumber: "SEUR-1",
        });
        expect(await screen.findByText("Seguimiento guardado")).toBeInTheDocument();
        // La respuesta recalcula la suciedad: el botón vuelve a deshabilitarse
        expect(screen.getByRole("button", { name: "Guardar seguimiento" })).toBeDisabled();
    });

    it("vaciar los campos limpia el seguimiento en servidor y muestra «sin registro» (R5.2)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.getAdminOrder).mockResolvedValue(conTracking("SEUR", "SEUR-1"));
        vi.mocked(api.updateAdminOrderTracking).mockResolvedValue(conTracking(null, null));

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        await usuario.clear(screen.getByLabelText("Transportista"));
        await usuario.clear(screen.getByLabelText("Nº de seguimiento"));
        await usuario.click(screen.getByRole("button", { name: "Guardar seguimiento" }));

        expect(api.updateAdminOrderTracking).toHaveBeenCalledWith("ORD-7401A", {
            carrier: "",
            trackingNumber: "",
        });
        expect(await screen.findByText(/Sin seguimiento registrado/)).toBeInTheDocument();
    });

    it("tracking editable en estado final sin transiciones (R5.2)", async () => {
        vi.mocked(api.getAdminOrder).mockResolvedValue(conEstado("CANCELLED"));

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        expect(screen.getByText(/Estado final/)).toBeInTheDocument();
        expect(screen.getByLabelText("Transportista")).toBeEnabled();
        expect(
            screen.getByRole("button", { name: "Guardar seguimiento" })
        ).toBeDisabled();
    });

    // ── R5.7 — el envío encadena status → tracking (D8) ─────────────────────

    it("R5.7 — «Marcar enviado» encadena PUT /status → PUT /tracking con los campos pendientes", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.getAdminOrder).mockResolvedValue(conEstado("CONFIRMED"));
        vi.mocked(api.updateAdminOrderStatus).mockResolvedValue(conEstado("SHIPPED"));
        vi.mocked(api.updateAdminOrderTracking).mockResolvedValue(
            conTracking("SEUR", "7401-A", "SHIPPED")
        );

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        await usuario.type(screen.getByLabelText("Transportista"), "SEUR");
        await usuario.type(screen.getByLabelText("Nº de seguimiento"), "7401-A");
        await usuario.click(screen.getByRole("button", { name: "Marcar enviado" }));

        // El estado se aplica primero y con su toast…
        expect(await screen.findByText("Estado actualizado")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Marcar entregado" })).toBeInTheDocument();
        // …y el tracking se manda acto seguido con lo escrito en los inputs
        await waitFor(() =>
            expect(api.updateAdminOrderTracking).toHaveBeenCalledWith("ORD-7401A", {
                carrier: "SEUR",
                trackingNumber: "7401-A",
            })
        );
        // El detalle final es el del segundo PUT: el botón queda sin suciedad
        expect(screen.getByRole("button", { name: "Guardar seguimiento" })).toBeDisabled();
    });

    it("R5.7 — si el tracking encadenado falla, el estado queda aplicado y sólo se reintenta el tracking", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.getAdminOrder).mockResolvedValue(conEstado("CONFIRMED"));
        vi.mocked(api.updateAdminOrderStatus).mockResolvedValue(conEstado("SHIPPED"));
        vi.mocked(api.updateAdminOrderTracking)
            .mockRejectedValueOnce(new Error("network down"))
            .mockResolvedValueOnce(conTracking("SEUR", "7401-A", "SHIPPED"));

        render(<AdminOrderDetailPage />);
        await screen.findByRole("heading", { name: "ORD-7401A" });

        await usuario.type(screen.getByLabelText("Transportista"), "SEUR");
        await usuario.type(screen.getByLabelText("Nº de seguimiento"), "7401-A");
        await usuario.click(screen.getByRole("button", { name: "Marcar enviado" }));

        // El paso que falló pinta su error bajo el bloque de tracking…
        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent(/Algo salió mal/);
        // …mientras el estado YA está aplicado (panel de SHIPPED)
        expect(screen.getByText("Enviado")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Marcar entregado" })).toBeInTheDocument();

        // Reintentar SÓLO el tracking: no se vuelve a mandar el estado
        await usuario.click(screen.getByRole("button", { name: "Guardar seguimiento" }));

        expect(await screen.findByText("Seguimiento guardado")).toBeInTheDocument();
        expect(api.updateAdminOrderStatus).toHaveBeenCalledTimes(1);
        expect(api.updateAdminOrderTracking).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    // ── Estados de carga/error (E.6) ───────────────────────────────────────

    it("404: mensaje del pedido inexistente con enlace de vuelta a la lista", async () => {
        vi.mocked(api.getAdminOrder).mockRejectedValue(
            new Error('API Error [404]: {"message":"Pedido no encontrado"}')
        );

        render(<AdminOrderDetailPage />);

        expect(await screen.findByText(/No existe el pedido/)).toBeInTheDocument();
        const enlace = screen.getByRole("link", { name: "Volver a pedidos" });
        expect(enlace).toHaveAttribute("href", "/admin/orders");
    });

    it("un error de red muestra el aviso con «Reintentar» (E.6)", async () => {
        vi.mocked(api.getAdminOrder).mockReset();
        vi.mocked(api.getAdminOrder).mockRejectedValueOnce(new Error("network down"));
        vi.mocked(api.getAdminOrder).mockResolvedValue(detalle());

        render(<AdminOrderDetailPage />);

        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent(/Algo salió mal/);

        const usuario = userEvent.setup();
        await usuario.click(screen.getByRole("button", { name: "Reintentar" }));

        expect(
            await screen.findByRole("heading", { name: "ORD-7401A" })
        ).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
