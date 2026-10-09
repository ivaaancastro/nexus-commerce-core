package com.nexus.commerce.controller;

import com.nexus.commerce.service.HealthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 6.4 (R5.5) — health check con la BD sana y con la BD caída (D7, sin
 * Actuator). La rama DOWN se prueba con un {@code DataSource} mockeado: es
 * exactamente el «datasource inválido o mock» que pide la spec, y no requiere
 * tumbar la BD real del entorno.
 */
@DisplayName("Tarea 6.4 - GET /api/v1/health")
class HealthControllerTest {

    private MockMvc mockMvcCon(DataSource dataSource) {
        return MockMvcBuilders
                .standaloneSetup(new HealthController(new HealthService(dataSource)))
                .build();
    }

    @Test
    @DisplayName("BD sana - 200 con status UP")
    void bdSanaRespondeUp() throws Exception {
        // GIVEN: una BD que responde al SELECT 1
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);

        // WHEN / THEN
        mockMvcCon(dataSource).perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("BD caida - 503 con status DOWN, la SQLException no se propaga")
    void bdCaidaRespondeDown() throws Exception {
        // GIVEN: una BD que no acepta conexiones
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("BD caída"));

        // WHEN / THEN: 503 semántico, no un 500 con stacktrace
        mockMvcCon(dataSource).perform(get("/api/v1/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"));
    }
}
