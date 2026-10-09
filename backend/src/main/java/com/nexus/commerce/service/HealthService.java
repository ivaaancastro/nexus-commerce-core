package com.nexus.commerce.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Sonda de vida del sistema (Tarea 6.4, D7: <strong>sin Actuator</strong>).
 *
 * <p>Actuator es una dependencia, una superficie de ataque y un montón de
 * endpoints de los que la vitrina sólo necesita dos datos: ¿está viva y
 * responde la BD? Un {@code SELECT 1} explícito responde a eso sin añadir
 * nada al classpath.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HealthService {

    private final DataSource dataSource;

    /**
     * Ejecuta {@code SELECT 1} contra la base de datos.
     *
     * @return {@code true} si la BD responde; {@code false} si falla la
     *         conexión o la consulta (nunca propaga la {@link SQLException}).
     */
    public boolean isHealthy() {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("SELECT 1");
            return true;
        } catch (SQLException e) {
            log.warn("Health check con BD fallido: {}", e.getMessage());
            return false;
        }
    }
}
