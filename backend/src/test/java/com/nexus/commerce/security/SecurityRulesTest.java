package com.nexus.commerce.security;

import com.nexus.commerce.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 6.4 (R5.4) — la lista explícita de {@code SecurityConfig} (D6):
 * {@code anyRequest().denyAll()} y primera coincidencia gana.
 *
 * <p>Los tests corren con {@code spring.ai.openai.api-key=mock-key} (patrón
 * de la 6.2): con clave inválida los POST de búsqueda responden 503 de
 * negocio <strong>sin llamar a OpenAI</strong>, así el «con token» es
 * determinista en CI.</p>
 *
 * <p>El token se mintea con el {@code JwtService} real de la aplicación: el
 * filtro JWT sólo valida firma y claims (no carga el usuario de BD), así que
 * un token firmado por la propia app autentica igual que en producción.</p>
 */
@SpringBootTest(properties = "spring.ai.openai.api-key=mock-key")
@AutoConfigureMockMvc
@DisplayName("Tarea 6.4 - Reglas de seguridad: denyAll + lista explícita")
class SecurityRulesTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    private String token;

    @BeforeEach
    void mintearToken() {
        // Firma con rol USER (aridad nueva de la 7.1); los tests de /admin/ping
        // mintean su propio token ADMIN más abajo.
        token = jwtService.generateToken(999L, "seguridad@nexus.test", Role.USER);
    }

    @Test
    @DisplayName("Sin token - POST /inventory/reserve -> 401")
    void reserveSinToken401() throws Exception {
        mockMvc.perform(post("/api/v1/inventory/reserve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skuId\":1,\"warehouseCode\":\"WH_ZARAGOZA\",\"quantity\":1}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Sin token - POST /products/search/index -> 401")
    void indexSinToken401() throws Exception {
        mockMvc.perform(post("/api/v1/products/search/index"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Sin token - POST /products/enrich -> 401")
    void enrichSinToken401() throws Exception {
        mockMvc.perform(post("/api/v1/products/enrich")
                        .param("reference", "0432/021"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Con token - los tres POST pasan la puerta y responden su codigo de negocio")
    void losTresConTokenRespondenSuNegocio() throws Exception {
        // reserve con cuerpo vacío: llega a la validación -> 400. Si la
        // autenticación hubiera fallado sería 401 antes de mirar el body.
        mockMvc.perform(post("/api/v1/inventory/reserve")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        // index con la clave inválida del contexto -> 503 de negocio (6.2),
        // sin red hacia OpenAI.
        mockMvc.perform(post("/api/v1/products/search/index")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SEMANTIC_SEARCH_UNAVAILABLE"));

        // enrich: ídem, otra vez 503 y no 401.
        mockMvc.perform(post("/api/v1/products/enrich")
                        .header("Authorization", "Bearer " + token)
                        .param("reference", "0432/021"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("ENRICHMENT_UNAVAILABLE"));
    }

    @Test
    @DisplayName("Endpoint no listado -> 401 (denyAll, nunca permitAll implicito)")
    void endpointNoListado401() throws Exception {
        mockMvc.perform(get("/api/v1/payments"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("6.4(i) - GET /inventory/skus y /pricing/skus siguen publicos sin token")
    void stockYPrecioSiguenPublicos() throws Exception {
        mockMvc.perform(get("/api/v1/inventory/skus/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skuId").value(1));

        mockMvc.perform(get("/api/v1/pricing/skus/1").param("market", "ES"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skuId").value(1));
    }

    @Test
    @DisplayName("GET /health es publico y responde UP con la BD real")
    void healthPublicoRespondeUp() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("SpringDoc sigue publicado - /v3/api-docs responde 200 sin token")
    void apiDocsSiguePublicado() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists());
    }

    // ── Tarea 7.1: /api/v1/admin/** exige hasRole(ADMIN) ────────────────────

    @Test
    @DisplayName("Sin token - GET /admin/ping -> 401")
    void adminPingSinToken401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/ping"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Rol USER - GET /admin/ping -> 403")
    void adminPingRolUser403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/ping")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Rol ADMIN - GET /admin/ping -> 200 con email y rol")
    void adminPingRolAdmin200() throws Exception {
        // GIVEN — mismo usuario, pero con el claim role=ADMIN
        String adminToken = jwtService.generateToken(999L, "seguridad@nexus.test", Role.ADMIN);

        // WHEN / THEN — el denyAll no lo bloquea: la regla hasRole va antes
        mockMvc.perform(get("/api/v1/admin/ping")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("seguridad@nexus.test"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }
}
