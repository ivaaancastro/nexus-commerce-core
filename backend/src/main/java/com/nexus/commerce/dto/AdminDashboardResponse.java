package com.nexus.commerce.dto;

import com.nexus.commerce.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Respuesta del dashboard del panel (Tarea 7.6, R1): la foto del negocio en
 * una sola petición — ventas del periodo, catálogo y usuarios (plan D1).
 *
 * <p>Las decisiones que el shape fija (plan D3): {@code sales.revenue} es
 * SIEMPRE un array <strong>agrupado por moneda</strong> (aquí no se suman € con
 * $: el sistema no tiene tipo de cambio) y <strong>excluye {@code CANCELLED}</strong>;
 * {@code byStatus} cuenta los 5 estados con sus claves siempre presentes.
 * {@code sales.orderCount} mide ventas (no canceladas) y {@code sum(byStatus)}
 * todos los pedidos creados en el periodo: son cosas distintas y no cuadran
 * entre sí.
 *
 * @param range    periodo efectivamente aplicado (el default ya resuelto)
 * @param sales    ventas del periodo (R2)
 * @param products snapshot del catálogo, sin periodo (R3)
 * @param users    usuarios totales y derivados (R3)
 */
public record AdminDashboardResponse(
        Range range,
        Sales sales,
        Products products,
        Users users
) {

    /** Periodo aplicado: {@code from = now − days}, calculado en servidor (R1). */
    public record Range(int days, Instant from) {}

    /**
     * Ventas del periodo.
     *
     * @param orderCount pedidos <strong>no cancelados</strong> creados en el periodo
     * @param byStatus   recuento de los 5 estados (cancelados incluidos), con
     *                   sus claves siempre presentes — aunque valgan 0 (R4)
     * @param revenue    ingresos <strong>por moneda</strong>, nunca agregados (R2)
     */
    public record Sales(
            long orderCount,
            Map<OrderStatus, Long> byStatus,
            List<Revenue> revenue
    ) {}

    /**
     * Ingresos de UNA moneda — fila independiente por cada moneda (plan D3).
     *
     * @param currency   moneda ISO 4217 del pedido ({@code orders.currency})
     * @param total      suma de {@code total_amount} de los no cancelados
     * @param orderCount pedidos que componen {@code total}
     * @param avgTicket  {@code total / orderCount}, {@code HALF_UP} escala 2 (regla 4.1)
     */
    public record Revenue(String currency, BigDecimal total, long orderCount, BigDecimal avgTicket) {}

    /**
     * Snapshot del catálogo: la entidad {@code Product} no tiene flag de activo
     * y no se inventa uno (R3).
     */
    public record Products(long total, long skus, long families) {}

    /**
     * Usuarios.
     *
     * @param admins      {@code ADMIN} <strong>sin suspender</strong> — mismo criterio
     *                    que la guarda del último admin de la 7.5
     * @param suspended   cuentas con {@code suspendedAt != null}, de cualquier rol
     * @param newInPeriod altas con {@code createdAt ≥ from}
     */
    public record Users(long total, long admins, long suspended, long newInPeriod) {}
}
