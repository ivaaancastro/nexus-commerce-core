package com.nexus.commerce.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CheckoutItemRequest(
        @NotNull(message = "El skuId es obligatorio")
        Long skuId,

        @NotBlank(message = "El warehouseCode es obligatorio")
        String warehouseCode,

        @NotNull(message = "La cantidad es obligatoria")
        @Min(value = 1, message = "La cantidad mínima debe ser 1")
        Integer quantity
) {}