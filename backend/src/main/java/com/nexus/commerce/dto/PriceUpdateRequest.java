package com.nexus.commerce.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Escritura de precio por mercado (Tarea 7.3, R3.3): validación en dos capas —
 * ésta ({@code jakarta}) y el cross-field {@code descuento ≤ base} en el
 * service (R3.4). {@code discountPrice} a {@code null} significa «sin
 * descuento»: el {@code 0} se rechaza, no es un descuento (plan D5).
 * {@code BigDecimal} de punta a punta — jamás {@code double} (regla 4.1).
 */
public record PriceUpdateRequest(
        @NotNull(message = "El precio base es obligatorio")
        @Positive(message = "El precio base debe ser mayor que 0")
        @Digits(integer = 8, fraction = 2, message = "El precio base admite como máximo 2 decimales")
        BigDecimal basePrice,
        @Positive(message = "El descuento debe ser mayor que 0 (usa vacío para no tener descuento)")
        @Digits(integer = 8, fraction = 2, message = "El descuento admite como máximo 2 decimales")
        BigDecimal discountPrice,
        @NotNull(message = "El estado activo es obligatorio")
        Boolean isActive
) {}
