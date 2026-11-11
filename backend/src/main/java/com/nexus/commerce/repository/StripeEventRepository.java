package com.nexus.commerce.repository;

import com.nexus.commerce.entity.StripeEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StripeEventRepository extends JpaRepository<StripeEvent, String> {

    /**
     * Registra el evento <strong>de forma atómica</strong>: {@code 1} si es la
     * primera vez, {@code 0} si ya estaba (entrega repetida o concurrente). Es
     * la última línea de defensa de la idempotencia del webhook: la PK decide,
     * sin carrera entre un «existe» y un «guarda».
     */
    @Modifying
    @Query(value = """
            INSERT INTO stripe_events (event_id, type, processed_at)
            VALUES (:eventId, :type, now())
            ON CONFLICT (event_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("eventId") String eventId, @Param("type") String type);
}
