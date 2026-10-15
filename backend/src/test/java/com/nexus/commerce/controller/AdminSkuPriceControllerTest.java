package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 7.3 (spec specs/admin-stock-pricing/, R3 y R5) — precios por mercado
 * bajo {@code /api/v1/admin/skus/{id}/prices}.
 *
 * <p><strong>BD compartida limpia (tasks C.5)</strong>: mismo criterio que
 * {@code AdminProductControllerTest} — datos de prueba con clave fija
 * ({@code 7302/001}) borrados en {@code @Before} y {@code @After} (cascada
 * SKU → market_prices). Las filas <strong>sembradas</strong> no se modifican:
 * los PUTs con éxito sólo tocan el SKU de prueba.</p>
 *
 * <p>El precio público se verifica con la vitrina real
 * ({@code GET /api/v1/pricing/skus/...}): mismas filas, reflejo en vivo (R5.3).</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Tarea 7.3 - Precios por mercado en la zona admin")
class AdminSkuPriceControllerTest {

    private static final String BASE = "/api/v1/admin/skus";
    private static final String PUBLICO = "/api/v1/pricing/skus";
    private static final String REF_PRUEBA = "7302/001";
    private static final String BARCODE_PRUEBA = "730200000001";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private ProductRepository productRepository;

    private String adminToken;
    private long skuPrueba;

    @BeforeEach
    void preparar() throws Exception {
        limpiar();
        adminToken = jwtService.generateToken(999L, "admin-precios@nexus.test", Role.ADMIN);
        long productoId = crearProducto();
        skuPrueba = crearSku(productoId);
    }

    @AfterEach
    void limpiar() {
        productRepository.findByReferenceCode(REF_PRUEBA).ifPresent(productRepository::delete);
        productRepository.flush();
    }

    // ── R3.1: lectura ──────────────────────────────────────────────────────

    @Test
    @DisplayName("C.3 - GET de un SKU sembrado devuelve los 4 mercados ordenados con sus precios")
    void getDeSkuSembradoCuatroMercados() throws Exception {
        mockMvc.perform(get(BASE + "/1/prices")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].marketCode").value("CH"))
                .andExpect(jsonPath("$[1].marketCode").value("ES"))
                .andExpect(jsonPath("$[2].marketCode").value("UK"))
                .andExpect(jsonPath("$[3].marketCode").value("US"))
                .andExpect(jsonPath("$[1].marketName").value("España"))
                .andExpect(jsonPath("$[1].currency").value("EUR"))
                .andExpect(jsonPath("$[1].taxRate").value(21.00))
                .andExpect(jsonPath("$[1].basePrice").isNumber())
                .andExpect(jsonPath("$[1].isActive").value(true));
    }

    @Test
    @DisplayName("C.3 - GET de un SKU sin precios: 4 mercados con nulls (señal de «crear», R3.1)")
    void getDeSkuSinPreciosNulls() throws Exception {
        mockMvc.perform(get(BASE + "/" + skuPrueba + "/prices")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[1].marketCode").value("ES"))
                .andExpect(jsonPath("$[1].basePrice").value(nullValue()))
                .andExpect(jsonPath("$[1].discountPrice").value(nullValue()))
                .andExpect(jsonPath("$[1].isActive").value(nullValue()));
    }

    // ── R3.2 + R5.3: upsert con reflejo en la vitrina ──────────────────────

    @Test
    @DisplayName("C.3 - PUT crea la fila (marketCode en minúsculas se normaliza) y la vitrina lo refleja")
    void putCreaPrecioYLaVitrinaLoRefleja() throws Exception {
        // WHEN — crear el precio con «es» en minúscula
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/es")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90,\"discountPrice\":null,\"isActive\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.marketCode").value("ES"))
                .andExpect(jsonPath("$.basePrice").value(59.90))
                .andExpect(jsonPath("$.discountPrice").value(nullValue()))
                .andExpect(jsonPath("$.isActive").value(true));

        // THEN — la vitrina pública (mismas filas) responde ya con ese precio
        mockMvc.perform(get(PUBLICO + "/" + skuPrueba + "?market=ES"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalPrice").value(59.90))
                .andExpect(jsonPath("$.originalPrice").value(59.90))
                .andExpect(jsonPath("$.hasDiscount").value(false));

        // …y el panel lo ve completo en los 4 mercados
        mockMvc.perform(get(BASE + "/" + skuPrueba + "/prices")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[1].basePrice").value(59.90))
                .andExpect(jsonPath("$[3].basePrice").value(nullValue()));
    }

    @Test
    @DisplayName("C.3 - PUT actualiza con descuento: la vitrina muestra el precio rebajado (R5.3)")
    void putActualizaConDescuentoYLaVitrinaLoRefleja() throws Exception {
        givenPrecioDePrueba("59.90", "null", "true");

        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90,\"discountPrice\":49.90,\"isActive\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.discountPrice").value(49.90));

        mockMvc.perform(get(PUBLICO + "/" + skuPrueba + "?market=ES"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalPrice").value(49.90))
                .andExpect(jsonPath("$.originalPrice").value(59.90))
                .andExpect(jsonPath("$.hasDiscount").value(true));
    }

    @Test
    @DisplayName("C.3 - isActive=false oculta el precio público (404) y true lo devuelve (R3.7)")
    void inactivarOcultaElPrecioPublico() throws Exception {
        givenPrecioDePrueba("59.90", "null", "true");

        // WHEN — desactivar
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90,\"discountPrice\":null,\"isActive\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(false));

        // THEN — el público lo trata como «sin precio»
        mockMvc.perform(get(PUBLICO + "/" + skuPrueba + "?market=ES"))
                .andExpect(status().isNotFound());

        // WHEN — reactivar
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90,\"discountPrice\":null,\"isActive\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(true));

        mockMvc.perform(get(PUBLICO + "/" + skuPrueba + "?market=ES"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalPrice").value(59.90));
    }

    // ── R3.3/R3.4: validación ──────────────────────────────────────────────

    @Test
    @DisplayName("C.3 - 400 cross-field: el descuento no puede superar el base (R3.4)")
    void descuentoMayorQueBase400() throws Exception {
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90,\"discountPrice\":70.00,\"isActive\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("no puede superar")));
    }

    @Test
    @DisplayName("C.3 - 400 de validación jakarta: base 0, descuento 0, 3 decimales o activo ausente (R3.3)")
    void validacionJakarta400() throws Exception {
        // basePrice = 0
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":0,\"discountPrice\":null,\"isActive\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());

        // discountPrice = 0 (0 no es un descuento: para quitarlo va null)
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90,\"discountPrice\":0,\"isActive\":true}"))
                .andExpect(status().isBadRequest());

        // 3 decimales (la escala la fija @Digits, sin aritmética)
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.905,\"discountPrice\":null,\"isActive\":true}"))
                .andExpect(status().isBadRequest());

        // isActive ausente
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("C.3 - 404 para SKU o mercado desconocidos (R3.5)")
    void put404() throws Exception {
        mockMvc.perform(get(BASE + "/999999/prices")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(BASE + "/999999/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90,\"discountPrice\":null,\"isActive\":true}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/XX")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":59.90,\"discountPrice\":null,\"isActive\":true}"))
                .andExpect(status().isNotFound());
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private void givenPrecioDePrueba(String base, String descuento, String activo) throws Exception {
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/prices/ES")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basePrice\":" + base + ",\"discountPrice\":" + descuento
                                + ",\"isActive\":" + activo + "}"))
                .andExpect(status().isOk());
    }

    private long crearProducto() throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"" + REF_PRUEBA + "\",\"name\":\"Blazer Prueba 73b\","
                                + "\"family\":\"OUTERWEAR\",\"description\":\"Producto de prueba 7.3\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    private long crearSku(long productoId) throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/v1/admin/products/" + productoId + "/skus")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barcode\":\"" + BARCODE_PRUEBA + "\",\"color\":\"Marino\",\"size\":\"M\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    private long leerId(MvcResult resultado) throws Exception {
        return objectMapper.readTree(
                        resultado.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .get("id").asLong();
    }
}
