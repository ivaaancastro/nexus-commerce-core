package com.nexus.commerce.repository;

import com.nexus.commerce.entity.EmailOutbox;
import com.nexus.commerce.entity.EmailOutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface EmailOutboxRepository extends JpaRepository<EmailOutbox, Long> {

    /** Filas cuya oportunidad de envío llegó (R8: el backoff vive en {@code next_attempt_at}). */
    List<EmailOutbox> findByStatusAndNextAttemptAtLessThanEqual(
            EmailOutboxStatus status, OffsetDateTime ahora);

    /**
     * <strong>Toma condicionada</strong> (RT5): sólo gana quien escribe
     * {@code PENDING → SENDING} primero — dos ejecuciones jamás envían el
     * mismo email. {@code hasta} es el alquiler: si el proceso se corta, la
     * fila vuelve a {@code PENDING} al expirar.
     *
     * <p>Cada operación es su propia transacción (no envolvemos el SMTP en
     * ninguna): el poller no mantiene conexiones abiertas mientras manda
     * correo.</p>
     */
    @Transactional
    @Modifying
    @Query("UPDATE EmailOutbox e SET e.status = :destino, e.nextAttemptAt = :hasta "
            + "WHERE e.id = :id AND e.status = :pendiente")
    int tomarSiPendiente(@Param("id") Long id,
                         @Param("destino") EmailOutboxStatus destino,
                         @Param("pendiente") EmailOutboxStatus pendiente,
                         @Param("hasta") OffsetDateTime hasta);

    /**
     * Recuperación de filas <strong>atascadas en {@code SENDING}</strong> por
     * un corte del proceso: el alquiler expiró y vuelven a la cola (RT5).
     */
    @Transactional
    @Modifying
    @Query("UPDATE EmailOutbox e SET e.status = :pendiente "
            + "WHERE e.status = :tomada AND e.nextAttemptAt <= :umbral")
    int recuperarAtascadas(@Param("tomada") EmailOutboxStatus tomada,
                           @Param("pendiente") EmailOutboxStatus pendiente,
                           @Param("umbral") OffsetDateTime umbral);
}
