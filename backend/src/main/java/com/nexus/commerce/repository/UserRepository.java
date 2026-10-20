package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Role;
import com.nexus.commerce.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    /**
     * Listado del panel (Tarea 7.5, R1): <strong>todos</strong> los usuarios,
     * ordenados por {@code createdAt DESC, id DESC} (el id desempata para que
     * el orden sea estable entre páginas).
     *
     * <p>Filtro {@code opcional} sobre email/nombre/apellido en
     * {@code LOWER(...)} con {@code LIKE %q%}; el {@code NULL} del parámetro
     * desactiva las tres ramas, así que una sola query sirve con y sin búsqueda
     * (mismo esquema que {@code OrderRepository.findAllForAdmin}, sin SQL
     * dinámico).</p>
     *
     * <p><strong>{@code CAST(:q AS string)} es obligatorio</strong>: con
     * {@code q = null} PostgreSQL recibe el parámetro sin tipar y resuelve
     * {@code lower(bytea)} → {@code function lower(bytea) does not exist} aunque
     * la rama del LIKE nunca se ejecute — la trampa que obligó a corregirlo en
     * la 7.4.</p>
     *
     * <p>Sólo escalaros: el mapper del service jamás abre
     * {@code addresses}/{@code orders} (sin N+1, plan D5).</p>
     */
    @Query(value = """
            SELECT u FROM User u
            WHERE (:q IS NULL
                   OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            ORDER BY u.createdAt DESC, u.id DESC
            """,
            countQuery = """
            SELECT count(u) FROM User u
            WHERE (:q IS NULL
                   OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    Page<User> findAllForAdmin(@Param("q") String q, Pageable pageable);

    /**
     * Guarda de «último admin activo» (Tarea 7.5, plan D4): cuenta los ADMIN
     * con {@code suspended_at IS NULL}. Una query por acción — escribir es una
     * fila, así que no hay riesgo N+1.
     *
     * @return nº de administradores <strong>activos</strong> (suspendidos no
     *         cuentan: no pueden entrar al panel)
     */
    long countByRoleAndSuspendedAtIsNull(Role role);

    /**
     * Dashboard 7.6 (R3): cuentas con {@code suspended_at IS NOT NULL}, de
     * <strong>cualquier rol</strong> (el bloque «suspendidos» no distingue
     * quién era).
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.suspendedAt IS NOT NULL")
    long contarSuspendidos();

    /**
     * Dashboard 7.6 (R3): altas creadas a partir de {@code from} (≥, para
     * cuadrar con el {@code from} del resto de bloques del dashboard).
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.createdAt >= :from")
    long contarAltasDesde(@Param("from") Instant from);
}
