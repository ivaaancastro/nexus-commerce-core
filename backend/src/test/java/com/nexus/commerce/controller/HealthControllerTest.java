package com.nexus.commerce.controller;

import com.nexus.commerce.service.HealthService;
import org.flywaydb.core.Flyway;
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
 * <p>
 * Fase 8 (R1): health check extendido con detalles de dependencias.
 * Se mocka también Flyway para evitar dependencia de BD real.
 * </p>
 */
@DisplayName("Tarea 6.4 - GET /api/v1/health")
class HealthControllerTest {

    private MockMvc mockMvcCon(DataSource dataSource, Flyway flyway) {
        return MockMvcBuilders
                .standaloneSetup(new HealthController(new HealthService(dataSource, flyway)))
                .build();
    }

    @Test
    @DisplayName("BD sana - 200 con status UP y detalles")
    void bdSanaRespondeUp() throws Exception {
        // GIVEN: una BD que responde al SELECT 1
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);

        Flyway flyway = mock(Flyway.class);
        when(flyway.info()).thenReturn(null); // FlywayInfoService es complex, devolvemos null

        // WHEN / THEN
        mockMvcCon(dataSource, flyway).perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.details.database").value("UP"))
                .andExpect(jsonPath("$.details.flyway").exists())
                .andExpect(jsonPath("$.details.uptime_seconds").exists());
    }

    @Test
    @DisplayName("BD caída - 503 con status DOWN, la SQLException no se propaga")
    void bdCaidaRespondeDown() throws Exception {
        // GIVEN: una BD que no acepta conexiones
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("BD caída"));

        Flyway flyway = mock(Flyway.class);
        when(flyway.info()).thenReturn(null);

        // WHEN / THEN: 503 semántico, no un 500 con stacktrace
        mockMvcCon(dataSource, flyway).perform(get("/api/v1/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"))
                .andExpect(jsonPath("$.details.database").value("DOWN"));
    }
}
