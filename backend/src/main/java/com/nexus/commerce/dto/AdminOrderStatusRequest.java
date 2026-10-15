package com.nexus.commerce.dto;

import com.nexus.commerce.entity.OrderStatus;
import jakarta.validation.constraints.NotNull;

/**
 * Cambio de estado desde el panel (Tarea 7.4, R3): sólo se transporta el estado
 * deseado — la máquina de transiciones y los efectos de stock viven en el
 * service (plan D3/D4), y tracking va en su propio {@code PUT /tracking}.
 */
public record AdminOrderStatusRequest(
        @NotNull(message = "El estado del pedido es obligatorio")
        OrderStatus status
) {}
