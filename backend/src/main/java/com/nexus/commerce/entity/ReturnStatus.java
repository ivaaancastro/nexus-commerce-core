package com.nexus.commerce.entity;

/**
 * Ciclo de vida de una devolución (spec Tarea 5.4, R6).
 *
 * <p><b>Alcanzable hoy</b>: solo {@link #REQUESTED}, asignado al crear la solicitud.
 * Las transiciones a {@link #REJECTED}/{@link #REFUNDED} requieren backoffice,
 * que no existe, y quedan fuera de alcance hasta que exista.</p>
 */
public enum ReturnStatus {
    REQUESTED,
    REJECTED,
    REFUNDED
}
