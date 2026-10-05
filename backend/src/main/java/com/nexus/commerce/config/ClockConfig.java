package com.nexus.commerce.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Reloj inyectable (Tarea 5.4). Permite testear el límite de 30 días de
 * {@code ReturnEligibilityService} sin depender de la fecha real del sistema.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
