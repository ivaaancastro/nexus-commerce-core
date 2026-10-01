import type { OrderStatus } from "@/types/commerce";

/**
 * Etiqueta de estado del pedido.
 *
 * Paleta reducida al universo `neutral-*` del estilo editorial: el estado
 * se distingue por el peso del fondo, no por colores saturados.
 */
const STATUS_STYLES: Record<OrderStatus, string> = {
    PENDING: "bg-neutral-100 text-neutral-600 border border-neutral-300",
    CONFIRMED: "bg-neutral-300 text-neutral-900 border border-neutral-400",
    SHIPPED: "bg-neutral-700 text-white border border-neutral-700",
    DELIVERED: "bg-neutral-900 text-white border border-neutral-900",
    CANCELLED: "bg-white text-neutral-500 border border-neutral-300",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
};

interface OrderStatusBadgeProps {
    status: OrderStatus;
}

export default function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
    return (
        <span
            className={[
                "inline-block px-3 py-1 text-[10px] uppercase tracking-widest",
                STATUS_STYLES[status],
            ].join(" ")}
        >
            {STATUS_LABELS[status]}
        </span>
    );
}
