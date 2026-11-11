package com.nexus.commerce.security;

import com.nexus.commerce.entity.Role;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fase 10 (R5/R6) — el modo demo con el contexto real: el filtro corre DESPUÉS
 * de Spring Security (sin token sigue el 401 de siempre) y solo bloquea lo
 * listado; el resto del panel responde normal.
 */
@SpringBootTest(properties = {"spring.ai.openai.api-key=mock-key", "app.demo.enabled=true"})
@AutoConfigureMockMvc
@DisplayName("Fase 10 - Modo demo integrado en la cadena de seguridad")
class DemoModeIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    private String admin() {
        return "Bearer " + jwtService.generateToken(999L, "demo-admin@nexus.test", Role.ADMIN);
    }

    @Test
    @DisplayName("/payments/config declara demoMode = true")
    void configDeclaraDemo() throws Exception {
        mockMvc.perform(get("/api/v1/payments/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.demoMode").value(true));
    }

    @Test
    @DisplayName("ADMIN: DELETE de producto → 403 DEMO_MODE (antes de tocar la BD)")
    void adminNoPuedeBorrar() throws Exception {
        mockMvc.perform(delete("/api/v1/admin/products/999999").header("Authorization", admin()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("DEMO_MODE"));
    }

    @Test
    @DisplayName("sin token: DELETE de producto sigue siendo 401 (la seguridad va primero)")
    void sinTokenSigue401() throws Exception {
        mockMvc.perform(delete("/api/v1/admin/products/999999"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("ADMIN: el dashboard sigue respondiendo 200")
    void adminLeeElPanel() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard").header("Authorization", admin()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("forgot-password → 403 DEMO_MODE (A2)")
    void recuperacionBloqueada() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"demo@nexus.dev\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("DEMO_MODE"));
    }
}
