package com.nexus.commerce.dto;

import jakarta.validation.constraints.*;

public record ProductCreateRequest(
        @NotBlank(message = "La referencia es obligatoria")
        @Pattern(regexp = "\\d{4}/\\d{3}", message = "La referencia debe tener el formato NNNN/NNN (ej. 0432/021)")
        String referenceCode,

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 100, message = "El nombre no puede exceder 100 caracteres")
        String name,

        @NotBlank(message = "La familia es obligatoria")
        @Pattern(regexp = "[A-Z][A-Z0-9_]{1,49}", message = "La familia debe ir en mayúsculas (ej. OUTERWEAR)")
        String family,

        @Size(max = 2000, message = "La descripción no puede exceder 2000 caracteres")
        String description
) {}
