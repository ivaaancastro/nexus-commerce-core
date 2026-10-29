package com.nexus.commerce.service;

import com.nexus.commerce.dto.PaymentIntentRequest;
import com.nexus.commerce.dto.PaymentIntentResponse;
import com.nexus.commerce.exception.PaymentIntentCreationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * Servicio para crear PaymentIntents en modo test de Stripe.
 * 
 * Decisión de diseño (Fase 9):
 - Usa la clave secreta desde `stripe.secret-key` en application.properties/.env
 - Operación transaccional con `@Transactional`
 - Lanza `PaymentIntentCreationException` en caso de fallo
 - Los records de DTO son inmutables; se construyen via constructor posicional
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    @Value("${stripe.secret-key:sk_test_placeholder}")
    private String stripeSecretKey;

    /**
     * Crea un PaymentIntent en Stripe test mode.
     * 
     * @param request DTO con amount, currency, idempotencyKey, metadata
     * @return PaymentIntentResponse con clientSecret y datos del pedido
     * @throws PaymentIntentCreationException si no se puede crear el PaymentIntent
     */
    @Transactional
    public PaymentIntentResponse createPaymentIntent(PaymentIntentRequest request) {
        // TODO: Cuando el Stripe Java SDK esté disponible en el classpath,
        // descomentar y usar:
        // Stripe.apiKey = stripeSecretKey;
        // PaymentIntentCreateParams params = ...
        // PaymentIntent pi = PaymentIntent.create(params);
        // Retornar el response con los datos de pi

        // Por mientras, simular el creation exitoso con datos dummy
        // que el frontend consumirá. En producción real, esto llamaría
        // al SDK de Stripe.
        log.info("Simulated PaymentIntent creation for order: amount={}, currency={}",
                request.amount(), request.currency());

        // Construir response simulado usando el constructor posicional del record
        // Los records son inmutables, por lo que todos los valores se pasan al constructor
        String simulatedClientSecret = "pi_test_" + UUID.randomUUID() + "_secret_" + UUID.randomUUID().toString().substring(0, 16);
        String simulatedPaymentIntentId = "pi_test_" + UUID.randomUUID();

        return new PaymentIntentResponse(
                request.metadata() != null && request.metadata().containsKey("orderNumber")
                        ? request.metadata().get("orderNumber")
                        : "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                simulatedPaymentIntentId,
                simulatedClientSecret,
                "requires_payment_method",
                request.amount().multiply(BigDecimal.valueOf(100)).intValueExact(),
                request.currency().toLowerCase(),
                "/orders/" + (request.metadata() != null && request.metadata().containsKey("orderNumber")
                        ? request.metadata().get("orderNumber")
                        : "ORD-NEW") + "?payment_intent=" + simulatedPaymentIntentId
        );
    }

    /**
     * Verifica si una clave de idempotencia ya fue usada.
     * 
     * @param idempotencyKey clave UUID a verificar
     * @return true si ya fue usada, false si es nueva
     */
    public boolean isIdempotencyKeyUsed(String idempotencyKey) {
        // La validación real se hará en OrderService.processCheckout()
        // mediante orderRepository.findByIdempotencyKey()
        return false;
    }
}