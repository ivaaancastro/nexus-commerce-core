package com.nexus.commerce.dto;

import com.nexus.commerce.entity.Role;
import jakarta.validation.constraints.NotNull;

/**
 * Cambio de rol desde el panel (Tarea 7.5, R2): sólo se transporta el rol
 * deseado — las guardas de «último admin activo» viven en el service (plan D4).
 */
public record AdminUserRoleRequest(
        @NotNull(message = "El rol es obligatorio")
        Role role
) {}
