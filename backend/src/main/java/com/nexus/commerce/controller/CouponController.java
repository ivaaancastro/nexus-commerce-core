package com.nexus.commerce.controller;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.service.CouponService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.*;

/** V5: Controlador público para validación de cupones por clientes. */
@RestController
@RequestMapping("/api/v1/coupons")
@RequiredArgsConstructor
@Tag(name = "Coupons", description = "Validación de cupones para clientes")
public class CouponController {

    private final CouponService couponService;

    /** POST /api/v1/coupons/validar - Validar código de cupón y calcular descuento */
    @PostMapping("/validate")
    @Operation(summary = "Validar código de cupón y calcular descuento")
    public CouponValidationResponse validate(@Valid @RequestBody CouponValidateRequest request, Authentication auth) {
        Long userId = Long.valueOf(auth.getName());
        return couponService.validateCoupon(request, userId);
    }
}