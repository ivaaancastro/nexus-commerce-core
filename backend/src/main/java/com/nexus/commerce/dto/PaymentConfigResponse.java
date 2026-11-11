package com.nexus.commerce.dto;

/**
 * Configuración pública de la vitrina.
 *
 * @param paymentMode {@code STRIPE} o {@code DISABLED} (modo sin pasarela) — Fase 9, R7
 * @param demoMode    {@code true} en la demo pública (Fase 10, R6 · A3): el frontend pinta el banner
 */
public record PaymentConfigResponse(String paymentMode, boolean demoMode) {}
