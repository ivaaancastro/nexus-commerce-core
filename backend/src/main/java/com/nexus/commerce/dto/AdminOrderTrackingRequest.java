package com.nexus.commerce.dto;

import jakarta.validation.constraints.Size;

/**
 * Escritura de tracking desde el panel (Tarea 7.4, R5): <strong>full-replace</strong>
 * — campo ausente o vacío → {@code null} (sirve para limpiar). Editable en
 * cualquier estado: es metadato puro sin efectos (plan D5).
 *
 * @param carrier        transportista; máximo 64 caracteres
 * @param trackingNumber nº de seguimiento; máximo 64 caracteres
 */
public record AdminOrderTrackingRequest(
        @Size(max = 64, message = "El transportista no puede superar 64 caracteres")
        String carrier,

        @Size(max = 64, message = "El número de seguimiento no puede superar 64 caracteres")
        String trackingNumber
) {}
