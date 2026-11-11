package com.nexus.commerce.entity;

/**
 * Estado del cobro de un pedido (Fase 9, spec §1.1). Independiente de
 * {@link OrderStatus}: el pedido sigue su máquina de la 7.4 y esto sólo dice
 * qué ha pasado con el dinero. Se persiste como {@code VARCHAR} (nunca ordinal).
 */
public enum PaymentStatus {
    /** Sin cobro online: pedidos anteriores a la fase y modo sin pasarela. */
    NONE,
    /** PaymentIntent creado, pendiente de pago. */
    REQUIRES_PAYMENT,
    /** {@code payment_intent.succeeded} recibido y verificado por firma. */
    PAID,
    /** {@code 0 < amountRefunded < total}. */
    PARTIALLY_REFUNDED,
    /** {@code amountRefunded == total}. */
    REFUNDED;

    /** ¿Se ha cobrado dinero que aún no está totalmente devuelto? */
    public boolean cobrado() {
        return this == PAID || this == PARTIALLY_REFUNDED;
    }
}
