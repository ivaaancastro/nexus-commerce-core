package com.nexus.commerce.service;

import com.nexus.commerce.dto.CouponCreateRequest;
import com.nexus.commerce.dto.CouponUpdateRequest;
import com.nexus.commerce.dto.CouponValidateRequest;
import com.nexus.commerce.dto.CouponValidationResponse;
import com.nexus.commerce.entity.Coupon;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.*;
import com.nexus.commerce.repository.CouponRepository;
import com.nexus.commerce.repository.CouponUsageRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unitarios del servicio de cupones (spec V5, §3 backend).
 *
 * <p>Aquí sólo la lógica con mocks: los 6 motivos de inválidos del
 * {@code validateCoupon}, el cálculo del descuento (PERCENTAGE / FIXED con
 * tope y sobre el total GROSS en unidades mayores — §2.6A), el canje atómico
 * con bloqueo pesimista y el DELETE protegido por usos. La concurrencia
 * real contra PostgreSQL queda en los tests de integración.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("V5 cupones - servicio: validación, cálculo y canje atómico")
class CouponServiceTest {

    private static final String EMAIL = "ana@example.com";
    private static final Long USER_ID = 1L;
    private static final Long COUPON_ID = 10L;
    private static final OffsetDateTime AYER = OffsetDateTime.now().minusDays(1);
    private static final OffsetDateTime MANANA = OffsetDateTime.now().plusDays(1);

    @Mock
    private CouponRepository couponRepository;

    @Mock
    private CouponUsageRepository couponUsageRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CouponService service;

    private Coupon cuponPorcentaje(BigDecimal valor) {
        return Coupon.builder()
                .id(COUPON_ID)
                .code("SAVE10")
                .type(Coupon.DiscountType.PERCENTAGE)
                .value(valor)
                .minOrderAmount(BigDecimal.ZERO)
                .validFrom(AYER)
                .validUntil(MANANA)
                .usageLimit(0)
                .usageCount(0)
                .perUserLimit(0)
                .active(true)
                .build();
    }

    private Coupon cuponFijo(BigDecimal valor) {
        Coupon c = cuponPorcentaje(valor);
        c.setCode("BAJA5");
        c.setType(Coupon.DiscountType.FIXED);
        return c;
    }

    // ========== validateCoupon: los 6 motivos de inválidos (spec §3) ==========

    @Test
    @DisplayName("código inexistente → valid=false «Cupón no válido»")
    void validate_codigoInexistente() {
        when(couponRepository.findByCode("NADIE")).thenReturn(Optional.empty());

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("NADIE", new BigDecimal("89.95")), EMAIL);

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).isEqualTo("Cupón no válido");
        assertThat(res.discountAmount()).isZero();
        assertThat(res.coupon()).isNull();
    }

    @Test
    @DisplayName("cupón inactivo → valid=false «no está disponible»")
    void validate_inactivo() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setActive(false);
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(c));

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("save10", new BigDecimal("89.95")), EMAIL);

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).isEqualTo("Este cupón no está disponible");
    }

    @Test
    @DisplayName("validFrom en el futuro → valid=false «aún no es válido»")
    void validate_aunNoValido() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setValidFrom(OffsetDateTime.now().plusDays(2));
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(c));

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("SAVE10", new BigDecimal("89.95")), EMAIL);

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).isEqualTo("El cupón aún no es válido");
    }

    @Test
    @DisplayName("validUntil pasado → valid=false «ha expirado»")
    void validate_expirado() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setValidUntil(OffsetDateTime.now().minusHours(1));
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(c));

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("SAVE10", new BigDecimal("89.95")), EMAIL);

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).isEqualTo("El cupón ha expirado");
    }

    @Test
    @DisplayName("límite global alcanzado → valid=false «límite de usos»")
    void validate_limiteGlobal() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setUsageLimit(5);
        c.setUsageCount(5);
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(c));

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("SAVE10", new BigDecimal("89.95")), EMAIL);

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).isEqualTo("Se ha alcanzado el límite de usos de este cupón");
    }

    @Test
    @DisplayName("límite por usuario alcanzado → valid=false «máximo de veces»")
    void validate_limitePorUsuario() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setPerUserLimit(1);
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(c));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(
                User.builder().id(USER_ID).email(EMAIL).build()));
        when(couponRepository.countUsagesByUser(COUPON_ID, USER_ID)).thenReturn(1L);

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("SAVE10", new BigDecimal("89.95")), EMAIL);

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).isEqualTo("Ya has usado este cupón el máximo de veces permitido");
    }

    @Test
    @DisplayName("subtotal bajo el mínimo → valid=false «importe mínimo»")
    void validate_minimoNoAlcanzado() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setMinOrderAmount(new BigDecimal("50.00"));
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(c));

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("SAVE10", new BigDecimal("49.99")), EMAIL);

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).isEqualTo("El pedido no alcanza el importe mínimo para este cupón");
    }

    // ========== Cálculo del descuento (spec §2.6A: GROSS, mayores) ==========

    @Test
    @DisplayName("PERCENTAGE 10 % sobre 89,95 → 9,00 (HALF_UP, 2 decimales)")
    void validate_calculoPorcentaje() {
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(cuponPorcentaje(BigDecimal.TEN)));

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("SAVE10", new BigDecimal("89.95")), EMAIL);

        assertThat(res.valid()).isTrue();
        assertThat(res.message()).isEqualTo("Cupón aplicado");
        assertThat(res.discountAmount()).isEqualByComparingTo("9.00");
        assertThat(res.coupon().code()).isEqualTo("SAVE10");
    }

    @Test
    @DisplayName("FIXED 5 sobre 89,95 → 5,00; FIXED nunca supera el subtotal")
    void validate_calculoFijo() {
        when(couponRepository.findByCode("BAJA5")).thenReturn(Optional.of(cuponFijo(new BigDecimal("5.00"))));

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("BAJA5", new BigDecimal("89.95")), EMAIL);

        assertThat(res.valid()).isTrue();
        assertThat(res.discountAmount()).isEqualByComparingTo("5.00");

        // FIXED mayor que el subtotal → se acota al subtotal (nunca gratis)
        Coupon caro = cuponFijo(new BigDecimal("100.00"));
        when(couponRepository.findByCode("BAJA5")).thenReturn(Optional.of(caro));
        CouponValidationResponse resCaro = service.validateCoupon(
                new CouponValidateRequest("BAJA5", new BigDecimal("89.95")), EMAIL);

        assertThat(resCaro.discountAmount()).isEqualByComparingTo("89.95");
    }

    @Test
    @DisplayName("maxDiscountAmount tope el porcentaje (30 % de 100 con tope 20 → 20)")
    void validate_topeMaxDiscount() {
        Coupon c = cuponPorcentaje(new BigDecimal("30"));
        c.setMaxDiscountAmount(new BigDecimal("20.00"));
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(c));

        CouponValidationResponse res = service.validateCoupon(
                new CouponValidateRequest("SAVE10", new BigDecimal("100.00")), EMAIL);

        assertThat(res.discountAmount()).isEqualByComparingTo("20.00");
    }

    // ========== redeemCoupon: canje atómico (spec §2.3) ==========

    @Test
    @DisplayName("canje válido bloquea el cupón (findByCodeForUpdate) e incrementa usageCount")
    void redeem_incrementaContadorConBloqueo() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        when(couponRepository.findByCodeForUpdate("SAVE10")).thenReturn(Optional.of(c));
        when(couponRepository.save(any(Coupon.class))).thenAnswer(inv -> inv.getArgument(0));

        CouponService.CouponDiscountResult result =
                service.redeemCoupon("save10", new BigDecimal("89.95"), USER_ID);

        // Bloqueo pesimista: la consulta de canje NUNCA es findByCode simple
        verify(couponRepository).findByCodeForUpdate("SAVE10");
        assertThat(result.coupon().getUsageCount()).isEqualTo(1);
        assertThat(result.discount()).isEqualByComparingTo("9.00");
        verify(couponRepository).save(c);
    }

    @Test
    @DisplayName("canje de cupón inactivo lanza CouponInactiveException")
    void redeem_inactivo() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setActive(false);
        when(couponRepository.findByCodeForUpdate("SAVE10")).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.redeemCoupon("SAVE10", new BigDecimal("89.95"), USER_ID))
                .isInstanceOf(CouponInactiveException.class);
        verify(couponRepository, never()).save(any());
    }

    @Test
    @DisplayName("canje con límite global lanza CouponUsageLimitExceededException")
    void redeem_limiteGlobal() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setUsageLimit(2);
        c.setUsageCount(2);
        when(couponRepository.findByCodeForUpdate("SAVE10")).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.redeemCoupon("SAVE10", new BigDecimal("89.95"), USER_ID))
                .isInstanceOf(CouponUsageLimitExceededException.class);
    }

    @Test
    @DisplayName("canje con límite por usuario lanza CouponPerUserLimitExceededException")
    void redeem_limitePorUsuario() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setPerUserLimit(1);
        when(couponRepository.findByCodeForUpdate("SAVE10")).thenReturn(Optional.of(c));
        when(couponRepository.countUsagesByUser(COUPON_ID, USER_ID)).thenReturn(1L);

        assertThatThrownBy(() -> service.redeemCoupon("SAVE10", new BigDecimal("89.95"), USER_ID))
                .isInstanceOf(CouponPerUserLimitExceededException.class);
    }

    @Test
    @DisplayName("canje bajo el mínimo lanza CouponMinOrderNotMetException")
    void redeem_minimoNoAlcanzado() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setMinOrderAmount(new BigDecimal("50.00"));
        when(couponRepository.findByCodeForUpdate("SAVE10")).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.redeemCoupon("SAVE10", new BigDecimal("49.99"), USER_ID))
                .isInstanceOf(CouponMinOrderNotMetException.class);
    }

    @Test
    @DisplayName("canje de cupón inexistente lanza CouponNotFoundException")
    void redeem_inexistente() {
        when(couponRepository.findByCodeForUpdate("NADIE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.redeemCoupon("NADIE", new BigDecimal("89.95"), USER_ID))
                .isInstanceOf(CouponNotFoundException.class);
    }

    // ========== recordCouponUsage (misma transacción que la orden) ==========

    @Test
    @DisplayName("recordCouponUsage guarda la fila con cupón, usuario, orden e importe")
    void record_usage() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        User user = User.builder().id(USER_ID).email(EMAIL).build();
        Order order = Order.builder().id(99L).orderNumber("ORD-TEST").build();
        when(couponRepository.findByCode("SAVE10")).thenReturn(Optional.of(c));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.recordCouponUsage("save10", USER_ID, order, new BigDecimal("9.00"));

        verify(couponUsageRepository).save(any());
    }

    // ========== CRUD admin (spec §2.2) ==========

    @Test
    @DisplayName("crear cupón con código duplicado lanza CouponCodeExistsException (409)")
    void create_codigoDuplicado() {
        when(couponRepository.existsByCode("SAVE10")).thenReturn(true);

        CouponCreateRequest req = new CouponCreateRequest(
                "SAVE10", Coupon.DiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, MANANA, MANANA.plusDays(30), null, null);

        assertThatThrownBy(() -> service.createCoupon(req))
                .isInstanceOf(CouponCodeExistsException.class);
        verify(couponRepository, never()).save(any());
    }

    @Test
    @DisplayName("createCoupon sin límites nace con usageCount=0 y activo (guards Integer→int)")
    void create_sinLimites() {
        when(couponRepository.existsByCode("NUEVO")).thenReturn(false);
        when(couponRepository.save(any(Coupon.class))).thenAnswer(inv -> {
            Coupon saved = inv.getArgument(0);
            saved.setId(COUPON_ID);
            return saved;
        });

        CouponCreateRequest req = new CouponCreateRequest(
                "NUEVO", Coupon.DiscountType.FIXED, new BigDecimal("5.00"),
                new BigDecimal("50.00"), null, MANANA, MANANA.plusDays(30), null, null);

        var res = service.createCoupon(req);

        assertThat(res.usageCount()).isZero();
        assertThat(res.active()).isTrue();
        assertThat(res.usageLimit()).isZero(); // Integer null → int 0
        assertThat(res.perUserLimit()).isZero();
        assertThat(res.minOrderAmount()).isEqualByComparingTo("50.00");
    }

    @Test
    @DisplayName("DELETE con usageCount > 0 lanza CouponHasUsagesException (409)")
    void delete_conUsos() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        c.setUsageCount(3);
        when(couponRepository.findById(COUPON_ID)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.deleteCoupon(COUPON_ID))
                .isInstanceOf(CouponHasUsagesException.class);
        verify(couponRepository, never()).delete(any(Coupon.class));
    }

    @Test
    @DisplayName("DELETE sin usos borra el cupón")
    void delete_sinUsos() {
        Coupon c = cuponPorcentaje(BigDecimal.TEN);
        when(couponRepository.findById(COUPON_ID)).thenReturn(Optional.of(c));

        service.deleteCoupon(COUPON_ID);

        verify(couponRepository).delete(c);
    }

    @Test
    @DisplayName("DELETE de un cupón inexistente lanza CouponNotFoundException (404)")
    void delete_inexistente() {
        when(couponRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteCoupon(99L))
                .isInstanceOf(CouponNotFoundException.class);
    }

    @Test
    @DisplayName("updateCoupon de un cupón inexistente lanza CouponNotFoundException")
    void update_inexistente() {
        when(couponRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateCoupon(99L, new CouponUpdateRequest(
                null, null, null, null, null, null, null, null, null)))
                .isInstanceOf(CouponNotFoundException.class);
    }
}
