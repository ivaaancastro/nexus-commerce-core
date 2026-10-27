package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.nexus.commerce.dto.ProductResponse;
import com.nexus.commerce.dto.WishlistItemResponse;
import com.nexus.commerce.dto.WishlistResponse;
import com.nexus.commerce.exception.GlobalExceptionHandler;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.service.WishlistService;
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
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests del controller de favoritos en modo standalone (patrón
 * {@code UserOrderControllerTest}): Security no está presente, así que el
 * principal va con {@code setUserPrincipal} igual que lo hace el filtro JWT.
 *
 * <p>La puerta de 401 de los 4 endpoints vive en {@code SecurityRulesTest}
 * (contra el contexto completo).</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("V3 wishlist - controller: 201/200/204 y validación del body")
class WishlistControllerTest {

    private static final String EMAIL = "ana@example.com";
    private static final String BASE = "/api/v1/wishlist";

    @Mock
    private WishlistService wishlistService;

    @InjectMocks
    private WishlistController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void configurar() throws Exception {
        LocalValidatorFactoryBean validador = new LocalValidatorFactoryBean();
        validador.afterPropertiesSet();
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validador)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .build();
    }

    /** Simula el principal que Spring Security dejaría en la petición (patrón UserOrderControllerTest). */
    private MockHttpServletRequestBuilder conSesion(MockHttpServletRequestBuilder peticion) {
        return peticion.with(request -> {
            request.setUserPrincipal(
                    new UsernamePasswordAuthenticationToken(EMAIL, null, List.of()));
            return request;
        });
    }

    private WishlistItemResponse item() {
        return new WishlistItemResponse(7L, OffsetDateTime.parse("2026-10-26T10:00:00Z"),
                new ProductResponse(1L, "0432/021", "Blazer Cruzada",
                        null, "Blazers", List.of(), null));
    }

    @Test
    @DisplayName("GET /wishlist - 200 con los artículos del usuario")
    void getDevuelve200ConItems() throws Exception {
        // GIVEN
        when(wishlistService.getWishlist(EMAIL))
                .thenReturn(new WishlistResponse(List.of(item())));

        // WHEN / THEN
        mockMvc.perform(conSesion(get(BASE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(7))
                .andExpect(jsonPath("$.items[0].product.referenceCode").value("0432/021"))
                .andExpect(jsonPath("$.items[0].product.name").value("Blazer Cruzada"))
                // Sin importes en la API: la vitrina los pide frescos a /pricing (D13)
                .andExpect(jsonPath("$.items[0].product.skus").isArray());
    }

    @Test
    @DisplayName("POST /items nuevo - 201 con el ítem creado")
    void postCrea201() throws Exception {
        // GIVEN
        when(wishlistService.addItem(EMAIL, 1L))
                .thenReturn(new WishlistService.AddResult(true, item()));

        // WHEN / THEN
        mockMvc.perform(conSesion(post(BASE + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":1}")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.addedAt").exists())
                .andExpect(jsonPath("$.product.id").value(1));
    }

    @Test
    @DisplayName("POST /items repetido - 200 con el ítem existente (idempotente, sin 409)")
    void postRepetido200() throws Exception {
        // GIVEN
        when(wishlistService.addItem(EMAIL, 1L))
                .thenReturn(new WishlistService.AddResult(false, item()));

        // WHEN / THEN
        mockMvc.perform(conSesion(post(BASE + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":1}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7));
    }

    @Test
    @DisplayName("POST /items sin productId - 400 de validación y el servicio no se llama")
    void postSinProductId400() throws Exception {
        // WHEN / THEN
        mockMvc.perform(conSesion(post(BASE + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")))
                .andExpect(status().isBadRequest());
        verify(wishlistService, never()).addItem(anyString(), anyLong());
    }

    @Test
    @DisplayName("POST /items de un producto inexistente - 404 con message (handler existente)")
    void postProductoInexistente404() throws Exception {
        // GIVEN
        when(wishlistService.addItem(EMAIL, 999L))
                .thenThrow(new ResourceNotFoundException("Producto no encontrado"));

        // WHEN / THEN
        mockMvc.perform(conSesion(post(BASE + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":999}")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Producto no encontrado"));
    }

    @Test
    @DisplayName("DELETE /items/{id} - 204 siempre (existente o no, el servicio es idempotente)")
    void deleteItem204() throws Exception {
        // WHEN / THEN
        mockMvc.perform(conSesion(delete(BASE + "/items/5")))
                .andExpect(status().isNoContent());
        verify(wishlistService).removeItem(EMAIL, 5L);
    }

    @Test
    @DisplayName("DELETE /wishlist - 204 al vaciar la lista")
    void deleteTodo204() throws Exception {
        // WHEN / THEN
        mockMvc.perform(conSesion(delete(BASE)))
                .andExpect(status().isNoContent());
        verify(wishlistService).clear(EMAIL);
    }
}
