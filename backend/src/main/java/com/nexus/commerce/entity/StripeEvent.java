package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/** Evento de Stripe ya procesado (idempotencia del webhook, spec R3.2). */
@Entity
@Table(name = "stripe_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StripeEvent {

    @Id
    @Column(name = "event_id", length = 128)
    private String eventId;

    @Column(nullable = false, length = 64)
    private String type;

    @Column(name = "processed_at", nullable = false)
    private OffsetDateTime processedAt;
}
