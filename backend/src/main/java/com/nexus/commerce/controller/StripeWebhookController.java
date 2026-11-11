package com.nexus.commerce.controller;

import com.nexus.commerce.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Receptor de webhooks de Stripe (Fase 9, R3). Es público en {@code SecurityConfig}
 * <strong>sólo esta ruta y método</strong>: la autenticación es la <strong>firma</strong>
 * {@code Stripe-Signature}, que se verifica sobre el cuerpo <em>crudo</em> (por eso
 * {@code @RequestBody String}: reserializar un JSON rompería la firma).
 */
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
@Tag(name = "Webhooks", description = "Eventos de Stripe firmados. Sin JWT: se autentican por firma.")
public class StripeWebhookController {

    private final PaymentService paymentService;

    @PostMapping("/stripe")
    @Operation(summary = "Recibe un evento de Stripe (firma obligatoria; 400 sin detalle si no es válida)")
    public ResponseEntity<Void> stripe(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        paymentService.handleWebhook(payload, signature);
        return ResponseEntity.ok().build();
    }
}
