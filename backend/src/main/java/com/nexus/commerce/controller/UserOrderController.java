package com.nexus.commerce.controller;

import com.nexus.commerce.dto.OrderPageResponse;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me/orders")
@RequiredArgsConstructor
@Tag(name = "Order History",
        description = "Historial de pedidos del usuario autenticado")
public class UserOrderController {

    private final OrderService orderService;

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
}
