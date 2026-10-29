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
        PaymentMethod paymentMethod,

        /**
         * V5 (spec §2.3): código de cupón aplicado — opcional. Si llega, el
         * checkout lo revalida bajo {@code PESSIMISTIC_WRITE} y persiste el
         * descuento; si es {@code null}/en blanco, el pedido se procesa sin
         * cupón (patrón de los campos opcionales de fin de registro: los
         * constructores posicionales añaden este argumento al final).
         */
        String couponCode
) {}
