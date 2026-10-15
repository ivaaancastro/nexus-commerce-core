package com.nexus.commerce.controller;

import com.nexus.commerce.dto.StockCellResponse;
import com.nexus.commerce.dto.StockMatrixResponse;
import com.nexus.commerce.dto.StockUpdateRequest;
import com.nexus.commerce.service.AdminStockService;
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

/**
 * Matriz de stock del panel de administración (Tarea 7.3,
 * spec specs/admin-stock-pricing/, R1).
 *
 * <p><strong>No hay reglas de seguridad nuevas</strong>: al vivir bajo
 * {@code /api/v1/admin/**}, hereda el {@code hasRole("ADMIN")} de la 7.1
 * (ADR-0006) antes del {@code anyRequest().denyAll()}.
 * {@code SecurityConfig} no se modifica.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/stock")
@RequiredArgsConstructor
@Tag(name = "Admin · Stock",
        description = "Matriz de stock por almacén (upsert). Requiere rol ADMIN: 401 sin sesión, 403 con rol USER.")
public class AdminStockController {

    private final AdminStockService service;

    @GetMapping
    @Operation(summary = "Matriz completa: almacenes × SKUs con disponible/reservado/neto")
    public ResponseEntity<StockMatrixResponse> matriz() {
        return ResponseEntity.ok(service.getMatrix());
    }

    @PutMapping("/{skuId}/{warehouseCode}")
    @Operation(summary = "Fija el stock disponible de un SKU en un almacén (crea la fila si no existe)")
    public ResponseEntity<StockCellResponse> actualizar(
            @PathVariable Long skuId,
            @PathVariable String warehouseCode,
            @Valid @RequestBody StockUpdateRequest request) {
        return ResponseEntity.ok(service.actualizarCelda(skuId, warehouseCode, request));
    }
}
