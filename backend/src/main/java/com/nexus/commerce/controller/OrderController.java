package com.nexus.commerce.controller;

import com.nexus.commerce.dto.CheckoutRequest;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.dto.PaymentSessionResponse;
import com.nexus.commerce.service.CheckoutService;
import com.nexus.commerce.service.PaymentService;
import com.nexus.commerce.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Tag(name = "Orders & Checkout", description = "Motor transaccional de pedidos con control de idempotencia")
public class OrderController {

    private final OrderService orderService;
    private final CheckoutService checkoutService;
    private final PaymentService paymentService;

    @PostMapping("/checkout")
    @Operation(summary = "Procesar el checkout y asociar el pedido al usuario autenticado")
    public ResponseEntity<OrderResponse> checkout(
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            Authentication authentication,
            @Valid @RequestBody CheckoutRequest request
    ) {
        OrderResponse response = checkoutService.checkout(
                idempotencyKey,
                request,
                authentication != null ? authentication.getName() : null);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{orderNumber}/payment")
    @Operation(summary = "Datos para pagar con el Payment Element (clientSecret + clave publicable); sólo el dueño")
    public ResponseEntity<PaymentSessionResponse> payment(
            @PathVariable String orderNumber,
            Authentication authentication) {
        return ResponseEntity.ok(paymentService.getPaymentSession(authentication.getName(), orderNumber));
    }

    @GetMapping("/{orderNumber}")
    public ResponseEntity<OrderResponse> getOrder(@PathVariable String orderNumber) {
        return orderService.getOrderByNumber(orderNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}