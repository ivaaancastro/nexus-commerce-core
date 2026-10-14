package com.nexus.commerce.dto;

import jakarta.validation.constraints.*;

public record SkuCreateRequest(
        @NotBlank(message = "El código de barras es obligatorio")
        @Pattern(regexp = "\\d{8,20}", message = "El código de barras debe ser numérico (8 a 20 dígitos)")
        String barcode,

        @NotBlank(message = "El color es obligatorio")
        @Size(max = 30, message = "El color no puede exceder 30 caracteres")
        String color,

        @NotBlank(message = "La talla es obligatoria")
        @Size(max = 10, message = "La talla no puede exceder 10 caracteres")
        String size
) {}
