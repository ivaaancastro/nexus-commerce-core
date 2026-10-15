package com.nexus.commerce.dto;

import java.util.List;

/**
 * Página del listado de pedidos del panel (Tarea 7.4, R1). Mismo shape que
 * {@link OrderPageResponse} pero con las filas admin.
 */
public record AdminOrderPageResponse(
        List<AdminOrderSummaryResponse> orders,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
