package com.nexus.commerce.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * V5: cuerpo de {@code POST /api/v1/coupons/validate} (spec §2.3 Cliente).
 *
 * <p>{@code subtotal} llega en la <strong>menor unidad del mercado</strong>
 * (entero multiplicado, p. ej. 10000 = 100,00), como ya hace el frontend del
 * carrito — nunca se divide aquí: la validación y el descuento se calculan en
 * esa misma unidad.</p>
 */
public record CouponValidateRequest(
        @NotBlank(message = "El código es obligatorio")
        String code,

        @NotNull(message = "El subtotal es obligatorio")
        @DecimalMin(value = "0", message = "El subtotal no puede ser negativo")
        BigDecimal subtotal
) {}
