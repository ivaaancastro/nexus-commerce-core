package com.nexus.commerce.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record CheckoutRequest(
        @NotBlank(message = "El código de mercado es obligatorio (ej: ES)")
        String marketCode,

        @NotEmpty(message = "El pedido debe contener al menos un artículo")
        @Valid
        List<CheckoutItemRequest> items
) {}