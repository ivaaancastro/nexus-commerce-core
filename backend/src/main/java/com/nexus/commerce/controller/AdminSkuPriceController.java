package com.nexus.commerce.controller;

import com.nexus.commerce.dto.PriceUpdateRequest;
import com.nexus.commerce.dto.SkuPriceResponse;
import com.nexus.commerce.service.AdminPricingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Precios por mercado del panel de administración (Tarea 7.3,
 * spec specs/admin-stock-pricing/, R3).
 *
 * <p><strong>No hay reglas de seguridad nuevas</strong>: al vivir bajo
 * {@code /api/v1/admin/**}, hereda el {@code hasRole("ADMIN")} de la 7.1
 * (ADR-0006) antes del {@code anyRequest().denyAll()}.
 * {@code SecurityConfig} no se modifica.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/skus")
@RequiredArgsConstructor
@Tag(name = "Admin · Precios",
        description = "Precio por mercado de un SKU (upsert). Requiere rol ADMIN: 401 sin sesión, 403 con rol USER.")
public class AdminSkuPriceController {

    private final AdminPricingService service;

    @GetMapping("/{skuId}/prices")
    @Operation(summary = "Los 4 mercados del SKU; nulls si aún no tiene fila")
    public ResponseEntity<List<SkuPriceResponse>> precios(@PathVariable Long skuId) {
        return ResponseEntity.ok(service.getPrecios(skuId));
    }

    @PutMapping("/{skuId}/prices/{marketCode}")
    @Operation(summary = "Crea o actualiza el precio del SKU en un mercado (0 < descuento ≤ base)")
    public ResponseEntity<SkuPriceResponse> actualizar(
            @PathVariable Long skuId,
            @PathVariable String marketCode,
            @Valid @RequestBody PriceUpdateRequest request) {
        return ResponseEntity.ok(service.actualizarPrecio(skuId, marketCode, request));
    }
}
