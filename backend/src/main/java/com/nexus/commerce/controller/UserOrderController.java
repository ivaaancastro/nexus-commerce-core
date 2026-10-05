package com.nexus.commerce.controller;

import com.nexus.commerce.dto.OrderPageResponse;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.dto.ReturnRequest;
import com.nexus.commerce.dto.ReturnResponse;
import com.nexus.commerce.service.OrderService;
import com.nexus.commerce.service.ReturnService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users/me/orders")
@RequiredArgsConstructor
@Tag(name = "Order History",
        description = "Historial de pedidos y devoluciones del usuario autenticado")
public class UserOrderController {

    private final OrderService orderService;
    private final ReturnService returnService;

    @GetMapping
    @Operation(summary = "Listar los pedidos del usuario autenticado (del más reciente al más antiguo)")
    public ResponseEntity<OrderPageResponse> listOrders(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(
                orderService.listOrders(authentication.getName(), page, size));
    }

    @GetMapping("/{orderNumber}")
    @Operation(summary = "Detalle de un pedido propiedad del usuario")
    public ResponseEntity<OrderResponse> getOrder(
            Authentication authentication,
            @PathVariable String orderNumber) {
        return orderService.getOrderForUser(authentication.getName(), orderNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{orderNumber}/returns")
    @Operation(summary = "Solicitar la devolución de una línea del pedido",
            description = "Valida los 30 días, el estado DELIVERED y la ausencia de "
                    + "devoluciones previas antes de persistir. No elegible → 409.")
    public ResponseEntity<ReturnResponse> createReturn(
            Authentication authentication,
            @PathVariable String orderNumber,
            @Valid @RequestBody ReturnRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(returnService.createReturn(authentication.getName(), orderNumber, request));
    }

    @GetMapping("/{orderNumber}/returns")
    @Operation(summary = "Devoluciones de un pedido propiedad del usuario")
    public ResponseEntity<List<ReturnResponse>> listReturns(
            Authentication authentication,
            @PathVariable String orderNumber) {
        return ResponseEntity.ok(returnService.listReturns(authentication.getName(), orderNumber));
    }
}
