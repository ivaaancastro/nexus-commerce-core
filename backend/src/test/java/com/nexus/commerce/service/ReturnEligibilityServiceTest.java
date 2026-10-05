package com.nexus.commerce.service;

import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.repository.ProductReturnRepository;
import com.nexus.commerce.service.ReturnEligibilityService.Eligibility;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Reglas R1 (30 días), R2 (DELIVERED) y R3 (una devolución por línea)
 * de la spec de la Tarea 5.4.
 */
@ExtendWith(MockitoExtension.class)
class ReturnEligibilityServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-05T12:00:00Z");
    private static final Long ITEM_ID = 55L;

    @Mock
    private ProductReturnRepository productReturnRepository;

    /** Reloj fijo: el límite de 30 días se testea sin depender de la fecha real. */
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private ReturnEligibilityService service;

    @BeforeEach
    void setUp() {
        service = new ReturnEligibilityService(productReturnRepository, clock);
    }

    @Test
    @DisplayName("R2 - Un pedido no entregado nunca es devolvible, sea cual sea su estado")
    void shouldRejectAnyStatusOtherThanDelivered() {
        List<OrderStatus> notDelivered = List.of(
                OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.CANCELLED);

        for (OrderStatus status : notDelivered) {
            Eligibility eligibility = service.evaluate(order(status, NOW.minus(1, ChronoUnit.DAYS)), item());

            assertThat(eligibility.eligible())
                    .as("estado %s", status)
                    .isFalse();
            assertThat(eligibility.ineligibleReason())
                    .as("motivo con estado %s", status)
                    .isEqualTo(ReturnEligibilityService.REASON_NOT_DELIVERED);
        }
    }

    @Test
    @DisplayName("R2 - El checkout (pedido PENDING) no consulta la BD de devoluciones")
    void shouldNotQueryRepositoryWhenOrderIsNotDelivered() {
        service.evaluate(order(OrderStatus.PENDING, NOW.minus(1, ChronoUnit.DAYS)), item());

        verifyNoInteractions(productReturnRepository);
    }

    @Test
    @DisplayName("Elegible - Pedido DELIVERED, comprado hace 29 días y sin devolución previa")
    void shouldBeEligibleWhenDeliveredWithinWindowAndNoReturn() {
        when(productReturnRepository.existsByOrderItemId(ITEM_ID)).thenReturn(false);

        Eligibility eligibility = service.evaluate(
                order(OrderStatus.DELIVERED, NOW.minus(29, ChronoUnit.DAYS)), item());

        assertThat(eligibility.eligible()).isTrue();
        assertThat(eligibility.ineligibleReason()).isNull();
    }

    @Test
    @DisplayName("R1 - Elegible justo antes del límite: 29 días y 23:59:59")
    void shouldBeEligibleOneSecondBeforeDeadline() {
        when(productReturnRepository.existsByOrderItemId(ITEM_ID)).thenReturn(false);

        Eligibility eligibility = service.evaluate(
                order(OrderStatus.DELIVERED, NOW.minus(30, ChronoUnit.DAYS).plusSeconds(1)), item());

        assertThat(eligibility.eligible()).isTrue();
    }

    @Test
    @DisplayName("R1 - No elegible a los 30 días exactos: la ventana es estricta")
    void shouldRejectAtExactlyThirtyDays() {
        when(productReturnRepository.existsByOrderItemId(ITEM_ID)).thenReturn(false);

        Eligibility eligibility = service.evaluate(
                order(OrderStatus.DELIVERED, NOW.minus(30, ChronoUnit.DAYS)), item());

        assertThat(eligibility.eligible()).isFalse();
        assertThat(eligibility.ineligibleReason()).isEqualTo(ReturnEligibilityService.REASON_EXPIRED);
    }

    @Test
    @DisplayName("R1 - No elegible a los 31 días: el plazo ya está agotado")
    void shouldRejectAfterThirtyOneDays() {
        when(productReturnRepository.existsByOrderItemId(ITEM_ID)).thenReturn(false);

        Eligibility eligibility = service.evaluate(
                order(OrderStatus.DELIVERED, NOW.minus(31, ChronoUnit.DAYS)), item());

        assertThat(eligibility.eligible()).isFalse();
        assertThat(eligibility.ineligibleReason()).isEqualTo(ReturnEligibilityService.REASON_EXPIRED);
    }

    @Test
    @DisplayName("R3 - No elegible si la línea ya tiene una devolución, sea cual sea su estado")
    void shouldRejectWhenLineAlreadyHasAReturn() {
        when(productReturnRepository.existsByOrderItemId(ITEM_ID)).thenReturn(true);

        Eligibility eligibility = service.evaluate(
                order(OrderStatus.DELIVERED, NOW.minus(5, ChronoUnit.DAYS)), item());

        assertThat(eligibility.eligible()).isFalse();
        assertThat(eligibility.ineligibleReason())
                .isEqualTo(ReturnEligibilityService.REASON_ALREADY_RETURNED);
    }

    @Test
    @DisplayName("R3 - Prioridad: si ya se devolvió el motivo es ALREADY_RETURNED, no EXPIRED")
    void shouldPreferAlreadyReturnedWhenTheLineIsExpiredToo() {
        when(productReturnRepository.existsByOrderItemId(ITEM_ID)).thenReturn(true);

        Eligibility eligibility = service.evaluate(
                order(OrderStatus.DELIVERED, NOW.minus(60, ChronoUnit.DAYS)), item());

        assertThat(eligibility.ineligibleReason())
                .isEqualTo(ReturnEligibilityService.REASON_ALREADY_RETURNED);
    }

    @Test
    @DisplayName("isEligible - Devuelve lo mismo que evaluate(...).eligible()")
    void isEligibleShouldMatchEvaluate() {
        when(productReturnRepository.existsByOrderItemId(ITEM_ID)).thenReturn(false);

        boolean eligible = service.isEligible(
                order(OrderStatus.DELIVERED, NOW.minus(2, ChronoUnit.DAYS)), item());

        assertThat(eligible).isTrue();
    }

    // ------------------------------------------------------------- helpers

    private Order order(OrderStatus status, Instant createdAt) {
        Order order = new Order();
        order.setStatus(status);
        order.setCreatedAt(createdAt);
        return order;
    }

    private OrderItem item() {
        OrderItem item = new OrderItem();
        item.setId(ITEM_ID);
        return item;
    }
}
