package com.nexus.commerce.dto;

import com.nexus.commerce.entity.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CheckoutRequest(
        @NotBlank(message = "El código de mercado es obligatorio (ej: ES)")
        String marketCode,

        @NotEmpty(message = "El pedido debe contener al menos un artículo")
        @Valid
        List<CheckoutItemRequest> items,

        String destinationCountryCode,
        Double destinationLatitude,
        Double destinationLongitude,

        @NotNull(message = "Debes seleccionar una dirección de envío")
        Long addressId,

        @NotNull(message = "Debes indicar un método de pago")
        PaymentMethod paymentMethod
) {}
