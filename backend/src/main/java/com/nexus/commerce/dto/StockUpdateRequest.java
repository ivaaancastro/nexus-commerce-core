package com.nexus.commerce.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Escritura de stock desde el panel (Tarea 7.3, R1.4): el admin sólo mueve
 * {@code quantityAvailable} — {@code quantityReserved} lo gestiona el
 * checkout (plan D3) y ni siquiera se acepta en el body.
 */
public record StockUpdateRequest(
        @NotNull(message = "La cantidad disponible es obligatoria")
        @PositiveOrZero(message = "La cantidad disponible no puede ser negativa")
        Integer quantityAvailable
) {}
