import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import type { OrderStatus } from "@/types/commerce";

/**
 * Tarea 4.1, R1 — etiqueta de estado del pedido.
 *
 * Es una tabla de correspondencias pura: 5 estados → (etiqueta en español,
 * estilo propio). Si se escapa un estado, el usuario ve el código crudo
 * (`PENDING`) en mitad de una interfaz editorial.
 */

const ESTADOS: [OrderStatus, string][] = [
    ["PENDING", "Pendiente"],
    ["CONFIRMED", "Confirmado"],
    ["SHIPPED", "Enviado"],
    ["DELIVERED", "Entregado"],
    ["CANCELLED", "Cancelado"],
];

describe("OrderStatusBadge", () => {
    it.each(ESTADOS)("muestra el estado %s como «%s» en español", (status, label) => {
        render(<OrderStatusBadge status={status} />);

        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it("aplica un estilo distinto a cada uno de los cinco estados", () => {
        // GIVEN los cinco estados pintados a la vez
        const { container } = render(
            <>
                {ESTADOS.map(([status]) => (
                    <OrderStatusBadge key={status} status={status} />
                ))}
            </>
        );

        // THEN ningún estado comparte estilo con otro
        const clases = Array.from(container.querySelectorAll("span")).map(
            (span) => span.className
        );
        expect(clases).toHaveLength(5);
        expect(new Set(clases).size).toBe(5);
    });

    it("usa la transformación editorial: uppercase con tracking-widest", () => {
        render(<OrderStatusBadge status="SHIPPED" />);

        const badge = screen.getByText("Enviado");
        expect(badge).toHaveClass("uppercase");
        expect(badge).toHaveClass("tracking-widest");
    });

    it("el fondo se aclara o oscurece según avanza el estado, sin colores saturados", () => {
        // GIVEN los dos estados extremos del recorrido normal
        render(
            <>
                <OrderStatusBadge status="PENDING" />
                <OrderStatusBadge status="DELIVERED" />
            </>
        );

        // THEN PENDIENTE es el más claro y ENTREGADO el más oscuro del universo neutral
        expect(screen.getByText("Pendiente")).toHaveClass("bg-neutral-100");
        expect(screen.getByText("Entregado")).toHaveClass("bg-neutral-900");
    });
});
