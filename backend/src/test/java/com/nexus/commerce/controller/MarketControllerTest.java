package com.nexus.commerce.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 3.2, R1 — endpoint de mercados.
 *
 * <p>Es el primer test de integración con la cadena de seguridad real del
 * proyecto, y hace falta: «accesible sin sesión» solo se puede demostrar
 * pasando por el filtro de seguridad. Un test {@code standaloneSetup} no lo
 * cubre porque no monta Spring Security.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class MarketControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/v1/markets - Devuelve los 4 mercados ordenados por código")
    void shouldReturnAllMarketsOrderedByCode() throws Exception {
        mockMvc.perform(get("/api/v1/markets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].code").value("CH"))
                .andExpect(jsonPath("$[0].currency").value("CHF"))
                .andExpect(jsonPath("$[0].taxRate").value(8.10))
                .andExpect(jsonPath("$[1].code").value("ES"))
                .andExpect(jsonPath("$[1].currency").value("EUR"))
                .andExpect(jsonPath("$[1].taxRate").value(21.00))
                .andExpect(jsonPath("$[2].code").value("UK"))
                .andExpect(jsonPath("$[3].code").value("US"));
    }

    @Test
    @DisplayName("GET /api/v1/markets - Público para anónimos mientras los endpoints protegidos siguen rechazando")
    void shouldExposeMarketsToAnonymousUsersWhileProtectedEndpointsReject() throws Exception {
        // Control: si la seguridad estuviera desactivada, /orders también daría 200
        // y este test no demostraría nada.
        mockMvc.perform(get("/api/v1/orders"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/markets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));
    }
}
