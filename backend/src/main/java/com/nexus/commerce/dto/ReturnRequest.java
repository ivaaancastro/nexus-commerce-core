package com.nexus.commerce.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReturnRequest(
        @NotNull(message = "La línea es obligatoria")
        Long orderItemId,

        @NotBlank(message = "El motivo es obligatorio")
        @Size(max = 500, message = "El motivo no puede superar 500 caracteres")
        String reason
) {}
