package com.nexus.commerce.controller;

import com.nexus.commerce.dto.RefundRequest;
import com.nexus.commerce.dto.RefundResponse;
import com.nexus.commerce.exception.RefundNotAllowedException;
import com.nexus.commerce.service.OrderService;
import com.nexus.commerce.service.RefundService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Tag(name = "Orders & Checkout", description = "Motor transaccional de pedidos con reembolsos")
public class RefundController {

    private final RefundService refundService;
    private final OrderService orderService;

    @PostMapping("/{orderNumber}/refund")
    @Operation(summary = "Iniciar reembolso de un pedido")
    public ResponseEntity<RefundResponse> refund(
            @PathVariable String orderNumber,
            @Valid @RequestBody RefundRequest request
    ) {
        // Verificar que el pedido existe antes de procesar
        if (orderService.getOrderByNumber(orderNumber).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new RefundResponse(
                            null,
                            BigDecimal.ZERO,
                            "eur",
                            "failed",
                            null
                    ));
        }

        try {
            RefundResponse response = refundService.initiateRefund(orderNumber, request);
            return ResponseEntity.status(HttpStatus.OK).body(response);
        } catch (RefundNotAllowedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new RefundResponse(
                            null,
                            BigDecimal.ZERO,
                            "eur",
                            "failed",
                            null
                    ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new RefundResponse(
                            null,
                            BigDecimal.ZERO,
                            "eur",
                            "failed",
                            null
                    ));
        }
    }
}