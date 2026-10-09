package com.nexus.commerce.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 6.2, R2 — la búsqueda funciona <strong>sin</strong>
 * {@code OPENAI_API_KEY}.
 *
 * <p>Es de integración porque las dos cosas que hay que demostrar sólo se ven
 * contra la base de datos real: que la consulta {@code ILIKE} del fallback
 * existe y es válida (un mock no puede comprobar el JPQL), y que devuelve
 * <strong>resultados reales del catálogo</strong>, no una lista vacía de
 * mentira.</p>
 *
 * <p>La propiedad se fuerza a {@code mock-key} en {@code properties} para que
 * el test sea <strong>determinista en cualquier entorno</strong>: en CI la
 * variable {@code SPRING_AI_OPENAI_API_KEY} existe y, sin este empujón, el
 * contexto tomaría el camino semántico y llamaría a OpenAI de verdad.</p>
 */
@SpringBootTest(properties = "spring.ai.openai.api-key=mock-key")
@AutoConfigureMockMvc
class ProductSearchFallbackTest {

    @Autowired
    private MockMvc mockMvc;

    /**
     * Semilla conocida (V1): «Blazer Cruzada Estructura» (OUTERWEAR) y
     * «Abrigo Lana Oversize» + «Jersey Punto Lana» casan con «lana».
     */
    @Test
    @DisplayName("R2 - Sin clave, GET /search/semantic responde 200 con resultados reales por texto")
    void busquedaPorTextoSinClave() throws Exception {
        mockMvc.perform(get("/api/v1/products/search/semantic").param("query", "blazer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Blazer Cruzada Estructura"))
                .andExpect(jsonPath("$[0].referenceCode").value("0432/021"))
                .andExpect(jsonPath("$[0].family").value("OUTERWEAR"));
    }

    @Test
    @DisplayName("R2 - Sin score no se serializa: la UI no pintará un «Match 0 %» mentiroso")
    void sinClaveNoSeSerializaElScore() throws Exception {
        mockMvc.perform(get("/api/v1/products/search/semantic").param("query", "blazer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].similarityScore").doesNotExist());
    }

    @Test
    @DisplayName("R2 - El filtro family se aplica también en el fallback")
    void elFallbackRespetaElFiltroFamilia() throws Exception {
        mockMvc.perform(get("/api/v1/products/search/semantic")
                        .param("query", "lana")
                        .param("family", "KNITWEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Jersey Punto Lana"));
    }

    @Test
    @DisplayName("R2 - El límite de resultados se respeta también en el fallback")
    void elFallbackRespetaElLimite() throws Exception {
        // «lana» casa con 2 productos; con limit=1 sólo llega el primero alfabético.
        mockMvc.perform(get("/api/v1/products/search/semantic")
                        .param("query", "lana")
                        .param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Abrigo Lana Oversize"));
    }

    @Test
    @DisplayName("R2 - El texto se busca sin distinguir mayúsculas y también sobre la referencia")
    void elFallbackNoDistingueMayusculasNiIgnoraLaReferencia() throws Exception {
        mockMvc.perform(get("/api/v1/products/search/semantic").param("query", "BLAZER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", hasItem("Blazer Cruzada Estructura")));

        mockMvc.perform(get("/api/v1/products/search/semantic").param("query", "0611"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Abrigo Lana Oversize"));
    }
}
