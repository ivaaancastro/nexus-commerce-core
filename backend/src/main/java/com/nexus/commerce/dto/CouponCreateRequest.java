package com.nexus.commerce.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CouponCreateRequest(
        @NotBlank(message = "El código es obligatorio")
        @Size(max = 20, message = "El código no puede superar 20 caracteres")
        @Pattern(regexp = "^[A-Z0-9-]+$", message = "El código solo puede contener letras mayúsculas, números y guiones")
        String code,

        @NotNull(message = "El tipo de descuento es obligatorio")
        Coupon.DiscountType type,

        @NotNull(message = "El valor es obligatorio")
        @DecimalMin(value = "0.01", message = "El valor debe ser mayor que 0")
        BigDecimal value,

        @DecimalMin(value = "0", message = "El importe mínimo no puede ser negativo")
        BigDecimal minOrderAmount,

        @DecimalMin(value = "0.01", message = "El descuento máximo debe ser mayor que 0")
        BigDecimal maxDiscountAmount,

        @NotNull(message = "La fecha de inicio es obligatoria")
        @FutureOrPresent(message = "La fecha de inicio no puede ser pasada")
        OffsetDateTime validFrom,

        @NotNull(message = "La fecha de fin es obligatoria")
        @Future(message = "La fecha de fin debe ser futura")
        OffsetDateTime validUntil,

        @Min(value = 0, message = "El límite de usos no puede ser negativo")
        Integer usageLimit,

        @Min(value = 0, message = "El límite por usuario no puede ser negativo")
        Integer perUserLimit
) {}