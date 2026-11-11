package com.nexus.commerce.dto;

import com.nexus.commerce.entity.PaymentStatus;

/**
 * Lo que el navegador necesita para pagar (Fase 9, R2). El {@code clientSecret}
 * se recupera de Stripe en cada petición: no se guarda ni se loguea.
 */
public record PaymentSessionResponse(String clientSecret, String publishableKey, PaymentStatus paymentStatus) {}
