package com.nexus.commerce.service;

import com.nexus.commerce.config.PaymentsProperties;
import com.nexus.commerce.dto.RefundRequest;
import com.nexus.commerce.entity.Coupon;
import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.PaymentStatus;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.CouponUsageLimitExceededException;
import com.nexus.commerce.repository.CouponRepository;
import com.nexus.commerce.repository.CouponUsageRepository;
import com.nexus.commerce.repository.EmailOutboxRepository;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.StripeEventRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Fase 9 — lo que los mocks no pueden demostrar, <strong>medido contra PostgreSQL
 * real</strong>: la PK de {@code stripe_events} bajo entrega concurrente del mismo
 * evento, el bloqueo de la fila del pedido ante dos reembolsos simultáneos y la
 * devolución del cupón (con {@code usageLimit = 1} vuelve a ser canjeable).
 *
 * <p>Sólo Stripe está simulado ({@code @MockitoBean StripeGateway}); la pasarela
 * se «activa» con un {@code PaymentsProperties} simulado. Datos propios y
 * desechables: usuario {@code pay-it@nexus.test}, pedido {@code ORD-PAY-IT},
 * cupón {@code IT-PAY-1}.</p>
 */
@SpringBootTest(properties = "app.payments.expiry-poll-ms=3600000")
@DisplayName("Fase 9 - webhook idempotente, reembolsos concurrentes y cupón devuelto, contra PostgreSQL real")
class PaymentTransaccionalTest {

    private static final String EMAIL = "pay-it@nexus.test";
    private static final String NUM = "ORD-PAY-IT";
    private static final String PI = "pi_it_1";
    private static final String CODIGO = "IT-PAY-1";

    @MockitoBean private StripeGateway stripeGateway;
    @MockitoBean private PaymentsProperties payments;

    @Autowired private PaymentService paymentService;
    @Autowired private CouponService couponService;
    @Autowired private OrderRepository orderRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StripeEventRepository stripeEventRepository;
    @Autowired private CouponRepository couponRepository;
    @Autowired private CouponUsageRepository couponUsageRepository;
    @Autowired private EmailOutboxRepository emailOutboxRepository;
    @Autowired private TransactionTemplate transactionTemplate;

    private User usuario;

    @BeforeEach
    void preparar() {
        limpiar();
        when(payments.isEnabled()).thenReturn(true);
        when(payments.getExpiryMinutes()).thenReturn(30L);
        usuario = userRepository.save(User.builder()
                .email(EMAIL)
                .passwordHash("$2a$12$placeholderplaceholderplaceholderplaceholderplac")
                .firstName("Pay").lastName("It")
                .birthDate(LocalDate.of(1990, 1, 1))
                .gender(Gender.OTHER)
                .emailVerified(true)
                .build());
    }

    @AfterEach
    void desmontar() {
        limpiar();
    }

    private void limpiar() {
        orderRepository.findByOrderNumber(NUM).ifPresent(orderRepository::delete);
        orderRepository.findAll().stream()
                .filter(o -> o.getOrderNumber().startsWith("ORD-PAY-REV-"))
                .forEach(orderRepository::delete);
        couponRepository.findByCode(CODIGO).ifPresent(couponRepository::delete);
        userRepository.findByEmail(EMAIL).ifPresent(userRepository::delete);
        emailOutboxRepository.findAll().stream()
                .filter(e -> EMAIL.equals(e.getRecipient()))
                .forEach(emailOutboxRepository::delete);
        stripeEventRepository.findAll().stream()
                .filter(e -> e.getEventId().startsWith("evt_it_"))
                .forEach(stripeEventRepository::delete);
        orderRepository.flush();
        userRepository.flush();
    }

    private Order pedido(OrderStatus estado, PaymentStatus pago) {
        return orderRepository.save(Order.builder()
                .orderNumber(NUM)
                .idempotencyKey(UUID.randomUUID().toString())
                .marketCode("ES").currency("EUR")
                .status(estado).paymentStatus(pago).paymentIntentId(PI)
                .subtotalAmount(new BigDecimal("82.64"))
                .taxAmount(new BigDecimal("17.36"))
                .totalAmount(new BigDecimal("100.00"))
                .user(usuario)
                .build());
    }

    /** Lanza {@code hilos} tareas a la vez (puerta común) y devuelve sus resultados. */
    private <T> List<Object> enParalelo(int hilos, Callable<T> tarea) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(hilos);
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Object>> futuros = new ArrayList<>();
        for (int i = 0; i < hilos; i++) {
            futuros.add(pool.submit(() -> {
                salida.await();
                try {
                    return tarea.call();
                } catch (Exception e) {
                    return e;
                }
            }));
        }
        salida.countDown();
        List<Object> resultados = new ArrayList<>();
        for (Future<Object> f : futuros) {
            resultados.add(f.get(30, TimeUnit.SECONDS));
        }
        pool.shutdown();
        return resultados;
    }

    @Test
    @DisplayName("la PK de stripe_events decide: de N inserciones simultáneas del mismo evento, exactamente UNA gana")
    void laPkDecideEntreInsercionesConcurrentes() throws Exception {
        List<Object> resultados = enParalelo(8, () -> transactionTemplate.execute(
                estado -> stripeEventRepository.insertIfAbsent("evt_it_dup", "payment_intent.succeeded")));

        assertThat(resultados.stream().filter(r -> Integer.valueOf(1).equals(r)).count()).isEqualTo(1);
        assertThat(resultados.stream().filter(r -> Integer.valueOf(0).equals(r)).count()).isEqualTo(7);
    }

    @Test
    @DisplayName("el mismo payment_intent.succeeded entregado 6 veces a la vez confirma UNA vez y registra UN evento")
    void entregaDuplicadaSimultaneaConfirmaUnaVez() throws Exception {
        pedido(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT);
        when(stripeGateway.verifyWebhook(anyString(), anyString())).thenReturn(
                new StripeGateway.WebhookEvent("evt_it_ok", "payment_intent.succeeded", PI, NUM, 0));

        List<Object> resultados = enParalelo(6, () -> {
            paymentService.handleWebhook("{}", "sig");
            return "ok";
        });

        // ninguna entrega explota (las repetidas son 200 sin efecto)
        assertThat(resultados).allMatch("ok"::equals);
        Order o = orderRepository.findByOrderNumber(NUM).orElseThrow();
        assertThat(o.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(stripeEventRepository.findAll().stream()
                .filter(e -> "evt_it_ok".equals(e.getEventId())).count()).isEqualTo(1);
        // y el email de «recibido» se encoló una sola vez
        assertThat(emailOutboxRepository.findAll().stream()
                .filter(e -> EMAIL.equals(e.getRecipient())).count()).isEqualTo(1);
    }

    @Test
    @DisplayName("dos reembolsos totales simultáneos: el bloqueo de la fila deja pasar UNO y Stripe se llama una vez")
    void dosReembolsosSimultaneosSoloUnoPasa() throws Exception {
        pedido(OrderStatus.CONFIRMED, PaymentStatus.PAID);
        when(stripeGateway.createRefund(anyString(), anyLong(), any(), anyString()))
                .thenReturn(new StripeGateway.GatewayRefund("re_1", 10000, "succeeded"));

        List<Object> resultados = enParalelo(2, () -> paymentService.refund(NUM, new RefundRequest(null, null)));

        long exitos = resultados.stream().filter(r -> !(r instanceof Exception)).count();
        long rechazos = resultados.stream().filter(r -> r instanceof Exception).count();
        assertThat(exitos).isEqualTo(1);
        assertThat(rechazos).isEqualTo(1);
        verify(stripeGateway, times(1)).createRefund(anyString(), anyLong(), any(), anyString());
        Order o = orderRepository.findByOrderNumber(NUM).orElseThrow();
        assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        assertThat(o.getAmountRefunded()).isEqualByComparingTo("100.00");
    }

    @Test
    @DisplayName("D17: un cupón de 1 solo uso vuelve a ser canjeable tras devolver el uso (y el contador no baja de 0)")
    void elCuponVuelveASerCanjeable() {
        couponRepository.save(Coupon.builder()
                .code(CODIGO).type(Coupon.DiscountType.FIXED).value(new BigDecimal("5.00"))
                .minOrderAmount(BigDecimal.ZERO)
                .validFrom(OffsetDateTime.now(ZoneOffset.UTC).minusHours(1))
                .validUntil(OffsetDateTime.now(ZoneOffset.UTC).plusDays(1))
                .usageLimit(1).usageCount(0).perUserLimit(0).active(true).build());
        Order o = pedido(OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT);
        o.setCouponCode(CODIGO);
        o.setDiscountAmount(new BigDecimal("5.00"));
        Order guardado = orderRepository.save(o);

        // canje + uso, en una transacción, como el checkout
        transactionTemplate.executeWithoutResult(estado -> {
            couponService.redeemCoupon(CODIGO, new BigDecimal("100.00"), usuario.getId());
            couponService.recordCouponUsage(CODIGO, usuario.getId(), guardado, new BigDecimal("5.00"));
        });
        assertThat(couponRepository.findByCode(CODIGO).orElseThrow().getUsageCount()).isEqualTo(1);
        org.junit.jupiter.api.Assertions.assertThrows(CouponUsageLimitExceededException.class, () ->
                transactionTemplate.executeWithoutResult(estado ->
                        couponService.redeemCoupon(CODIGO, new BigDecimal("100.00"), usuario.getId())));

        // se cancela: el uso vuelve (y llamarlo otra vez no resta de más)
        transactionTemplate.executeWithoutResult(estado -> couponService.releaseUsage(guardado));
        transactionTemplate.executeWithoutResult(estado -> couponService.releaseUsage(guardado));

        assertThat(couponRepository.findByCode(CODIGO).orElseThrow().getUsageCount()).isZero();
        assertThat(couponUsageRepository.findByCouponIdOrderByUsedAtDesc(
                couponRepository.findByCode(CODIGO).orElseThrow().getId())).isEmpty();
        // y vuelve a poder canjearse
        transactionTemplate.executeWithoutResult(estado ->
                couponService.redeemCoupon(CODIGO, new BigDecimal("100.00"), usuario.getId()));
        assertThat(couponRepository.findByCode(CODIGO).orElseThrow().getUsageCount()).isEqualTo(1);
        // el pedido conserva su histórico de cupón
        assertThat(orderRepository.findByOrderNumber(NUM).orElseThrow().getCouponCode()).isEqualTo(CODIGO);
    }

    @Test
    @DisplayName("Dashboard 7.6 + Fase 9: los ingresos son dinero que se queda — sin pedidos sin pagar, sin reembolsados del todo y netos de reembolsos parciales")
    void losIngresosDelDashboardDescuentanImpagadosYReembolsos() {
        // Moneda propia («ZZZ») para no mezclarse con los pedidos del resto de la BD
        crearPedidoDeIngresos("A", OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT, "100.00", "0.00");   // sin pagar → fuera
        crearPedidoDeIngresos("B", OrderStatus.CONFIRMED, PaymentStatus.PAID, "100.00", "0.00");            // 100
        crearPedidoDeIngresos("C", OrderStatus.CONFIRMED, PaymentStatus.PARTIALLY_REFUNDED, "100.00", "30.00"); // 70
        crearPedidoDeIngresos("D", OrderStatus.CONFIRMED, PaymentStatus.REFUNDED, "100.00", "100.00");       // fuera
        crearPedidoDeIngresos("E", OrderStatus.CONFIRMED, PaymentStatus.NONE, "50.00", "0.00");              // 50 (histórico)
        crearPedidoDeIngresos("F", OrderStatus.CANCELLED, PaymentStatus.NONE, "40.00", "0.00");              // cancelado → fuera

        List<Object[]> filas = orderRepository.contarIngresosPorMonedaDesde(
                java.time.Instant.now().minus(java.time.Duration.ofDays(1)), OrderStatus.CANCELLED);

        Object[] zzz = filas.stream().filter(f -> "ZZZ".equals(f[0])).findFirst().orElseThrow();
        assertThat((BigDecimal) zzz[1]).isEqualByComparingTo("220.00"); // 100 + 70 + 50
        assertThat((Long) zzz[2]).isEqualTo(3L);                        // B, C y E
    }

    private void crearPedidoDeIngresos(String sufijo, OrderStatus estado, PaymentStatus pago,
                                       String total, String reembolsado) {
        orderRepository.save(Order.builder()
                .orderNumber("ORD-PAY-REV-" + sufijo)
                .idempotencyKey(UUID.randomUUID().toString())
                .marketCode("ES").currency("ZZZ")
                .status(estado).paymentStatus(pago)
                .subtotalAmount(new BigDecimal(total)).taxAmount(BigDecimal.ZERO)
                .totalAmount(new BigDecimal(total))
                .amountRefunded(new BigDecimal(reembolsado))
                .user(usuario)
                .build());
    }
}
