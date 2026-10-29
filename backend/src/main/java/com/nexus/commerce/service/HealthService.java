package com.nexus.commerce.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.Map;

/**
 * Sonda de vida del sistema (Tarea 6.4, D7: <strong>sin Actuator</strong>) y
 * monitorización extendida (Fase 8, R1).
 *
 * <p>Actuator es una dependencia, una superficie de ataque y un montón de
 * endpoints de los que la vitrina sólo necesita dos datos: ¿está viva y
 * responde la BD? Un {@code SELECT 1} explícito responde a eso sin añadir
 * nada al classpath.</p>
 *
 * <p>Fase 8 (R1): extiende la respuesta con detalles de dependencias
 * (base de datos, Flyway, uptime) para observabilidad operativa.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HealthService {

    private final DataSource dataSource;
    private final Flyway flyway;

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

    /**
     * Devuelve un mapa con el estado de salud completo para el endpoint
     * {@code GET /api/v1/health} (Fase 8, R1).
     *
     * @return mapa con {@code status}, {@code details.database},
     *         {@code details.flyway}, {@code details.uptime_seconds}
     */
    public Map<String, Object> getHealthDetails() {
        boolean dbHealthy = isHealthy();
        String flywayVersion = getFlywayVersion();
        long uptimeSeconds = getUptimeSeconds();

        Map<String, Object> details = Map.of(
                "database", dbHealthy ? "UP" : "DOWN",
                "flyway", flywayVersion,
                "uptime_seconds", uptimeSeconds
        );

        String overallStatus = dbHealthy ? "UP" : "DOWN";

        log.info("Health check completado", Map.of(
                "event", "health_check",
                "status", overallStatus,
                "database", details.get("database"),
                "flyway", details.get("flyway"),
                "uptime_seconds", details.get("uptime_seconds"),
                "timestamp", Instant.now().toString()
        ));

        return Map.of(
                "status", overallStatus,
                "details", details
        );
    }

    private String getFlywayVersion() {
        try {
            String applied = flyway.info().current() != null
                    ? flyway.info().current().getVersion().toString()
                    : "none";
            return "V" + applied + " applied";
        } catch (Exception e) {
            log.debug("No se pudo obtener versión de Flyway: {}", e.getMessage());
            return "unknown";
        }
    }

    private long getUptimeSeconds() {
        return java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
    }
}