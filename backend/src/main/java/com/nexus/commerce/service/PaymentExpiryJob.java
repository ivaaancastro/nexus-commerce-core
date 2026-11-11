package com.nexus.commerce.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Latido que caduca los pedidos con tarjeta que nadie pagó (Fase 9, R6). Reutiliza
 * la infraestructura de {@code SchedulingConfig}. <strong>Nunca lanza</strong> al
 * planificador; los tests llaman a {@link PaymentService#expirarImpagados()} a mano.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentExpiryJob {

    private final PaymentService paymentService;

    @Scheduled(fixedDelayString = "${app.payments.expiry-poll-ms:300000}")
    public void programar() {
        try {
            int cancelados = paymentService.expirarImpagados();
            if (cancelados > 0) {
                log.info("Pagos: {} pedido(s) caducado(s) por falta de pago", cancelados);
            }
        } catch (RuntimeException e) {
            log.error("El job de caducidad de pagos no debe romperse: {}", e.getMessage());
        }
    }
}
