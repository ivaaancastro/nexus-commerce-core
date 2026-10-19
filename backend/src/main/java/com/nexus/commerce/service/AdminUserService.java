package com.nexus.commerce.service;

import com.nexus.commerce.dto.AdminUserPageResponse;
import com.nexus.commerce.dto.AdminUserResponse;
import com.nexus.commerce.dto.AdminUserRoleRequest;
import com.nexus.commerce.dto.AdminUserSuspensionRequest;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.UserConflictException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Gestión de usuarios del panel (Tarea 7.5, spec specs/admin-users/).
 *
 * <p><strong>No hay reglas de seguridad nuevas</strong>: al vivir bajo
 * {@code /api/v1/admin/**}, hereda el {@code hasRole("ADMIN")} de la 7.1
 * (ADR-0006) antes del {@code anyRequest().denyAll()}. {@code SecurityConfig}
 * no se modifica (plan D1).</p>
 *
 * <p>Las dos guardas de bloqueo (plan D4) son <strong>previas a la
 * escritura</strong>: en un {@code 409} la BD no cambia.</p>
 *
 * <p><strong>La suspensión no borra ni toca datos</strong> (plan D8): es
 * <em>no-login</em> — pedidos, direcciones e histórico quedan intactos.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminUserService {

    private final UserRepository userRepository;

    // ── Lectura ────────────────────────────────────────────────────────────

    /**
     * Listado del panel (R1): todos los usuarios, orden {@code createdAt DESC},
     * búsqueda opcional {@code q} sobre email/nombre/apellido.
     *
     * <p>Vacío o en blanco = sin filtro (el frontend no debe distinguir «no
     * mandó q» de «mandó q vacío»). Sin resultados es {@code 200} con lista
     * vacía — la página existe, sólo está vacía.</p>
     */
    @Transactional(readOnly = true)
    public AdminUserPageResponse listar(int page, int size, String q) {
        String termino = (q == null || q.isBlank()) ? null : q.trim();

        Page<User> resultado = userRepository.findAllForAdmin(termino, PageRequest.of(page, size));

        return new AdminUserPageResponse(
                resultado.getContent().stream().map(AdminUserService::toResponse).toList(),
                resultado.getNumber(),
                resultado.getSize(),
                resultado.getTotalElements(),
                resultado.getTotalPages());
    }

    // ── Escritura ──────────────────────────────────────────────────────────

    /**
     * Cambio de rol (R2): {@code USER} ⇄ {@code ADMIN}.
     *
     * <p><strong>Guarda</strong>: no se puede degradar al <em>último admin
     * activo</em> — el panel se quedaría fuera de su propia puerta. La
     * auto-degradación <em>está permitida</em> si queda ≥ 1 admin activo
     * distinto: es una decisión legítima del operador (plan D4).</p>
     *
     * @param request rol deseado (validado {@code @NotNull} en el DTO)
     */
    @Transactional
    public AdminUserResponse cambiarRol(Long id, AdminUserRoleRequest request) {
        User user = buscar(id);

        boolean degradando = user.getRole() == Role.ADMIN && request.role() == Role.USER;
        if (degradando && user.getSuspendedAt() == null
                && userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN) <= 1) {
            throw new UserConflictException(
                    "No se puede quitar el rol: es el único administrador activo");
        }

        user.setRole(request.role());
        return toResponse(userRepository.save(user));
    }

    /**
     * Suspensión/restauración (R3): idempotente — suspender una cuenta ya
     * suspendida conserva el instante original (no se pisa la fecha) y
     * restaurar una activa es un no-op; el <strong>rol no cambia</strong>.
     *
     * <p><strong>Guardas</strong> previas a la escritura (plan D4): ni
     * auto-suspensión (rompería la sesión del operador a mitad de acción) ni
     * suspender al último admin activo (la restauración tendría que ser por
     * SQL).</p>
     *
     * @param callerEmail email del operador autenticado ({@code Authentication.getName()})
     */
    @Transactional
    public AdminUserResponse cambiarSuspension(Long id, AdminUserSuspensionRequest request,
                                               String callerEmail) {
        User user = buscar(id);

        if (Boolean.TRUE.equals(request.suspended())) {
            if (user.getEmail().equalsIgnoreCase(callerEmail)) {
                throw new UserConflictException("No puedes suspenderte a ti mismo");
            }
            if (user.getRole() == Role.ADMIN && user.getSuspendedAt() == null
                    && userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN) <= 1) {
                throw new UserConflictException(
                        "No se puede suspender: es el único administrador activo");
            }
            if (user.getSuspendedAt() == null) {
                user.setSuspendedAt(Instant.now());
            }
        } else {
            user.setSuspendedAt(null);
        }

        return toResponse(userRepository.save(user));
    }

    // ── Internos ───────────────────────────────────────────────────────────

    private User buscar(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con id " + id));
    }

    /**
     * Única definición de la forma del usuario admin (plan D5): la lista y los
     * {@code PUT} comparten record. Sólo escalaros — nunca se abren
     * {@code addresses}/{@code orders} (sin N+1).
     */
    private static AdminUserResponse toResponse(User user) {
        return AdminUserResponse.of(user.getId(), user.getEmail(), user.getFirstName(),
                user.getLastName(), user.getRole(), user.getSuspendedAt(), user.getCreatedAt());
    }
}
