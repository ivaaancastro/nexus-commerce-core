package com.nexus.commerce.dto;

import com.nexus.commerce.entity.Coupon;
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

        // Sin @FutureOrPresent/@Future: la ventana de un cupón ya creado es un
        // hecho histórico — el admin puede re-guardar su fecha original (medido
        // en navegador 2026-10-28: un PUT con validFrom pasado devolvía 400 y
        // hacía imposible editar cualquier cupón vigente) o cerrarlo antes
        // moviendo validUntil al pasado. La exigencia de vigencia pertenece a
        // la CREACIÓN (CouponCreateRequest), no a la edición.
        OffsetDateTime validFrom,

        OffsetDateTime validUntil,

        @Min(value = 0, message = "El límite de usos no puede ser negativo")
        Integer usageLimit,

        @Min(value = 0, message = "El límite por usuario no puede ser negativo")
        Integer perUserLimit,

        Boolean active
) {}