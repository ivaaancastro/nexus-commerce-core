package com.nexus.commerce.controller;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.service.CouponService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** V5: Controlador público para validación de cupones por clientes. */
@RestController
@RequestMapping("/api/v1/coupons")
@RequiredArgsConstructor
@Tag(name = "Coupons", description = "Validación de cupones para clientes")
public class CouponController {

    private final CouponService couponService;

    /** POST /api/v1/coupons/validate - Validar código de cupón y calcular descuento */
    @PostMapping("/validate")
    @Operation(summary = "Validar código de cupón y calcular descuento")
    public CouponValidationResponse validate(@Valid @RequestBody CouponValidateRequest request, Authentication auth) {
        // La identidad en sesión es el EMAIL (patrón del proyecto:
        // Authentication.getName()), nunca un id numérico — el servicio lo
        // resuelve a userId con userRepository.findByEmail.
        return couponService.validateCoupon(request, auth.getName());
    }
}