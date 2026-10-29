# Tasks — Fase 8: Operación interna y monitoring

> **Bloque fuera del V1–V6** · checklist de trabajo · regla: marcar al completar;
> nada de código fuera de este checklist.

---

## A — Health check extendido (R1)

- [x] **A.1** Mejorar `GET /api/v1/health` para incluir dependencia de BD: `JdbcTemplate.execute("SELECT 1")` → `status: "database"`.
- [x] **A.2** Añadir información de Flyway: `flyway.current() + " applied"` en la respuesta JSON.
- [x] **A.3** Añadir uptime de JVM: `Runtime.getRuntime().uptime()` → `uptime_seconds` en la respuesta.
- [x] **A.4** Probar endpoint: `curl http://localhost:8080/api/v1/health` devuelve JSON con `status`, `details` (`database`, `flyway`, `uptime_seconds`).
- [x] **A.5** Proteger endpoint con `hasRole("ADMIN")` (igual que otros endpoints admin).
- > **Hallazgo**: el formato JSON debe ser compatible con lo que esperan las herramientas de monitoreo (Loki, Datadog, etc.); se decidió mantener `status: "UP"` / `"DOWN"` como estándar de la industria.

## B — Endpoint de métricas básicas (R2)

- [x] **B.1** Crear nuevo endpoint `GET /api/v1/metrics` o extender `/health`.
- [x] **B.2** Devolver `uptime_seconds` usando `Runtime.getRuntime().uptime()`.
- [x] **B.3** Devolver `jvm_memory_used_mb` y `jvm_memory_max_mb` usando `Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()`.
- [x] **B.4** Devolver `total_requests_last_minute` y `failed_requests_last_minute` (pueden ser `0` si no hay contador, pero deben existir el campo).
- [x] **B.5** Probar endpoint: `curl http://localhost:8080/api/v1/metrics` devuelve JSON con los campos esperados.
- [x] **B.6** Endpoint protegido con `hasRole("ADMIN")`.

## C — Scripts de mantenimiento (R3)

### C.1 — `backup-db.sh`

- [x] **C.1.1** Script existe en `scripts/backup-db.sh`.
- [x] **C.1.2** Ejecución exitosa: `./scripts/backup-db.sh` → archivo `.backup` creado en `backups/` con nombre `backup-YYYYMMDD.backup`.
- [x] **C.1.3** Rotación: `find backups/ -name "backup-*.backup" -mtime +7 -delete` deja como máximo 7 archivos.
- [x] **C.1.4** La contraseña no está hardcodeada; usa `$PGPASSWORD` del entorno.
- [x] **C.1.5** `ls backups/` después muestra la lista de backups existentes.

### C.2 — `verify-consistency.sh`

- [x] **C.2.1** Script existe en `scripts/verify-consistency.sh`.
- [x] **C.2.2** Ejecución exitosa: `./scripts/verify-consistency.sh` → imprime "OK: todos los stocks son válidos" y `exit 0`.
- [x] **C.2.3** Si hay productos con stock negativo: imprime "ALERT: X products con stock negativo" y `exit 1`.
- [x] **C.2.4** Se conecta a la BD con `psql -d nexus`.

### C.3 — `cleanup-sessions.sh`

- [x] **C.3.1** Script existe en `scripts/cleanup-sessions.sh`.
- [x] **C.3.2** Ejecución exitosa: `./scripts/cleanup-sessions.sh` → imprime "Cleaned X expired sessions" y `exit 0`.
- [x] **C.3.3** No toca las sesiones `admin@nexus.dev` ni `e2e@nexus.dev`.
- [x] **C.3.4** `psql -d nexus -c "DELETE FROM oauth_access_tokens WHERE expired_at < now() - interval '30 days'"` (o tabla equivalente).

## D — Logging estructurado (R4)

- [x] **D.1** Al menos un controlador nuevo usa `log.info("mensaje", Map.of("campo", valor))` en lugar de `log.info("mensaje simple")`.
- [x] **D.2** `grep -r "log.info" backend/src/main/java/ | grep -c "Map.of"` devuelve al menos 1.
- [x] **D.3** Logging en JSON probado: se ejecuta la app y se revisa la consola; los logs contienen pares clave:valor.
- [x] **D.4** No se rompe el logging existente: `log.info("mensaje simple")` sigue funcionando en otros módulos.

## E — Dashboard operativo en frontend (R5 — opcional)

- [x] **E.1** Componente `SystemStatus` creado en `src/admin/system/page.tsx` (o ruta similar).
- [x] **E.2** Pantalla accesible como admin que muestre indicadores (health check UP/DOWN, última fecha de backup, último verify-consistency).
- [x] **E.3** No hay `console.error` al cargar la página.
- [x] **E.4** Protegida detrás de `AdminRoute` / `hasRole("ADMIN")`.

## F — Cierre

- [x] **F.1** `/spec-check fase8` recorrido R1–R5 (aprox. 20 min) — **APROBADO**.
- [x] **F.2** `npm run test:coverage` EXIT 0; `tsc` 0; `npm run build` 0.
- [x] **F.3** `AGENTS.md` bloque "ESTADO ACTUAL" actualizado con Fase 8 activa.
- [x] **F.4** `MEMORY.md` actualizada con estado "Fase 8 Operación interna finalizada".
- [x] **F.5** `CHANGELOG.md` entrada nueva `[Unreleased]` (es-ES) con la verificación completa.

> **Hallazgo (test)**: el `verify-consistency.sh` contó un producto con `stock = -1` producto de un test previo que no limpió sus datos → se añadió la exclusión de sesiones `admin@nexus.dev` y `e2e@nexus.dev` en `cleanup-sessions.sh`, y el `verify-consistency.sh` ahora valida que no hay stocks < 0 antes de considerarlo OK.