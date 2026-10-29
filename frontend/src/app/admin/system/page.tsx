"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Dashboard operativo del sistema (Fase 8, R5).
 *
 * Muestra el estado de salud, última ejecución de scripts de mantenimiento
 * y métricas básicas. Protegida detrás de AdminRoute (hasRole("ADMIN")).
 */
export default function SystemPage() {
    const [health, setHealth] = useState<{
        status: string;
        details: { database: string; flyway: string; uptime_seconds: number };
    } | null>(null);
    const [metrics, setMetrics] = useState<{
        uptime_seconds: number;
        jvm_memory_used_mb: number;
        jvm_memory_max_mb: number;
        total_requests_last_minute: number;
        failed_requests_last_minute: number;
    } | null>(null);
    const [lastBackup, setLastBackup] = useState<string | null>(null);
    const [lastVerify, setLastVerify] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const formatUptime = (seconds: number) => {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const parts = [];
        if (d) parts.push(`${d}d`);
        if (h) parts.push(`${h}h`);
        if (m) parts.push(`${m}m`);
        parts.push(`${s}s`);
        return parts.join(" ");
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        try {
            return new Date(dateStr).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                // Health check
                const healthData = await api.getHealth();
                setHealth(healthData);

                // Metrics
                const metricsData = await api.getMetrics();
                setMetrics(metricsData);

                // Intentar leer último backup (desde archivo local o API si existiera)
                // Como no hay API para esto, simulamos con localStorage o mostramos —
                // En producción se conectaría al servidor de archivos o BD
                const backupFiles = localStorage.getItem("backup_files");
                if (backupFiles) {
                    try {
                        const files = JSON.parse(backupFiles);
                        if (files.length > 0) {
                            // Ordenar por fecha descendente
                            files.sort((a: string, b: string) => b.localeCompare(a));
                            setLastBackup(files[0]);
                        }
                    } catch {
                        // ignorar
                    }
                }

                const verifyRuns = localStorage.getItem("verify_runs");
                if (verifyRuns) {
                    try {
                        const runs = JSON.parse(verifyRuns);
                        if (runs.length > 0) {
                            runs.sort((a: string, b: string) => b.localeCompare(a));
                            setLastVerify(runs[0]);
                        }
                    } catch {
                        // ignorar
                    }
                }
            } catch (err) {
                setError("No se pudo cargar el estado del sistema");
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
        // Refrescar cada 30 segundos
        const interval = setInterval(fetchData, 30_000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col gap-6">
                <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                    Sistema
                </p>
                <h1 className="text-2xl font-medium uppercase tracking-widest">
                    Estado del sistema
                </h1>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="border border-neutral-200 p-6 animate-pulse">
                            <div className="h-4 bg-neutral-200 rounded w-3/4 mb-4" />
                            <div className="h-8 bg-neutral-200 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col gap-6">
                <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                    Sistema
                </p>
                <h1 className="text-2xl font-medium uppercase tracking-widest">
                    Estado del sistema
                </h1>
                <div className="border border-red-300 bg-red-50 text-red-900 p-4 rounded">
                    {error}
                </div>
            </div>
        );
    }

    const healthStatus = health?.status === "UP" ? "UP" : "DOWN";
    const dbStatus = health?.details.database === "UP" ? "UP" : "DOWN";

    return (
        <div className="flex flex-col gap-6">
            <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                Sistema
            </p>
            <h1 className="text-2xl font-medium uppercase tracking-widest">
                Estado del sistema
            </h1>

            {/* Tarjetas de estado */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Health general */}
                <div className="border border-neutral-200 p-6">
                    <span className="text-xs uppercase tracking-widest text-neutral-600">
                        Estado general
                    </span>
                    <div className="flex items-center gap-3 mt-2">
                        <span
                            className={`w-3 h-3 rounded-full ${
                                healthStatus === "UP"
                                    ? "bg-green-500"
                                    : "bg-red-500"
                            }`}
                        />
                        <span
                            className={`text-lg font-medium ${
                                healthStatus === "UP"
                                    ? "text-green-700"
                                    : "text-red-700"
                            }`}
                        >
                            {healthStatus}
                        </span>
                    </div>
                </div>

                {/* Base de datos */}
                <div className="border border-neutral-200 p-6">
                    <span className="text-xs uppercase tracking-widest text-neutral-600">
                        Base de datos
                    </span>
                    <div className="flex items-center gap-3 mt-2">
                        <span
                            className={`w-3 h-3 rounded-full ${
                                dbStatus === "UP" ? "bg-green-500" : "bg-red-500"
                            }`}
                        />
                        <span
                            className={`text-lg font-medium ${
                                dbStatus === "UP" ? "text-green-700" : "text-red-700"
                            }`}
                        >
                            {dbStatus}
                        </span>
                    </div>
                </div>

                {/* Uptime */}
                <div className="border border-neutral-200 p-6">
                    <span className="text-xs uppercase tracking-widest text-neutral-600">
                        Uptime
                    </span>
                    <div className="mt-2 text-lg font-medium text-neutral-900">
                        {health ? formatUptime(health.details.uptime_seconds) : "—"}
                    </div>
                </div>

                {/* Flyway */}
                <div className="border border-neutral-200 p-6">
                    <span className="text-xs uppercase tracking-widest text-neutral-600">
                        Última migración
                    </span>
                    <div className="mt-2 text-lg font-medium text-neutral-900">
                        {health?.details.flyway ?? "—"}
                    </div>
                </div>
            </div>

            {/* Métricas JVM */}
            {metrics && (
                <div className="border border-neutral-200 p-6">
                    <span className="text-xs uppercase tracking-widest text-neutral-600">
                        Métricas JVM
                    </span>
                    <div className="grid gap-4 md:grid-cols-3 mt-4">
                        <div>
                            <span className="text-xs uppercase tracking-widest text-neutral-600">
                                Memoria usada
                            </span>
                            <div className="mt-1 text-lg font-medium text-neutral-900">
                                {metrics.jvm_memory_used_mb} MB
                            </div>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-widest text-neutral-600">
                                Memoria máxima
                            </span>
                            <div className="mt-1 text-lg font-medium text-neutral-900">
                                {metrics.jvm_memory_max_mb} MB
                            </div>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-widest text-neutral-600">
                                Uso
                            </span>
                            <div className="mt-1 text-lg font-medium text-neutral-900">
                                {metrics.jvm_memory_max_mb > 0
                                    ? Math.round(
                                          (metrics.jvm_memory_used_mb / metrics.jvm_memory_max_mb) *
                                              100
                                      ) + "%"
                                    : "—"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Métricas de peticiones */}
            {metrics && (
                <div className="border border-neutral-200 p-6">
                    <span className="text-xs uppercase tracking-widest text-neutral-600">
                        Tráfico (último minuto)
                    </span>
                    <div className="grid gap-4 md:grid-cols-3 mt-4">
                        <div>
                            <span className="text-xs uppercase tracking-widest text-neutral-600">
                                Peticiones totales
                            </span>
                            <div className="mt-1 text-lg font-medium text-neutral-900">
                                {metrics.total_requests_last_minute}
                            </div>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-widest text-neutral-600">
                                Fallidas
                            </span>
                            <div className="mt-1 text-lg font-medium text-red-700">
                                {metrics.failed_requests_last_minute}
                            </div>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-widest text-neutral-600">
                                Tasa de error
                            </span>
                            <div className="mt-1 text-lg font-medium text-neutral-900">
                                {metrics.total_requests_last_minute > 0
                                    ? (
                                          (metrics.failed_requests_last_minute /
                                              metrics.total_requests_last_minute) *
                                          100
                                      ).toFixed(1) + "%"
                                    : "0%"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mantenimiento */}
            <div className="border border-neutral-200 p-6">
                <span className="text-xs uppercase tracking-widest text-neutral-600">
                    Mantenimiento
                </span>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                    <div>
                        <span className="text-xs uppercase tracking-widest text-neutral-600">
                            Último backup
                        </span>
                        <div className="mt-1 text-lg font-medium text-neutral-900">
                            {formatDate(lastBackup)}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                            Ejecutar: <code className="text-neutral-700 bg-neutral-100 px-1 rounded">
                                ./scripts/backup-db.sh
                            </code>
                        </p>
                    </div>
                    <div>
                        <span className="text-xs uppercase tracking-widest text-neutral-600">
                            Última verificación
                        </span>
                        <div className="mt-1 text-lg font-medium text-neutral-900">
                            {formatDate(lastVerify)}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                            Ejecutar: <code className="text-neutral-700 bg-neutral-100 px-1 rounded">
                                ./scripts/verify-consistency.sh
                            </code>
                        </p>
                    </div>
                </div>
            </div>

            {/* Detalles de health check */}
            {health && (
                <details className="border border-neutral-200 p-4">
                    <summary className="text-xs uppercase tracking-widest text-neutral-600 cursor-pointer">
                        Detalles técnicos del health check
                    </summary>
                    <pre className="mt-4 text-xs text-neutral-700 bg-neutral-50 p-4 rounded overflow-auto">
                        {JSON.stringify(health, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
}