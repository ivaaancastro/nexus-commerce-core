package com.nexus.commerce.controller;

import com.nexus.commerce.config.DemoProperties;
import com.nexus.commerce.config.PaymentsProperties;
import com.nexus.commerce.dto.PaymentConfigResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Modo de pago (Fase 9, R7) y modo demo (Fase 10, R6) para el frontend. Público y sin secretos. */
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Tag(name = "Pagos", description = "Configuración pública del modo de pago")
public class PaymentConfigController {

    private final PaymentsProperties payments;
    private final DemoProperties demo;

    @GetMapping("/config")
    @Operation(summary = "paymentMode: STRIPE o DISABLED (modo sin pasarela) · demoMode: demo pública")
    public ResponseEntity<PaymentConfigResponse> config() {
        return ResponseEntity.ok(new PaymentConfigResponse(
                payments.isEnabled() ? "STRIPE" : "DISABLED", demo.isEnabled()));
    }
}
