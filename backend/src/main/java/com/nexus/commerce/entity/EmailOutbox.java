package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * Fila del outbox de emails transaccionales (V1 {@code order-status-emails},
 * migración {@code V17}, R4/R5/R8).
 *
 * <p><strong>Atómica con el negocio</strong>: la fila se inserta en la MISMA
 * transacción que el cambio de estado — si la transacción hace rollback no
 * queda ningún email (R5); si committea, la intención sobrevive a cualquier
 * caída posterior. El cuerpo va <strong>pre-renderizado</strong> (snapshot):
 * el email se lee como era en el momento del hecho, no como está la
 * plantilla hoy.</p>
 */
@Entity
@Table(name = "email_outbox")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailOutbox {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Dirección del comprador ({@code users.email}). */
    @Column(nullable = false, length = 320)
    private String recipient;

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(name = "body_html", nullable = false, columnDefinition = "TEXT")
    private String bodyHtml;

    /** Texto plano del multipart/alternative (respaldo y accesibilidad). */
    @Column(name = "body_text", nullable = false, columnDefinition = "TEXT")
    private String bodyText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EmailOutboxStatus status;

    /** Intentos realizados; a {@code 8} la fila pasa a FAILED (RT5). */
    @Column(nullable = false)
    private int attempts;

    /** Próxima oportunidad de envío (backoff). Durante el envío vale el alquiler. */
    @Column(name = "next_attempt_at", nullable = false)
    private OffsetDateTime nextAttemptAt;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    /** DB gestiona el default (V17): {@code DEFAULT NOW()}. */
    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;
}
