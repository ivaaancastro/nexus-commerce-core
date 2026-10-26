package com.nexus.commerce.service;

import com.nexus.commerce.entity.EmailOutbox;
import com.nexus.commerce.entity.EmailOutboxStatus;
import com.nexus.commerce.repository.EmailOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * El que de verdad <strong>envía</strong> los emails del outbox (V1, D3/RT5).
 *
 * <p>Cada turno: recupera filas atascadas en {@code SENDING} (alquiler
 * expirado), coge las {@code PENDING} cuyo turno llegó <strong>con toma
 * condicionada</strong> (nadie envía dos veces) y envía cada una
 * <strong>fuera de transacción</strong> — SMTP nunca dentro de un
 * {@code @Transactional} (D2). Fallo → {@code attempts++} y backoff (30 s
 * duplicando, tope ~1 h); a los 8 intentos → {@code FAILED} con el motivo en
 * {@code last_error}. <strong>Nunca lanza</strong>: el cron no se rompe (D3).</p>
 *
 * <p><strong>Determinismo en tests (D10)</strong>: la cadencia del
 * {@code @Scheduled} sólo es un latido por defecto (15 s, configurable con
 * {@code app.mail.outbox.poll-ms}); los tests llaman a mano a
 * {@link #procesarPendientes()} y las filas nacen con el primer turno a 30 s
 * — nadie depende del reloj.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmailOutboxPoller {

    /** Reintentos máximos antes de dar la fila por perdida (RT5/R8). */
    static final int MAX_INTENTOS = 8;
    /** Espera del primer reintento: 30 s, después duplica. */
    static final Duration ESPERA_BASE = Duration.ofSeconds(30);
    /** Techo del backoff (~1 h). */
    static final Duration ESPERA_TOPE = Duration.ofHours(1);
    /** Alquiler de una fila en {@code SENDING}: si expira, se recupera. */
    static final Duration ALQUILER = Duration.ofMinutes(10);

    private final EmailOutboxRepository repository;
    private final EmailService emailService;
    private final Clock clock;

    /** Latido automático. Cualquier fallo queda logueado: el cron no se cae. */
    @Scheduled(fixedDelayString = "${app.mail.outbox.poll-ms:15000}")
    public void programar() {
        try {
            int procesadas = procesarPendientes();
            if (procesadas > 0) {
                log.info("Outbox: {} email(s) procesado(s)", procesadas);
            }
        } catch (Exception e) {
            log.error("El poller del outbox no debe romperse: {}", e.getMessage());
        }
    }

    /**
     * Procesa todo lo que esté listo. <strong>Los tests la llaman a mano</strong>
     * (D10): determinista, sin esperar al cron ni al reloj.
     *
     * @return número de filas efectivamente tomadas en esta pasada
     */
    public int procesarPendientes() {
        OffsetDateTime ahora = OffsetDateTime.now(clock);

        // Filas atascadas: el proceso se cortó con el alquiler vigente.
        int recuperadas = repository.recuperarAtascadas(
                EmailOutboxStatus.SENDING, EmailOutboxStatus.PENDING, ahora.minus(ALQUILER));
        if (recuperadas > 0) {
            log.warn("Outbox: {} fila(s) atascadas en SENDING vuelven a la cola", recuperadas);
        }

        List<EmailOutbox> pendientes = repository.findByStatusAndNextAttemptAtLessThanEqual(
                EmailOutboxStatus.PENDING, ahora);

        int tomadas = 0;
        for (EmailOutbox fila : pendientes) {
            boolean ganada = repository.tomarSiPendiente(
                    fila.getId(), EmailOutboxStatus.SENDING,
                    EmailOutboxStatus.PENDING, ahora.plus(ALQUILER)) > 0;
            if (!ganada) {
                continue; // otra ejecución se la llevó: jamás dos envíos
            }
            enviar(fila, ahora);
            tomadas++;
        }
        return tomadas;
    }

    /** Envío de una fila ya alquilada: marca el destino según el resultado (R8). */
    private void enviar(EmailOutbox fila, OffsetDateTime ahora) {
        try {
            emailService.enviarPedido(fila.getRecipient(),
                    new EmailHtmlTemplates.Mensaje(fila.getSubject(), fila.getBodyHtml(), fila.getBodyText()));
            fila.setStatus(EmailOutboxStatus.SENT);
            fila.setSentAt(ahora);
            repository.save(fila);
            log.info("Outbox: email «{}» enviado a {}", fila.getSubject(), fila.getRecipient());
        } catch (Exception e) {
            registrarFallo(fila, ahora, e.getMessage());
        }
    }

    /** Reintento con backoff o rendición con honor a los 8 (R8). Nunca lanza. */
    private void registrarFallo(EmailOutbox fila, OffsetDateTime ahora, String motivo) {
        int intentos = fila.getAttempts() + 1;
        fila.setAttempts(intentos);
        fila.setLastError(motivo);
        if (intentos >= MAX_INTENTOS) {
            fila.setStatus(EmailOutboxStatus.FAILED);
            log.error("Outbox: email «{}» a {} DEFINITIVAMENTE PERDIDO tras {} intentos: {}",
                    fila.getSubject(), fila.getRecipient(), intentos, motivo);
        } else {
            fila.setStatus(EmailOutboxStatus.PENDING);
            fila.setNextAttemptAt(ahora.plus(espera(intentos)));
            log.warn("Outbox: fallo nº {} enviando «{}»: {}. Reintento a las {}",
                    intentos, fila.getSubject(), motivo, fila.getNextAttemptAt());
        }
        repository.save(fila);
    }

    /** Backoff exponencial con techo: 30 s, 1 m, 2 m, 4 m… nunca más de ~1 h. */
    static Duration espera(int intentosYaRealizados) {
        Duration espera = ESPERA_BASE.multipliedBy(1L << Math.min(intentosYaRealizados - 1, 20));
        return espera.compareTo(ESPERA_TOPE) > 0 ? ESPERA_TOPE : espera;
    }
}
