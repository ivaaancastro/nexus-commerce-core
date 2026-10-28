package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.nexus.commerce.dto.AdminCouponDetailResponse;
import com.nexus.commerce.dto.AdminCouponPageResponse;
import com.nexus.commerce.dto.CouponSummaryResponse;
import com.nexus.commerce.dto.CouponValidationResponse;
import com.nexus.commerce.entity.Coupon;
import com.nexus.commerce.exception.CouponCodeExistsException;
import com.nexus.commerce.exception.CouponHasUsagesException;
import com.nexus.commerce.exception.CouponNotFoundException;
import com.nexus.commerce.exception.GlobalExceptionHandler;
import com.nexus.commerce.service.CouponService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests del controller de cupones en modo standalone (patrón
 * {@code WishlistControllerTest}): Security no está presente, el principal lo
 * pone el test igual que lo haría el filtro JWT, y la puerta de 401 de
 * {@code /api/v1/coupons/**} y {@code /api/v1/admin/coupons/**} vive en
 * {@code SecurityRulesTest}.
 *
 * <p>Cubre la spec §3: validate devuelve los 6 inválidos con su mensaje, el
 * CRUD admin con sus códigos (201/204/404/409) y la validación jakarta del
 * body de creación.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("V5 cupones - controller: validate del cliente y CRUD admin")
class CouponControllerTest {

    private static final String EMAIL = "ana@example.com";
    private static final String VALIDATE = "/api/v1/coupons/validate";
    private static final String ADMIN = "/api/v1/admin/coupons";
    private static final OffsetDateTime MANANA = OffsetDateTime.now().plusDays(1);

    @Mock
    private CouponService couponService;

    @InjectMocks
    private CouponController couponController;

    @InjectMocks
    private AdminCouponController adminController;

    private MockMvc mockMvc;

    @BeforeEach
    void configurar() throws Exception {
        LocalValidatorFactoryBean validador = new LocalValidatorFactoryBean();
        validador.afterPropertiesSet();
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        mockMvc = MockMvcBuilders.standaloneSetup(couponController, adminController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validador)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .build();
    }

    private CouponSummaryResponse resumen(String code) {
        return new CouponSummaryResponse(
                10L, code, Coupon.DiscountType.PERCENTAGE, new BigDecimal("10.00"),
                BigDecimal.ZERO, null, OffsetDateTime.now().minusDays(1), MANANA,
                0, 0, 0, true, OffsetDateTime.now());
    }

    // ========== POST /api/v1/coupons/validate ==========

    @Test
    @DisplayName("validate con cupón válido → 200 con descuento y email de la sesión")
    void validate_valido() throws Exception {
        when(couponService.validateCoupon(any(), eq(EMAIL)))
                .thenReturn(new CouponValidationResponse(
                        true, "Cupón aplicado", new BigDecimal("9.00"), resumen("SAVE10")));

        mockMvc.perform(post(VALIDATE)
                        .principal(new UsernamePasswordAuthenticationToken(EMAIL, null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"SAVE10\",\"subtotal\":89.95}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.message").value("Cupón aplicado"))
                .andExpect(jsonPath("$.discountAmount").value(9.00))
                .andExpect(jsonPath("$.coupon.code").value("SAVE10"));
    }

    @Test
    @DisplayName("validate devuelve el mensaje del servidor cuando no aplica (§3)")
    void validate_invalido() throws Exception {
        when(couponService.validateCoupon(any(), eq(EMAIL)))
                .thenReturn(new CouponValidationResponse(
                        false, "El cupón ha expirado", BigDecimal.ZERO, null));

        mockMvc.perform(post(VALIDATE)
                        .principal(new UsernamePasswordAuthenticationToken(EMAIL, null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"VIEJO\",\"subtotal\":89.95}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.message").value("El cupón ha expirado"))
                .andExpect(jsonPath("$.coupon").doesNotExist());
    }

    @Test
    @DisplayName("validate sin código → 400 (jakarta @NotBlank)")
    void validate_sinCodigo() throws Exception {
        mockMvc.perform(post(VALIDATE)
                        .principal(new UsernamePasswordAuthenticationToken(EMAIL, null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"\",\"subtotal\":89.95}"))
                .andExpect(status().isBadRequest());

        verify(couponService, never()).validateCoupon(any(), any());
    }

    @Test
    @DisplayName("validate con subtotal negativo → 400 (@DecimalMin)")
    void validate_subtotalNegativo() throws Exception {
        mockMvc.perform(post(VALIDATE)
                        .principal(new UsernamePasswordAuthenticationToken(EMAIL, null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"SAVE10\",\"subtotal\":-1}"))
                .andExpect(status().isBadRequest());

        verify(couponService, never()).validateCoupon(any(), any());
    }

    // ========== CRUD admin ==========

    @Test
    @DisplayName("GET /admin/coupons lista paginado con los filtros pasados al servicio")
    void list_filtros() throws Exception {
        when(couponService.getAdminCoupons(0, 20, "SAVE", Coupon.DiscountType.PERCENTAGE, true, null, null))
                .thenReturn(new AdminCouponPageResponse(
                        List.of(resumen("SAVE10")), 0, 20, 1, 1));

        mockMvc.perform(get(ADMIN)
                        .param("code", "SAVE")
                        .param("type", "PERCENTAGE")
                        .param("active", "true")
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coupons[0].code").value("SAVE10"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("POST /admin/coupons crea y devuelve 201")
    void create_201() throws Exception {
        when(couponService.createCoupon(any())).thenReturn(new AdminCouponDetailResponse(
                10L, "NUEVO10", Coupon.DiscountType.PERCENTAGE, new BigDecimal("10.00"),
                BigDecimal.ZERO, null, OffsetDateTime.now().minusDays(1), MANANA,
                0, 0, 0, true, OffsetDateTime.now(), OffsetDateTime.now(), List.of()));

        // validFrom con margen: @FutureOrPresent evalúa ya serializado, y un
        // `now()` puro queda milisegundos en el pasado → 400 espurio.
        mockMvc.perform(post(ADMIN)
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"NUEVO10","type":"PERCENTAGE","value":10.00,
                                 "validFrom":"%s","validUntil":"%s"}
                                """.formatted(OffsetDateTime.now().plusMinutes(5), MANANA)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("NUEVO10"));
    }

    @Test
    @DisplayName("POST /admin/coupons con código mal formado → 400 (patrón @Pattern)")
    void create_codigoInvalido() throws Exception {
        mockMvc.perform(post(ADMIN)
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"con espacios","type":"PERCENTAGE","value":10.00,
                                 "validFrom":"%s","validUntil":"%s"}
                                """.formatted(OffsetDateTime.now().plusMinutes(5), MANANA)))
                .andExpect(status().isBadRequest());

        verify(couponService, never()).createCoupon(any());
    }

    @Test
    @DisplayName("POST /admin/coupons con código duplicado → 409")
    void create_duplicado() throws Exception {
        when(couponService.createCoupon(any()))
                .thenThrow(new CouponCodeExistsException("Este código ya existe"));

        mockMvc.perform(post(ADMIN)
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"SAVE10","type":"PERCENTAGE","value":10.00,
                                 "validFrom":"%s","validUntil":"%s"}
                                """.formatted(OffsetDateTime.now().plusMinutes(5), MANANA)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("GET /admin/coupons/{id} inexistente → 404")
    void get_inexistente() throws Exception {
        when(couponService.getAdminCoupon(99L))
                .thenThrow(new CouponNotFoundException("Cupón no encontrado: 99"));

        mockMvc.perform(get(ADMIN + "/99")
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PUT /admin/coupons/{id} actualiza sin enviar el código (el immutable viaja en la URL)")
    void update_sinCodigo() throws Exception {
        when(couponService.updateCoupon(eq(10L), any())).thenReturn(new AdminCouponDetailResponse(
                10L, "SAVE10", Coupon.DiscountType.PERCENTAGE, new BigDecimal("15.00"),
                BigDecimal.ZERO, null, OffsetDateTime.now().minusDays(1), MANANA,
                0, 0, 0, true, OffsetDateTime.now(), OffsetDateTime.now(), List.of()));

        mockMvc.perform(put(ADMIN + "/10")
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":15.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value(15.00))
                .andExpect(jsonPath("$.code").value("SAVE10"));
    }

    @Test
    @DisplayName("PUT /admin/coupons/{id} acepta la ventana histórica (un cupón vigente se puede re-guardar sin mover fechas)")
    void update_aceptaFechasPasadas() throws Exception {
        // Regresión medida en navegador 2026-10-28: el @FutureOrPresent del
        // update rechazaba con 400 cualquier PUT que reenviara el validFrom
        // original de un cupón ya creado, haciendo imposible editarlo.
        when(couponService.updateCoupon(eq(10L), any())).thenReturn(new AdminCouponDetailResponse(
                10L, "SAVE10", Coupon.DiscountType.PERCENTAGE, new BigDecimal("15.00"),
                BigDecimal.ZERO, null, OffsetDateTime.now().minusDays(10), MANANA,
                0, 0, 0, true, OffsetDateTime.now(), OffsetDateTime.now(), List.of()));

        mockMvc.perform(put(ADMIN + "/10")
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":15.00,"
                                + "\"validFrom\":\"2026-01-01T00:00:00Z\","
                                + "\"validUntil\":\"2026-06-01T00:00:00Z\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value(15.00));
    }

    @Test
    @DisplayName("DELETE /admin/coupons/{id} sin usos → 204")
    void delete_204() throws Exception {
        doNothing().when(couponService).deleteCoupon(10L);

        mockMvc.perform(delete(ADMIN + "/10")
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /admin/coupons/{id} ya usado → 409 (spec §2.2)")
    void delete_conUsos() throws Exception {
        doThrow(new CouponHasUsagesException("No se puede borrar un cupón que ya se ha usado; desactívalo"))
                .when(couponService).deleteCoupon(10L);

        mockMvc.perform(delete(ADMIN + "/10")
                        .principal(new UsernamePasswordAuthenticationToken("admin@example.com", null)))
                .andExpect(status().isConflict());
    }
}
