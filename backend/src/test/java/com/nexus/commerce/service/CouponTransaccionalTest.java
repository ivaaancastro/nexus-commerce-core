package com.nexus.commerce.service;

import com.nexus.commerce.entity.Coupon;
import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.CouponUsageLimitExceededException;
import com.nexus.commerce.repository.CouponRepository;
import com.nexus.commerce.repository.CouponUsageRepository;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * <strong>Canje, concurrencia y rollback medidos contra PostgreSQL real</strong>
 * (gates de la spec §3): patrón {@code WishlistTransaccionalTest} — los mocks
 * no pueden probar que {@code PESSIMISTIC_WRITE} serialize dos canjes ni que
 * el rollback de la transacción deshaga {@code usageCount}.
 *
 * <p>Datos desechables y propios: usuario {@code coupon-it@nexus.test} y
 * cupón {@code IT-COUPON-1} se borran en cada pasada — jamás se toca el
 * catálogo ni la semilla (el E2E depende de ella).</p>
 */
@SpringBootTest
@DisplayName("V5 cupones - canje, concurrencia y rollback contra PostgreSQL real")
class CouponTransaccionalTest {

    private static final String EMAIL = "coupon-it@nexus.test";
    private static final String CODIGO = "IT-COUPON-1";

    @Autowired
    private CouponService couponService;

    @Autowired
    private CouponRepository couponRepository;

    @Autowired
    private CouponUsageRepository couponUsageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private User usuario;

    @BeforeEach
    void preparar() {
        limpiar();
        usuario = userRepository.save(User.builder()
                .email(EMAIL)
                .passwordHash("$2a$12$placeholderplaceholderplaceholderplaceholderplac")
                .firstName("Coupon")
                .lastName("It")
                .birthDate(LocalDate.of(1990, 1, 1))
                .gender(Gender.OTHER)
                .emailVerified(true)
                .build());
    }

    @AfterEach
    void desmontar() {
        limpiar();
    }

    /** Borra usos (cascade del cupón/usuario) y la orden de prueba. */
    private void limpiar() {
        orderRepository.findByOrderNumber("ORD-COUPON-IT").ifPresent(orderRepository::delete);
        couponRepository.findByCode(CODIGO).ifPresent(couponRepository::delete);
        userRepository.findByEmail(EMAIL).ifPresent(userRepository::delete);
        couponRepository.flush();
        orderRepository.flush();
        userRepository.flush();
    }

    /** Cupón FIXED de 5,00 vigente hoy; cada test ajusta su límite si hace falta. */
    private Coupon crearCupon(int usageLimit) {
        return couponRepository.save(Coupon.builder()
                .code(CODIGO)
                .type(Coupon.DiscountType.FIXED)
                .value(new BigDecimal("5.00"))
                .minOrderAmount(BigDecimal.ZERO)
                .validFrom(OffsetDateTime.now(ZoneOffset.UTC).minusHours(1))
                .validUntil(OffsetDateTime.now(ZoneOffset.UTC).plusDays(1))
                .usageLimit(usageLimit)
                .usageCount(0)
                .perUserLimit(0)
                .active(true)
                .build());
    }

    private Order ordenDePrueba() {
        return orderRepository.save(Order.builder()
                .orderNumber("ORD-COUPON-IT")
                .idempotencyKey(UUID.randomUUID().toString())
                .marketCode("ES")
                .currency("EUR")
                .status(OrderStatus.CONFIRMED)
                .subtotalAmount(new BigDecimal("78.51"))
                .taxAmount(new BigDecimal("16.49"))
                .totalAmount(new BigDecimal("95.00"))
                .couponCode(CODIGO)
                .discountAmount(new BigDecimal("5.00"))
                .user(usuario)
                .build());
    }

    @Test
    @DisplayName("canje + registro de uso se persisten: usageCount=1 y fila en coupon_usages")
    void canjeYUsoSePersisten() {
        // GIVEN — un cupón ilimitado y una orden real (FK de coupon_usages)
        crearCupon(0);

        // WHEN — canje y registro DENTRO de una transacción, como el checkout
        Long ordenId = transactionTemplate.execute(estado -> {
            CouponService.CouponDiscountResult resultado = couponService.redeemCoupon(
                    CODIGO, new BigDecimal("100.00"), usuario.getId());
            Order orden = ordenDePrueba();
            couponService.recordCouponUsage(CODIGO, usuario.getId(), orden, resultado.discount());
            return orden.getId();
        });

        // THEN — el importe canjeado y el contador quedaron en BD
        assertThat(ordenId).isNotNull();
        Coupon recargado = couponRepository.findByCode(CODIGO).orElseThrow();
        assertThat(recargado.getUsageCount()).isEqualTo(1);

        var usos = couponUsageRepository.findByCouponIdOrderByUsedAtDesc(recargado.getId());
        assertThat(usos).hasSize(1);
        assertThat(usos.get(0).getDiscountAmount()).isEqualByComparingTo("5.00");
        // El id, no getOrderNumber(): el proxy lazy de la orden ya no tiene
        // sesión abierta (LazyInitializationException medido en la primera pasada)
        assertThat(usos.get(0).getOrder().getId()).isEqualTo(ordenId);
        assertThat(usos.get(0).getUser().getId()).isEqualTo(usuario.getId());
    }

    @Test
    @DisplayName("concurrencia: límite global 1 con 4 canjes simultáneos → sólo 1 pasa")
    void concurrenciaRespetaElLimiteGlobal() throws Exception {
        // GIVEN — cupón con usageLimit = 1
        crearCupon(1);

        final int HILOS = 4;
        ExecutorService executor = Executors.newFixedThreadPool(HILOS);
        CountDownLatch arranque = new CountDownLatch(1);
        AtomicInteger exitosos = new AtomicInteger();
        AtomicInteger rechazados = new AtomicInteger();
        AtomicInteger otros = new AtomicInteger();

        try {
            for (int i = 0; i < HILOS; i++) {
                executor.submit(() -> {
                    try {
                        arranque.await();
                        // Cada hilo en SU transacción: es lo que hace Spring
                        // al llamar desde fuera de un contexto transaccional.
                        transactionTemplate.executeWithoutResult(estado ->
                                couponService.redeemCoupon(
                                        CODIGO, new BigDecimal("100.00"), usuario.getId()));
                        exitosos.incrementAndGet();
                    } catch (CouponUsageLimitExceededException e) {
                        rechazados.incrementAndGet();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } catch (RuntimeException e) {
                        otros.incrementAndGet();
                    }
                });
            }
            // WHEN — los 4 intentan a la vez (la barrera minimiza la ventana)
            arranque.countDown();
            executor.shutdown();
            assertThat(executor.awaitTermination(30, TimeUnit.SECONDS)).isTrue();

            // THEN — PESSIMISTIC_WRITE serializa: sólo uno consume el cupón
            assertThat(otros.get())
                    .as("ningún hilo debe morir por otra excepción (deadlock, timeout…)")
                    .isZero();
            assertThat(exitosos.get()).isEqualTo(1);
            assertThat(rechazados.get()).isEqualTo(HILOS - 1);
            assertThat(couponRepository.findByCode(CODIGO).orElseThrow().getUsageCount())
                    .isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    @DisplayName("rollback de la transacción del checkout deshace el incremento de usageCount")
    void rollbackDeshaceElContador() {
        // GIVEN
        crearCupon(0);

        // WHEN — el canje se ejecuta en una transacción que revienta después
        // (el equivalente a que la creación de la orden falle a mitad de
        // `processCheckout`: misma transacción, mismo rollback)
        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(estado -> {
            couponService.redeemCoupon(CODIGO, new BigDecimal("100.00"), usuario.getId());
            assertThat(couponRepository.findByCode(CODIGO).orElseThrow().getUsageCount())
                    .isEqualTo(1); // dentro de la transacción, ya incrementado
            throw new IllegalStateException("rollback deliberado");
        })).isInstanceOf(IllegalStateException.class);

        // THEN — sin commit no hay incremento: ni contador ni fila de uso
        assertThat(couponRepository.findByCode(CODIGO).orElseThrow().getUsageCount())
                .isZero();
        Long cuponId = couponRepository.findByCode(CODIGO).orElseThrow().getId();
        assertThat(couponUsageRepository.findByCouponIdOrderByUsedAtDesc(cuponId)).isEmpty();
    }
}
