package com.nexus.commerce.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CouponUpdateRequest(
        Coupon.DiscountType type,

        @DecimalMin(value = "0.01", message = "El valor debe ser mayor que 0")
        BigDecimal value,

        @DecimalMin(value = "0", message = "El importe mínimo no puede ser negativo")
        BigDecimal minOrderAmount,

        @DecimalMin(value = "0.01", message = "El descuento máximo debe ser mayor que 0")
        BigDecimal maxDiscountAmount,

        @FutureOrPresent(message = "La fecha de inicio no puede ser pasada")
        OffsetDateTime validFrom,

        @Future(message = "La fecha de fin debe ser futura")
        OffsetDateTime validUntil,

        @Min(value = 0, message = "El límite de usos no puede ser negativo")
        Integer usageLimit,

        @Min(value = 0, message = "El límite por usuario no puede ser negativo")
        Integer perUserLimit,

        Boolean active
) {}