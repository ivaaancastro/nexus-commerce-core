package com.nexus.commerce.dto;

import jakarta.validation.constraints.NotNull;

public record SizeRecommendationRequest(
        @NotNull(message = "El producto es obligatorio")
        Long productId
) {}
