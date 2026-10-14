package com.nexus.commerce.entity;

/**
 * Rol de autorización (Tarea 7.1, spec specs/admin-roles/, R1).
 *
 * <p>Dos valores a propósito: la autorización es <strong>por rol</strong>, no
 * por permiso granular (D4 de plan.md). Sólo {@code ADMIN} supera la regla
 * {@code hasRole("ADMIN")} de {@code /api/v1/admin/**}.</p>
 */
public enum Role {
    USER,
    ADMIN
}
