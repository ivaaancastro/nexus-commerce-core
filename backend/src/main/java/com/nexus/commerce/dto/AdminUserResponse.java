package com.nexus.commerce.dto;

import com.nexus.commerce.entity.Role;

import java.time.Instant;

/**
 * Fila del listado de usuarios del panel (Tarea 7.5, R1) y respuesta de los
 * {@code PUT} de rol/suspensión (R2/R3): un único record para lista y acciones
 * — misma forma a los dos lados, cero ambigüedad cliente/servidor (plan D5).
 *
 * @param role         rol vigente; el cambio de rol lo aplica el service (R2)
 * @param suspended    derivado <strong>en servidor</strong> ({@code suspendedAt != null})
 *                     para que ningún consumidor tenga que repetir la lógica
 * @param suspendedAt  instante de la suspensión; {@code null} = cuenta activa (V15)
 * @param createdAt    alta de la cuenta — orden del listado (R1)
 */
public record AdminUserResponse(
        Long id,
        String email,
        String firstName,
        String lastName,
        Role role,
        boolean suspended,
        Instant suspendedAt,
        Instant createdAt
) {
    /** Hacedor de servicio: {@code suspended} se deriva de {@code suspendedAt}. */
    public static AdminUserResponse of(Long id, String email, String firstName,
                                       String lastName, Role role, Instant suspendedAt,
                                       Instant createdAt) {
        return new AdminUserResponse(id, email, firstName, lastName, role,
                suspendedAt != null, suspendedAt, createdAt);
    }
}
