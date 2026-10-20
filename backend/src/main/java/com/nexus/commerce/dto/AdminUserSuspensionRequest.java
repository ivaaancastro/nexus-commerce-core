package com.nexus.commerce.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Suspensión/restauración desde el panel (Tarea 7.5, R3): {@code true} suspende
 * (fija {@code suspendedAt}), {@code false} restaura (lo limpia). La operación
 * es idempotente y no toca el rol — las guardas (auto-suspensión, último admin)
 * viven en el service (plan D4).
 */
public record AdminUserSuspensionRequest(
        @NotNull(message = "El estado de suspensión es obligatorio")
        Boolean suspended
) {}
