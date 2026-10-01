package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.service.AddressService;
import com.nexus.commerce.service.SizeRecommendationService;
import com.nexus.commerce.service.UserService;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests del controller en modo standalone (sin contexto de seguridad completo).
 *
 * Spring Security no está presente, así que inyectamos el usuario autenticado
 * directamente sobre la petición mock mediante {@code setUserPrincipal}: es lo
 * mismo que hace el filtro de seguridad en producción.
 */
@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    private static final String EMAIL = "ana@example.com";

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private UserService userService;

    @Mock
    private AddressService addressService;

    @Mock
    private SizeRecommendationService sizeRecommendationService;

    @InjectMocks
    private UserController userController;

    @BeforeEach
    void setUp() {
        // Jackson necesita JavaTimeModule para serializar LocalDate en el body.
        ObjectMapper mvcMapper = new ObjectMapper().registerModule(new JavaTimeModule());

        mockMvc = MockMvcBuilders.standaloneSetup(userController)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mvcMapper))
                .build();
    }

    /** Simula el principal que Spring Security dejaría en la petición. */
    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return builder.with(request -> {
            request.setUserPrincipal(
                    new UsernamePasswordAuthenticationToken(EMAIL, null, List.of()));
            return request;
        });
    }

    private UserResponse sampleProfile() {
        return new UserResponse(
                1L, EMAIL, "Ana", "García", "612345678",
                LocalDate.of(1990, 5, 20), Gender.FEMALE, 175.0, 70.0, true);
    }

    private AddressResponse sampleAddress(long id, boolean isDefault) {
        return new AddressResponse(id, "Ana García", "Calle Mayor 1", "Madrid",
                "28001", "ES", isDefault);
    }

    // ── Perfil ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /me - Devuelve el perfil del usuario autenticado")
    void shouldReturnProfile() throws Exception {
        // GIVEN
        when(userService.getProfile(EMAIL)).thenReturn(sampleProfile());

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.firstName").value("Ana"))
                .andExpect(jsonPath("$.height").value(175.0));
    }

    @Test
    @DisplayName("PUT /me - Actualiza el perfil y devuelve los nuevos datos")
    void shouldUpdateProfile() throws Exception {
        // GIVEN
        ProfileUpdateRequest request = new ProfileUpdateRequest(
                "Ana María", "López", "699999999",
                LocalDate.of(1991, 3, 10), Gender.OTHER, 172.0, 68.0);

        when(userService.updateProfile(eq(EMAIL), any(ProfileUpdateRequest.class)))
                .thenReturn(new UserResponse(
                        1L, EMAIL, "Ana María", "López", "699999999",
                        LocalDate.of(1991, 3, 10), Gender.OTHER, 172.0, 68.0, true));

        // WHEN / THEN
        mockMvc.perform(asUser(put("/api/v1/users/me"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Ana María"))
                .andExpect(jsonPath("$.height").value(172.0));
    }

    // ── Direcciones ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /me/addresses - Lista las direcciones del usuario")
    void shouldListAddresses() throws Exception {
        // GIVEN
        when(addressService.list(EMAIL)).thenReturn(List.of(
                sampleAddress(1, true), sampleAddress(2, false)));

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me/addresses")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].defaultAddress").value(true));
    }

    @Test
    @DisplayName("POST /me/addresses - Crea una dirección y responde 201 con ubicación")
    void shouldCreateAddress() throws Exception {
        // GIVEN
        AddressRequest request = new AddressRequest(
                "Ana García", "Calle Mayor 1", "Madrid", "28001", "ES", true);

        when(addressService.create(eq(EMAIL), any(AddressRequest.class)))
                .thenReturn(sampleAddress(10, true));

        // WHEN / THEN
        mockMvc.perform(asUser(post("/api/v1/users/me/addresses"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.defaultAddress").value(true));
    }

    @Test
    @DisplayName("PUT /me/addresses/{id} - Actualiza una dirección existente")
    void shouldUpdateAddress() throws Exception {
        // GIVEN
        AddressRequest request = new AddressRequest(
                "Ana García", "Calle Nueva 5", "Madrid", "28002", "ES", false);

        when(addressService.update(eq(EMAIL), eq(4L), any(AddressRequest.class)))
                .thenReturn(new AddressResponse(4L, "Ana García", "Calle Nueva 5",
                        "Madrid", "28002", "ES", false));

        // WHEN / THEN
        mockMvc.perform(asUser(put("/api/v1/users/me/addresses/4"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(4))
                .andExpect(jsonPath("$.street").value("Calle Nueva 5"));
    }

    @Test
    @DisplayName("DELETE /me/addresses/{id} - Elimina y responde 204 sin cuerpo")
    void shouldDeleteAddress() throws Exception {
        mockMvc.perform(asUser(delete("/api/v1/users/me/addresses/4")))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("POST /me/addresses - Un cuerpo con campos vacíos responde 400")
    void shouldRejectBlankAddressBody() throws Exception {
        mockMvc.perform(asUser(post("/api/v1/users/me/addresses"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"\",\"street\":\"\",\"city\":\"\"," +
                                "\"postalCode\":\"\",\"countryCode\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── Recomendación de talla ──────────────────────────────────────────────

    @Test
    @DisplayName("POST /me/size-recommendation - Devuelve la talla sugerida")
    void shouldRecommendSize() throws Exception {
        // GIVEN
        when(sizeRecommendationService.recommend(EMAIL, 10L))
                .thenReturn(new SizeRecommendationResponse(
                        "M", "Con 175 cm y 70 kg, la talla M es la que mejor se ajusta.", "Alta"));

        // WHEN / THEN
        mockMvc.perform(asUser(post("/api/v1/users/me/size-recommendation"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":10}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendedSize").value("M"))
                .andExpect(jsonPath("$.confidence").value("Alta"));
    }

    @Test
    @DisplayName("POST /me/size-recommendation - Sin producto responde 400")
    void shouldRejectMissingProductId() throws Exception {
        mockMvc.perform(asUser(post("/api/v1/users/me/size-recommendation"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
