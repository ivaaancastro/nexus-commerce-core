package com.nexus.commerce.dto;

import jakarta.validation.constraints.*;

/**
 * Actualización de SKU. No incluye {@code barcode}: es la clave natural del SKU
 * y es inmutable tras la creación (spec R2.4).
 */
public record SkuUpdateRequest(
        @NotBlank(message = "El color es obligatorio")
        @Size(max = 30, message = "El color no puede exceder 30 caracteres")
        String color,

        @NotBlank(message = "La talla es obligatoria")
        @Size(max = 10, message = "La talla no puede exceder 10 caracteres")
        String size
) {}
