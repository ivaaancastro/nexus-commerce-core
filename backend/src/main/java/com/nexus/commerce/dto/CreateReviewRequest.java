package com.nexus.commerce.dto;

import jakarta.validation.constraints.*;

public record CreateReviewRequest(
        @NotNull(message = "La puntuación es obligatoria")
        @Min(value = 1, message = "La puntuación mínima es 1")
        @Max(value = 5, message = "La puntuación máxima es 5")
        Integer rating,

        @NotBlank(message = "El título es obligatorio")
        @Size(max = 100, message = "El título no puede superar los 100 caracteres")
        String title,

        String comment
) {}
