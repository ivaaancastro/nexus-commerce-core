package com.nexus.commerce.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * {@code GET /api/v1/metrics} — métricas básicas del sistema (Fase 8, R2).
 *
 * <p>Expone métricas operativas simples sin necesidad de Prometheus/Grafana.
 * Protegido detrás de {@code hasRole("ADMIN")} igual que el resto de endpoints admin.</p>
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Metrics", description = "Métricas básicas operativas (Fase 8, R2)")
public class MetricsController {

    // Contadores simples para métricas de peticiones
    private static final AtomicLong totalRequests = new AtomicLong(0);
    private static final AtomicLong failedRequests = new AtomicLong(0);
    private static final AtomicLong requestsLastMinute = new AtomicLong(0);
    private static final AtomicLong failedLastMinute = new AtomicLong(0);
    private static volatile long windowStart = System.currentTimeMillis();

    private final MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();

    @GetMapping("/metrics")
    @Operation(summary = "Métricas básicas del sistema", description = "Devuelve uptime, memoria JVM y contadores de peticiones")
    public Map<String, Object> metrics() {
        // Rotar ventana de 1 minuto
        rotateWindowIfNeeded();

        MemoryUsage heapMemory = memoryBean.getHeapMemoryUsage();
        long usedMb = (heapMemory.getUsed() / 1024 / 1024);
        long maxMb = (heapMemory.getMax() / 1024 / 1024);

        Map<String, Object> result = Map.of(
                "uptime_seconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000,
                "active_sessions", getActiveSessionsEstimate(),
                "total_requests_last_minute", requestsLastMinute.get(),
                "failed_requests_last_minute", failedLastMinute.get(),
                "jvm_memory_used_mb", usedMb,
                "jvm_memory_max_mb", maxMb
        );

        logMetrics(result);
        return result;
    }

    /**
     * Incrementa el contador de peticiones totales y de la ventana actual.
     * Llamar desde un filter/interceptor para trackear tráfico real.
     */
    public static void recordRequest(boolean failed) {
        totalRequests.incrementAndGet();
        requestsLastMinute.incrementAndGet();
        if (failed) {
            failedRequests.incrementAndGet();
            failedLastMinute.incrementAndGet();
        }
    }

    private void rotateWindowIfNeeded() {
        long now = System.currentTimeMillis();
        if (now - windowStart >= 60_000) { // 1 minuto
            requestsLastMinute.set(0);
            failedLastMinute.set(0);
            windowStart = now;
        }
    }

    private int getActiveSessionsEstimate() {
        // Estimación simple: no hay store de sesiones centralizado en este proyecto,
        // así que devolvemos 0. En producción se conectaría a Redis o tabla de sesiones.
        return 0;
    }

    private void logMetrics(Map<String, Object> metrics) {
        // Logging estructurado JSON (Fase 8, R4)
        // Usamos System.out.println para demo; en prod usar SLF4J con JSON layout
        System.out.println("METRICS " + java.time.Instant.now() + " " + metrics);
    }
}