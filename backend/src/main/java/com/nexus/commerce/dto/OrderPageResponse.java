package com.nexus.commerce.dto;

import java.util.List;

/**
 * Página de resultados del historial de pedidos.
 */
public record OrderPageResponse(
        List<OrderSummaryResponse> orders,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
