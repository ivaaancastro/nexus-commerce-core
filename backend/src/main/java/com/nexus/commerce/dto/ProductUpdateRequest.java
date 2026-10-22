package com.nexus.commerce.dto;

import jakarta.validation.constraints.*;

/**
 * Actualización de producto. No incluye {@code referenceCode}: la referencia es
 * la clave natural del sistema (migraciones con ON CONFLICT, manifiesto de
 * imágenes indexado por ella) y es inmutable tras la creación (spec R2.4).
 */
public record ProductUpdateRequest(
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 100, message = "El nombre no puede exceder 100 caracteres")
        String name,

        @NotBlank(message = "La familia es obligatoria")
        @Pattern(regexp = "[A-Z][A-Z0-9_]{1,49}", message = "La familia debe ir en mayúsculas (ej. OUTERWEAR)")
        String family,

        @Size(max = 2000, message = "La descripción no puede exceder 2000 caracteres")
        String description,

        /** Cuidados de lavado (spec `color-and-care`, R4): opcional, lista corta. */
        @Size(max = 2000, message = "Los cuidados no pueden exceder 2000 caracteres")
        String careInstructions
) {}
