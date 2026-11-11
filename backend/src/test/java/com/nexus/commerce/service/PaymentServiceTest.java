package com.nexus.commerce.service;

import com.nexus.commerce.config.PaymentsProperties;
import com.nexus.commerce.dto.AdminOrderDetailResponse;
import com.nexus.commerce.dto.PaymentSessionResponse;
import com.nexus.commerce.dto.RefundRequest;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.PaymentStatus;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.InvalidWebhookSignatureException;
import com.nexus.commerce.exception.PaymentConflictException;
import com.nexus.commerce.exception.PaymentGatewayException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.StripeEventRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * Fase 9 — {@link PaymentService}: sesión de pago (R2), webhook (R3), reembolso
 * (R4) y expiración (R6) con {@link StripeGateway} mockeado: ni red ni claves.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Fase 9 - PaymentService: sesión de pago, webhook idempotente, reembolsos y expiración")
class PaymentServiceTest {

    private static final String NUM = "ORD-PAY-1";
    private static final String PI = "pi_test_1";
    private static final Clock RELOJ = Clock.fixed(Instant.parse("2026-11-10T12:00:00Z"), ZoneOffset.UTC);

    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private StripeEventRepository stripeEventRepository;
    @Mock private StripeGateway stripeGateway;
    @Mock private PaymentsProperties payments;
    @Mock private AdminOrderService adminOrderService;
    @Mock private OrderEmailNotifier orderEmailNotifier;

    private PaymentService service;

    @BeforeEach
    void crearServicio() {
        service = new PaymentService(orderRepository, userRepository, stripeEventRepository, stripeGateway,
                payments, adminOrderService, orderEmailNotifier, RELOJ);
    }

    private static Order pedido(OrderStatus estado, PaymentStatus pago) {
        return Order.builder()
                .id(1L).orderNumber(NUM).idempotencyKey("idem-1").marketCode("ES").currency("EUR")
                .status(estado).paymentStatus(pago).paymentIntentId(PI)
                .subtotalAmount(new BigDecimal("82.64")).taxAmount(new BigDecimal("17.36"))
                .totalAmount(new BigDecimal("100.00"))
                .build();
    }

    // ── R2: sesión de pago ─────────────────────────────────────────────────

    @Nested
    @DisplayName("R2 · GET /orders/{n}/payment")
    class SesionDePago {

        @Test
        @DisplayName("devuelve el clientSecret recuperado de Stripe y la clave publicable, solo al dueño")
        void devuelveClientSecret() {
            Order o = pedido(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT);
            when(payments.isEnabled()).thenReturn(true);
            when(payments.getPublishableKey()).thenReturn("pk_test_abc");
            when(userRepository.findByEmail("ana@nexus.dev")).thenReturn(Optional.of(User.builder().id(7L).build()));
            when(orderRepository.findByUserIdAndOrderNumber(7L, NUM)).thenReturn(Optional.of(o));
            when(stripeGateway.retrievePaymentIntent(PI))
                    .thenReturn(new StripeGateway.GatewayPaymentIntent(PI, "pi_secret_xyz", "requires_payment_method"));

            PaymentSessionResponse res = service.getPaymentSession("ana@nexus.dev", NUM);

            assertThat(res.clientSecret()).isEqualTo("pi_secret_xyz");
            assertThat(res.publishableKey()).isEqualTo("pk_test_abc");
            assertThat(res.paymentStatus()).isEqualTo(PaymentStatus.REQUIRES_PAYMENT);
        }

        @Test
        @DisplayName("pedido de otro usuario o inexistente → 404 (no se distingue)")
        void pedidoAjeno404() {
            when(userRepository.findByEmail("eva@nexus.dev")).thenReturn(Optional.of(User.builder().id(8L).build()));
            when(orderRepository.findByUserIdAndOrderNumber(8L, NUM)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getPaymentSession("eva@nexus.dev", NUM))
                    .isInstanceOf(ResourceNotFoundException.class);
            verifyNoInteractions(stripeGateway);
        }

        @Test
        @DisplayName("pedido CANCELADO/caducado (conserva REQUIRES_PAYMENT pero su PaymentIntent está anulado) → 409, sin pedir el clientSecret")
        void pedidoCaducadoNoSePaga409() {
            Order caducado = pedido(OrderStatus.CANCELLED, PaymentStatus.REQUIRES_PAYMENT);
            when(payments.isEnabled()).thenReturn(true);
            when(userRepository.findByEmail("ana@nexus.dev")).thenReturn(Optional.of(User.builder().id(7L).build()));
            when(orderRepository.findByUserIdAndOrderNumber(7L, NUM)).thenReturn(Optional.of(caducado));

            assertThatThrownBy(() -> service.getPaymentSession("ana@nexus.dev", NUM))
                    .isInstanceOf(PaymentConflictException.class);
            verifyNoInteractions(stripeGateway);
        }

        @Test
        @DisplayName("pedido ya pagado, sin PaymentIntent o en modo sin pasarela → 409 PAYMENT_CONFLICT")
        void sinPagoPendiente409() {
            when(userRepository.findByEmail("ana@nexus.dev")).thenReturn(Optional.of(User.builder().id(7L).build()));
            when(payments.isEnabled()).thenReturn(true);
            Order pagado = pedido(OrderStatus.CONFIRMED, PaymentStatus.PAID);
            when(orderRepository.findByUserIdAndOrderNumber(7L, NUM)).thenReturn(Optional.of(pagado));

            assertThatThrownBy(() -> service.getPaymentSession("ana@nexus.dev", NUM))
                    .isInstanceOf(PaymentConflictException.class);

            Order sinPi = pedido(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT);
            sinPi.setPaymentIntentId(null);
            when(orderRepository.findByUserIdAndOrderNumber(7L, "ORD-2")).thenReturn(Optional.of(sinPi));
            assertThatThrownBy(() -> service.getPaymentSession("ana@nexus.dev", "ORD-2"))
                    .isInstanceOf(PaymentConflictException.class);

            verifyNoInteractions(stripeGateway);
        }
    }

    // ── R3: webhook ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("R3 · POST /webhooks/stripe")
    class Webhook {

        private void eventoNuevo(String id, String tipo, String pi, String numero, long reembolsadoMinor) {
            when(payments.isEnabled()).thenReturn(true);
            when(stripeGateway.verifyWebhook("{}", "sig"))
                    .thenReturn(new StripeGateway.WebhookEvent(id, tipo, pi, numero, reembolsadoMinor));
            when(stripeEventRepository.insertIfAbsent(id, tipo)).thenReturn(1);
        }

        @Test
        @DisplayName("modo sin pasarela → 404 y no toca nada")
        void sinPasarela404() {
            when(payments.isEnabled()).thenReturn(false);

            assertThatThrownBy(() -> service.handleWebhook("{}", "sig"))
                    .isInstanceOf(ResourceNotFoundException.class);
            verifyNoInteractions(stripeGateway, stripeEventRepository, orderRepository);
        }

        @Test
        @DisplayName("firma inválida → se propaga y NO hay ningún efecto en BD")
        void firmaInvalidaSinEfectos() {
            when(payments.isEnabled()).thenReturn(true);
            when(stripeGateway.verifyWebhook("{}", "mala")).thenThrow(new InvalidWebhookSignatureException());

            assertThatThrownBy(() -> service.handleWebhook("{}", "mala"))
                    .isInstanceOf(InvalidWebhookSignatureException.class);
            verifyNoInteractions(stripeEventRepository, orderRepository, orderEmailNotifier);
        }

        @Test
        @DisplayName("evento repetido (insertIfAbsent = 0) → no se procesa de nuevo")
        void eventoRepetidoSinEfecto() {
            when(payments.isEnabled()).thenReturn(true);
            when(stripeGateway.verifyWebhook("{}", "sig"))
                    .thenReturn(new StripeGateway.WebhookEvent("evt_1", "payment_intent.succeeded", PI, NUM, 0));
            when(stripeEventRepository.insertIfAbsent("evt_1", "payment_intent.succeeded")).thenReturn(0);

            service.handleWebhook("{}", "sig");

            verifyNoInteractions(orderRepository, orderEmailNotifier);
        }

        @Test
        @DisplayName("payment_intent.succeeded confirma el PENDING, marca PAID y encola el email")
        void succeededConfirma() {
            Order o = pedido(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT);
            eventoNuevo("evt_1", "payment_intent.succeeded", PI, NUM, 0);
            when(orderRepository.findByPaymentIntentIdForUpdate(PI)).thenReturn(Optional.of(o));

            service.handleWebhook("{}", "sig");

            assertThat(o.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            verify(orderRepository).save(o);
            verify(orderEmailNotifier).notificar(o, OrderStatus.CONFIRMED);
        }

        @Test
        @DisplayName("el webhook llega ANTES de guardar el payment_intent_id → se localiza por metadata.orderNumber")
        void succeededLlegaAntesDelIdDelPaymentIntent() {
            Order o = pedido(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT);
            o.setPaymentIntentId(null);
            eventoNuevo("evt_2", "payment_intent.succeeded", PI, NUM, 0);
            when(orderRepository.findByPaymentIntentIdForUpdate(PI)).thenReturn(Optional.empty());
            when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(o));

            service.handleWebhook("{}", "sig");

            assertThat(o.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
            assertThat(o.getPaymentIntentId()).isEqualTo(PI);
        }

        @Test
        @DisplayName("succeeded sobre un pedido ya pagado → sin segundo email ni cambios")
        void succeededYaPagado() {
            Order o = pedido(OrderStatus.CONFIRMED, PaymentStatus.PAID);
            eventoNuevo("evt_3", "payment_intent.succeeded", PI, NUM, 0);
            when(orderRepository.findByPaymentIntentIdForUpdate(PI)).thenReturn(Optional.of(o));

            service.handleWebhook("{}", "sig");

            verifyNoInteractions(orderEmailNotifier);
            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("pago tardío sobre un pedido CANCELLED → NO se resucita: queda PAID para reembolsarlo, sin email")
        void pagoTardioNoResucita() {
            Order o = pedido(OrderStatus.CANCELLED, PaymentStatus.REQUIRES_PAYMENT);
            eventoNuevo("evt_4", "payment_intent.succeeded", PI, NUM, 0);
            when(orderRepository.findByPaymentIntentIdForUpdate(PI)).thenReturn(Optional.of(o));

            service.handleWebhook("{}", "sig");

            assertThat(o.getStatus()).isEqualTo(OrderStatus.CANCELLED);
            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            verifyNoInteractions(orderEmailNotifier);
        }

        @Test
        @DisplayName("pago de un pedido que no existe → 200 silencioso (otro sistema en la misma cuenta)")
        void succeededSinPedido() {
            eventoNuevo("evt_5", "payment_intent.succeeded", "pi_otro", null, 0);
            when(orderRepository.findByPaymentIntentIdForUpdate("pi_otro")).thenReturn(Optional.empty());

            assertThatCode(() -> service.handleWebhook("{}", "sig")).doesNotThrowAnyException();
            verifyNoInteractions(orderEmailNotifier);
        }

        @Test
        @DisplayName("payment_intent.payment_failed → el pedido sigue PENDING (el cliente puede reintentar)")
        void paymentFailedNoCambiaNada() {
            eventoNuevo("evt_6", "payment_intent.payment_failed", PI, NUM, 0);

            service.handleWebhook("{}", "sig");

            verifyNoInteractions(orderRepository, orderEmailNotifier);
        }

        @Test
        @DisplayName("charge.refunded fija el VALOR ABSOLUTO: parcial → PARTIALLY_REFUNDED; todo → REFUNDED")
        void chargeRefundedAbsoluto() {
            Order o = pedido(OrderStatus.CONFIRMED, PaymentStatus.PAID);
            eventoNuevo("evt_7", "charge.refunded", PI, null, 2500);
            when(orderRepository.findByPaymentIntentIdForUpdate(PI)).thenReturn(Optional.of(o));

            service.handleWebhook("{}", "sig");

            assertThat(o.getAmountRefunded()).isEqualByComparingTo("25.00");
            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);

            when(stripeGateway.verifyWebhook("{}", "sig2")).thenReturn(
                    new StripeGateway.WebhookEvent("evt_8", "charge.refunded", PI, null, 10000));
            when(stripeEventRepository.insertIfAbsent("evt_8", "charge.refunded")).thenReturn(1);
            service.handleWebhook("{}", "sig2");

            assertThat(o.getAmountRefunded()).isEqualByComparingTo("100.00");
            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        }

        @Test
        @DisplayName("charge.refunded ENTREGADO TARDE (valor menor que el ya guardado) no baja el reembolso ni reabre el pedido")
        void chargeRefundedAntiguoNoBajaElReembolso() {
            Order o = pedido(OrderStatus.CONFIRMED, PaymentStatus.REFUNDED);
            o.setAmountRefunded(new BigDecimal("100.00"));
            eventoNuevo("evt_old", "charge.refunded", PI, null, 3050); // el primer reembolso (30,50), llegado después del total

            service.handleWebhook("{}", "sig");

            assertThat(o.getAmountRefunded()).isEqualByComparingTo("100.00");
            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        }

        @Test
        @DisplayName("charge.refunded ADELANTADO al cobro: se rechaza (500) para que Stripe lo reintente, no se descarta como procesado")
        void chargeRefundedAntesDelCobroSeReintenta() {
            Order sinCobrar = pedido(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT);
            eventoNuevo("evt_early", "charge.refunded", PI, null, 2500);
            when(orderRepository.findByPaymentIntentIdForUpdate(PI)).thenReturn(Optional.of(sinCobrar));

            assertThatThrownBy(() -> service.handleWebhook("{}", "sig"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("antes del cobro");
            assertThat(sinCobrar.getAmountRefunded()).isEqualByComparingTo("0");
            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("charge.refunded con el mismo valor otra vez no suma de nuevo (reentrante)")
        void chargeRefundedReentrante() {
            Order o = pedido(OrderStatus.CONFIRMED, PaymentStatus.PARTIALLY_REFUNDED);
            o.setAmountRefunded(new BigDecimal("25.00"));
            eventoNuevo("evt_9", "charge.refunded", PI, null, 2500);
            when(orderRepository.findByPaymentIntentIdForUpdate(PI)).thenReturn(Optional.of(o));

            service.handleWebhook("{}", "sig");

            assertThat(o.getAmountRefunded()).isEqualByComparingTo("25.00");
        }

        @Test
        @DisplayName("tipos que no nos interesan se ignoran con 200")
        void otrosEventosSeIgnoran() {
            eventoNuevo("evt_10", "customer.created", null, null, 0);

            assertThatCode(() -> service.handleWebhook("{}", "sig")).doesNotThrowAnyException();
            verifyNoInteractions(orderRepository);
        }
    }

    // ── R4: reembolso ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("R4 · POST /admin/orders/{n}/refund")
    class Reembolso {

        private void pasarelaActiva(Order o) {
            when(payments.isEnabled()).thenReturn(true);
            when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(o));
        }

        @Test
        @DisplayName("sin importe → reembolsa TODO lo que queda, con idempotency key estable, y no cambia el estado")
        void reembolsoTotal() {
            Order o = pedido(OrderStatus.CONFIRMED, PaymentStatus.PAID);
            pasarelaActiva(o);
            AdminOrderDetailResponse detalle = mock(AdminOrderDetailResponse.class);
            when(adminOrderService.detalle(NUM)).thenReturn(detalle);
            when(stripeGateway.createRefund(eq(PI), eq(10000L), any(), eq("refund-ORD-PAY-1-0-10000")))
                    .thenReturn(new StripeGateway.GatewayRefund("re_1", 10000, "succeeded"));

            AdminOrderDetailResponse res = service.refund(NUM, new RefundRequest(null, "Defectuoso"));

            assertThat(res).isSameAs(detalle);
            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(o.getAmountRefunded()).isEqualByComparingTo("100.00");
            assertThat(o.getStatus()).isEqualTo(OrderStatus.CONFIRMED); // D9: el dinero no mueve el pedido
            verify(stripeGateway).createRefund(PI, 10000L, "Defectuoso", "refund-ORD-PAY-1-0-10000");
        }

        @Test
        @DisplayName("parcial y después el resto: acumula y la segunda clave incluye lo ya reembolsado")
        void parcialYLuegoResto() {
            Order o = pedido(OrderStatus.CONFIRMED, PaymentStatus.PAID);
            pasarelaActiva(o);
            when(stripeGateway.createRefund(anyString(), anyLong(), any(), anyString()))
                    .thenReturn(new StripeGateway.GatewayRefund("re_x", 0, "succeeded"));

            service.refund(NUM, new RefundRequest(new BigDecimal("30.00"), null));
            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
            assertThat(o.getAmountRefunded()).isEqualByComparingTo("30.00");
            verify(stripeGateway).createRefund(PI, 3000L, null, "refund-ORD-PAY-1-0-3000");

            service.refund(NUM, null);
            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(o.getAmountRefunded()).isEqualByComparingTo("100.00");
            verify(stripeGateway).createRefund(PI, 7000L, null, "refund-ORD-PAY-1-3000-7000");
        }

        @Test
        @DisplayName("importe mayor que lo que queda o ≤ 0 → 400 y Stripe no se llama")
        void importeFueraDeRango() {
            Order o = pedido(OrderStatus.CONFIRMED, PaymentStatus.PARTIALLY_REFUNDED);
            o.setAmountRefunded(new BigDecimal("40.00"));
            pasarelaActiva(o);

            assertThatThrownBy(() -> service.refund(NUM, new RefundRequest(new BigDecimal("60.01"), null)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("60.00");
            assertThatThrownBy(() -> service.refund(NUM, new RefundRequest(new BigDecimal("0.00"), null)))
                    .isInstanceOf(IllegalArgumentException.class);

            verifyNoInteractions(stripeGateway);
            assertThat(o.getAmountRefunded()).isEqualByComparingTo("40.00");
        }

        @Test
        @DisplayName("pedido sin cobrar (NONE, REQUIRES_PAYMENT, REFUNDED) → 409 PAYMENT_CONFLICT")
        void pedidoNoReembolsable() {
            for (PaymentStatus estado : new PaymentStatus[]{PaymentStatus.NONE, PaymentStatus.REQUIRES_PAYMENT,
                    PaymentStatus.REFUNDED}) {
                Order o = pedido(OrderStatus.CONFIRMED, estado);
                pasarelaActiva(o);
                assertThatThrownBy(() -> service.refund(NUM, null))
                        .as("%s", estado)
                        .isInstanceOf(PaymentConflictException.class);
            }
            verifyNoInteractions(stripeGateway);
        }

        @Test
        @DisplayName("si Stripe falla → 502 y el pedido queda exactamente igual")
        void stripeFallaSinCambios() {
            Order o = pedido(OrderStatus.CONFIRMED, PaymentStatus.PAID);
            pasarelaActiva(o);
            when(stripeGateway.createRefund(anyString(), anyLong(), any(), anyString()))
                    .thenThrow(new PaymentGatewayException("Stripe caído"));

            assertThatThrownBy(() -> service.refund(NUM, null)).isInstanceOf(PaymentGatewayException.class);

            assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(o.getAmountRefunded()).isEqualByComparingTo("0");
            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("modo sin pasarela o pedido inexistente")
        void sinPasarelaOInexistente() {
            when(payments.isEnabled()).thenReturn(false);
            assertThatThrownBy(() -> service.refund(NUM, null)).isInstanceOf(PaymentConflictException.class);

            when(payments.isEnabled()).thenReturn(true);
            when(orderRepository.findByOrderNumberForUpdate("NOPE")).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.refund("NOPE", null)).isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ── R6: expiración ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("R6 · job de expiración")
    class Expiracion {

        @Test
        @DisplayName("modo sin pasarela → no hace nada")
        void sinPasarela() {
            when(payments.isEnabled()).thenReturn(false);

            assertThat(service.expirarImpagados()).isZero();
            verifyNoInteractions(orderRepository, adminOrderService);
        }

        @Test
        @DisplayName("caduca lo vencido (corte = ahora − 30 min), anula el PaymentIntent y sigue si uno falla")
        void caducaYContinuaTrasUnFallo() {
            when(payments.isEnabled()).thenReturn(true);
            when(payments.getExpiryMinutes()).thenReturn(30L);
            when(orderRepository.findExpiredUnpaid(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT,
                    Instant.parse("2026-11-10T11:30:00Z"))).thenReturn(List.of("A", "B", "C"));
            when(adminOrderService.cancelarPorImpago("A"))
                    .thenReturn(Optional.of(new AdminOrderService.ImpagoCancelado("pi_a")));
            when(adminOrderService.cancelarPorImpago("B")).thenThrow(new IllegalStateException("BD caída"));
            when(adminOrderService.cancelarPorImpago("C"))
                    .thenReturn(Optional.of(new AdminOrderService.ImpagoCancelado(null)));

            int cancelados = service.expirarImpagados();

            assertThat(cancelados).isEqualTo(2);
            verify(stripeGateway).cancelPaymentIntent("pi_a");
            verifyNoMoreInteractions(stripeGateway); // C no tenía PaymentIntent
        }

        @Test
        @DisplayName("si el pedido se pagó entre tanto (cancelarPorImpago vacío) no se anula el PaymentIntent")
        void siSePagoNoSeAnula() {
            when(payments.isEnabled()).thenReturn(true);
            when(payments.getExpiryMinutes()).thenReturn(30L);
            when(orderRepository.findExpiredUnpaid(any(), any(), any())).thenReturn(List.of("A"));
            when(adminOrderService.cancelarPorImpago("A")).thenReturn(Optional.empty());

            assertThat(service.expirarImpagados()).isZero();
            verifyNoInteractions(stripeGateway);
        }

        @Test
        @DisplayName("un fallo anulando el PaymentIntent no deshace la cancelación")
        void falloAlAnularNoRompe() {
            when(payments.isEnabled()).thenReturn(true);
            when(payments.getExpiryMinutes()).thenReturn(30L);
            when(orderRepository.findExpiredUnpaid(any(), any(), any())).thenReturn(List.of("A"));
            when(adminOrderService.cancelarPorImpago("A"))
                    .thenReturn(Optional.of(new AdminOrderService.ImpagoCancelado("pi_a")));
            doThrow(new PaymentGatewayException("Stripe caído")).when(stripeGateway).cancelPaymentIntent("pi_a");

            assertThat(service.expirarImpagados()).isEqualTo(1);
        }
    }

    // ── pasos transaccionales del checkout ─────────────────────────────────

    @Test
    @DisplayName("paymentTarget copia solo escalares; attachPaymentIntent no pisa un id ya guardado")
    void pasosDelCheckout() {
        Order o = pedido(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT);
        o.setPaymentIntentId(null);
        when(orderRepository.findByOrderNumber(NUM)).thenReturn(Optional.of(o));
        when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(o));

        PaymentService.PaymentTarget t = service.paymentTarget(NUM);
        assertThat(t.total()).isEqualByComparingTo("100.00");
        assertThat(t.idempotencyKey()).isEqualTo("idem-1");
        assertThat(t.paymentIntentId()).isNull();

        service.attachPaymentIntent(NUM, "pi_primero");
        service.attachPaymentIntent(NUM, "pi_segundo");

        assertThat(o.getPaymentIntentId()).isEqualTo("pi_primero");
    }
}
