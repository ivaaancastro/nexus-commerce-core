package com.nexus.commerce.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Habilita la ejecución programada (V1 {@code order-status-emails}, D9).
 *
 * <p>Es <strong>toda</strong> la infraestructura de tareas que se añade: el
 * poller del outbox ({@code EmailOutboxPoller}) es el único usuario — sin
 * cola externa, sin Redis, sin {@code @Async}. Su cadencia se controla con
 * {@code app.mail.outbox.poll-ms} (por defecto 15 s).</p>
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
