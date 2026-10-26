package com.nexus.commerce.entity;

/**
 * Estados del pedido — máquina única de la 7.4.
 *
 * <p>{@link #etiqueta()} es la <strong>fuente única del texto en español</strong>
 * de cada estado (espejo del frontend de la 7.4). Vive en el enum —y no en un
 * servicio— para que pueda usarla cualquier componente (p. ej.
 * {@code OrderEmailNotifier}, V1) <strong>sin inyectar servicios</strong> y sin
 * crear ciclos de dependencias entre beans (plan V1, D4/RT6).</p>
 */
public enum OrderStatus {
    PENDING,
    CONFIRMED,
    SHIPPED,
    DELIVERED,
    CANCELLED;

    /** Etiqueta en español para los mensajes de la máquina (espejo del frontend). */
    public String etiqueta() {
        return switch (this) {
            case PENDING -> "Pendiente";
            case CONFIRMED -> "Confirmado";
            case SHIPPED -> "Enviado";
            case DELIVERED -> "Entregado";
            case CANCELLED -> "Cancelado";
        };
    }
}
