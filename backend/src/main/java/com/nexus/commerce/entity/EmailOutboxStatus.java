package com.nexus.commerce.entity;

/**
 * Ciclo de vida de una fila del outbox de emails (V1, R8/RT2):
 * {@code PENDING} → {@code SENDING} → {@code SENT} | {@code FAILED}.
 *
 * <p>{@code SENDING} es el <strong>alquiler</strong> de la fila: lo gana
 * quien escribe la toma condicionada ({@code WHERE status = 'PENDING'}) y así
 * dos ejecuciones jamás envían el mismo email (RT5). Si el proceso se corta
 * con la fila alquilada, el poller la recupera pasados 10 minutos.</p>
 */
public enum EmailOutboxStatus {
    PENDING,
    SENDING,
    SENT,
    FAILED
}
