package com.nexus.commerce.service;

import com.nexus.commerce.entity.EmailOutbox;
import com.nexus.commerce.entity.EmailOutboxStatus;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.EmailOutboxRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <strong>R5 medida, no supuesta</strong> (gates de la spec §5.6): la fila del
 * outbox se inserta en <strong>la misma transacción</strong> que el cambio de
 * negocio — vive y muere con ella.
 *
 * <p>Corre contra PostgreSQL real con el contexto entero. El poller no puede
 * interferir con las aserciones: las filas nacen con el primer turno a 30 s
 * (D10) y estos tests duran milisegundos.</p>
 */
@SpringBootTest
@DisplayName("R5 — la fila del email vive en la transacción del negocio")
class EmailOutboxTransaccionalTest {

    @Autowired
    private EmailOutboxRepository repository;

    @Autowired
    private OrderEmailNotifier notifier;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @AfterEach
    void limpiar() {
        repository.findAll().stream()
                .filter(fila -> fila.getSubject() != null && fila.getSubject().contains("NEX-ROLLBACK-1"))
                .map(EmailOutbox::getId)
                .forEach(repository::deleteById);
    }

    private Order pedidoDePrueba() {
        return Order.builder()
                .orderNumber("NEX-ROLLBACK-1")
                .status(OrderStatus.CONFIRMED)
                .currency("EUR")
                .totalAmount(new BigDecimal("10.00"))
                .user(User.builder().email("rollback@example.com").build())
                .build();
    }

    @Test
    @DisplayName("Si el negocio hace ROLLBACK no queda ninguna fila (ningún email de un hecho que no ocurrió)")
    void rollbackNoDejaFila() {
        // GIVEN
        long antes = repository.count();

        // WHEN — la fila se inserta y la transacción se revoca después
        transactionTemplate.executeWithoutResult(estado -> {
            notifier.notificar(pedidoDePrueba(), OrderStatus.CONFIRMED);
            estado.setRollbackOnly();
        });

        // THEN — el rollback se llevó la fila por delante
        assertThat(repository.count()).isEqualTo(antes);
        assertThat(repository.findAll())
                .noneMatch(fila -> fila.getSubject() != null
                        && fila.getSubject().contains("NEX-ROLLBACK-1"));
    }

    @Test
    @DisplayName("Si el negocio COMMITTEA la fila queda garantizada aunque el proceso se caiga después")
    void commitDejaLaFila() {
        // GIVEN
        long antes = repository.count();

        // WHEN
        transactionTemplate.executeWithoutResult(estado ->
                notifier.notificar(pedidoDePrueba(), OrderStatus.CONFIRMED));

        // THEN
        assertThat(repository.count()).isEqualTo(antes + 1);
        EmailOutbox fila = repository.findAll().stream()
                .filter(f -> f.getSubject() != null && f.getSubject().contains("NEX-ROLLBACK-1"))
                .findFirst().orElseThrow();
        assertThat(fila.getStatus()).isEqualTo(EmailOutboxStatus.PENDING);
        assertThat(fila.getRecipient()).isEqualTo("rollback@example.com");
    }
}
