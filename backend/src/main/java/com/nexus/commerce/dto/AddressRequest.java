package com.nexus.commerce.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddressRequest(
        @NotBlank(message = "El nombre del destinatario es obligatorio")
        @Size(max = 100, message = "El nombre no puede superar 100 caracteres")
        String fullName,

        @NotBlank(message = "La calle es obligatoria")
        @Size(max = 255, message = "La calle no puede superar 255 caracteres")
        String street,

        @NotBlank(message = "La ciudad es obligatoria")
        @Size(max = 100, message = "La ciudad no puede superar 100 caracteres")
        String city,

        @NotBlank(message = "El código postal es obligatorio")
        @Size(max = 20, message = "El código postal no puede superar 20 caracteres")
        String postalCode,

        @NotBlank(message = "El país es obligatorio")
        @Size(max = 5, message = "El código de país no puede superar 5 caracteres")
        String countryCode,

        boolean defaultAddress
) {}
