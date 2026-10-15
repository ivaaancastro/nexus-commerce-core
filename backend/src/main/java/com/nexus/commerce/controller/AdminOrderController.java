package com.nexus.commerce.controller;

import com.nexus.commerce.dto.AdminOrderDetailResponse;
import com.nexus.commerce.dto.AdminOrderPageResponse;
import com.nexus.commerce.dto.AdminOrderStatusRequest;
import com.nexus.commerce.dto.AdminOrderTrackingRequest;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.service.AdminOrderService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Gestión de pedidos del panel (Tarea 7.4, spec specs/admin-orders/, R1/R2/R3/R5).
 *
 * <p>Los 4 endpoints viven bajo {@code /api/v1/admin/**} y <strong>heredan</strong>
 * el {@code hasRole("ADMIN")} de la 7.1 (ADR-0006): la autorización no cambia en
 * este fichero ni en {@code SecurityConfig} (plan D1).</p>
 *
 * <p>Sin <strong>autorización por propiedad</strong> a propósito: el admin ve y
 * gestiona <em>todos</em> los pedidos. No es un IDOR — el rol lo autoriza.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/orders")
@RequiredArgsConstructor
@Tag(name = "Admin · Pedidos",
        description = "Listado, detalle, cambio de estado y tracking de pedidos. Requiere rol ADMIN: 401 sin sesión, 403 con rol USER.")
public class AdminOrderController {

    private final AdminOrderService adminOrderService;

    @GetMapping
    @Operation(summary = "Listado paginado de todos los pedidos, con filtros status y q")
    public ResponseEntity<AdminOrderPageResponse> listar(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(adminOrderService.listar(page, size, status, q));
    }

    @GetMapping("/{orderNumber}")
    @Operation(summary = "Detalle completo de un pedido (compone el OrderResponse del cliente)")
    public ResponseEntity<AdminOrderDetailResponse> detalle(@PathVariable String orderNumber) {
        return ResponseEntity.ok(adminOrderService.detalle(orderNumber));
    }

    @PutMapping("/{orderNumber}/status")
    @Operation(summary = "Cambia el estado con la máquina de transiciones (aplica efectos de stock)")
    public ResponseEntity<AdminOrderDetailResponse> cambiarEstado(
            @PathVariable String orderNumber,
            @Valid @RequestBody AdminOrderStatusRequest request) {
        return ResponseEntity.ok(adminOrderService.cambiarEstado(orderNumber, request));
    }

    @PutMapping("/{orderNumber}/tracking")
    @Operation(summary = "Registra o limpia transportista y número de seguimiento (cualquier estado)")
    public ResponseEntity<AdminOrderDetailResponse> actualizarTracking(
            @PathVariable String orderNumber,
            @Valid @RequestBody AdminOrderTrackingRequest request) {
        return ResponseEntity.ok(adminOrderService.actualizarTracking(orderNumber, request));
    }
}
