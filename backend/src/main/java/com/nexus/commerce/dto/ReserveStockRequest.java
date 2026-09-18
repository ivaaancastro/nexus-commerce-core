package com.nexus.commerce.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ReserveStockRequest(
        @NotNull(message = "El skuId es obligatorio")
        Long skuId,

        @NotBlank(message = "El código de almacén es obligatorio")
        String warehouseCode,

        @NotNull(message = "La cantidad es obligatoria")
        @Min(value = 1, message = "Debes reservar al menos 1 unidad")
        Integer quantity
) {}