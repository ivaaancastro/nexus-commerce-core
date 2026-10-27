package com.nexus.commerce.controller;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Coupon;
import com.nexus.commerce.exception.*;
import com.nexus.commerce.service.CouponService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.*;

/** V5: Controlador admin para gestión de cupones promocionales. */
@RestController
@RequestMapping("/api/v1/admin/coupons")
@RequiredArgsConstructor
@Tag(name = "Admin Coupons", description = "Gestión de cupones promocionales (solo ADMIN)")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCouponController {

    private final CouponService couponService;

    /** GET /api/v1/admin/coupons - Listado paginado con filtros */
    @GetMapping
    @Operation(summary = "Listado paginado de cupones con filtros")
    public AdminCouponPageResponse list(
            @Parameter(description = "Página (0-based)", defaultValue = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Tamaño página", defaultValue = "20") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Filtrar por código (contains, case-insensitive)", required = false) @RequestParam(required = false) String code,
            @Parameter(description = "Filtrar por tipo", required = false) @RequestParam(required = false) Coupon.DiscountType type,
            @Parameter(description = "Filtrar por estado activo", required = false) @RequestParam(required = false) Boolean active,
            @Parameter(description = "Filtrar por fecha inicio mínima", required = false) @RequestParam(required = false) OffsetDateTime validFrom,
            @Parameter(description = "Filtrar por fecha fin máxima", required = false) @RequestParam(required = false) OffsetDateTime validUntil
    ) {
        return couponService.getAdminCoupons(page, size, code, type, active, validFrom, validUntil);
    }

    /** POST /api/v1/admin/coupons - Crear nuevo cupón */
    @PostMapping
    @Operation(summary = "Crear nuevo cupón")
    public ResponseEntity<AdminCouponDetailResponse> create(@Valid @RequestBody CouponCreateRequest request) {
        AdminCouponDetailResponse created = couponService.createCoupon(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** GET /api/v1/admin/coupons/{id} - Detalle de cupón con historial de usos */
    @GetMapping("/{id}")
    @Operation(summary = "Detalle de cupón con historial de usos (últimos 50)")
    public AdminCouponDetailResponse get(@PathVariable Long id) {
        return couponService.getAdminCoupon(id);
    }

    /** PUT /api/v1/admin/coupons/{id} - Actualizar cupón (el código no se puede cambiar) */
    @PutMapping("/{id}")
    @Operation(summary = "Actualizar cupón (el código no se puede cambiar)")
    public AdminCouponDetailResponse update(@PathVariable Long id, @Valid @RequestBody CouponUpdateRequest request) {
        return couponService.updateCoupon(id, request);
    }

    /** DELETE /api/v1/admin/coupons/{id} - Borrar cupón (solo si no tiene usos; si tiene, desactivar) */
    @DeleteMapping("/{id}")
    @Operation(summary = "Borrar cupón (solo si no tiene usos; si tiene, desactivar)")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        couponService.deleteCoupon(id);
        return ResponseEntity.noContent().build();
    }
}