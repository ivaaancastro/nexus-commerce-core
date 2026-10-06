package com.nexus.commerce.entity;

/**
 * Preferencia de pago declarada por el usuario al hacer checkout.
 *
 * <p><b>No procesa pagos.</b> No se pide número de tarjeta, no se tokeniza ni
 * se cobra: es únicamente un dato que se guarda en la orden para poder
 * mostrarlo en la ficha (Tarea 5.5, R2). El proyecto no tiene pasarela de
 * pago, igual que {@code refundAmount} es un registro contable.</p>
 *
 * <p>Se persiste como {@code VARCHAR} con {@code EnumType.STRING} —nunca como
 * ordinal— para que reordenar el enum no rompa las filas ya escritas.</p>
 */
public enum PaymentMethod {
    /** Tarjeta de crédito o débito. */
    CARD,
    /** Bizum (solo España). */
    BIZUM,
    /** PayPal. */
    PAYPAL,
    /** Transferencia bancaria. */
    BANK_TRANSFER
}
