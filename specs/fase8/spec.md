# Spec — Fase 8: Operación interna y monitoring

> **Bloque fuera del V1–V6** · requisitos (R1–R6) y criterios de aceptación.
> Sin features de usuario, solo herramientas de operación.

---

## Resumen

`npm run build` y `./mvnw clean test` siguen siendo verdes.
Se añaden herramientas de observabilidad y mantenimiento, **sin nuevas funcionalidades de usuario**.

---

## R1 — Health check mejorado (extendido)

**Criterio**: `GET /api/v1/health` debe devolver no sólo "OK", sino también el estado de las dependencias críticas.

- **Endpoint**: `GET /api/v1/health` (ya existe, se extiende)
- **Respuesta esperada**:
  ```json
  {
    "status": "UP",
    "details": {
      "database": "UP",
      "pgvector": "UP",  // o el nombre que se use para la extensión
      "flyway": "V22 applied",
      "uptime_seconds": 3600
    }
  }
  ```
- **Si falla alguna dependencia**: `status: "DOWN"` y `details` indicando cuál.
- **Código HTTP**: Siempre `200` (es un status informativo, no un error de negocio).
- **Seguridad**: Detrás de `hasRole("ADMIN")` (misma regla que otros endpoints admin).

### Evidencia esperada
- Controller `HealthController` (o extensión al existente) que querye `JdbcTemplate.execute("SELECT 1")`, `Flyway info`, y `Runtime.getRuntime().totalMemory() / Runtime.getRuntime().freeMemory()`.
- Test `HealthControllerTest` con mocks que devuelva `status: "UP"` y `details` completos.
- `GET /api/v1/health` desde navegador o `curl` devuelve JSON coherente.

---

## R2 — Endpoint de métricas básicas

**Criterio**: Exposición de métricas básicas del sistema, sin configuración de Prometheus compleja.

- **Endpoint**: `GET /api/v1/metrics` (nuevo) o extensión a `/health`.
- **Respuesta esperada** (formato simplificado):
  ```json
  {
    "uptime_seconds": 7200,
    "active_sessions": 12,
    "total_requests_last_minute": 156,
    "failed_requests_last_minute": 3,
    "jvm_memory_used_mb": 256,
    "jvm_memory_max_mb": 512
  }
  ```
- **Campos obligatorios**: `uptime_seconds`.
- **Campos opcionales** (pueden ser `null` si no hay forma fácil de obtenerlos): `active_sessions`, `memory_mb`.
- **Actualización**: Datos en tiempo real (no cached de build time).
- **Seguridad**: `hasRole("ADMIN")`.

### Evidencia esperada
- Nuevo Controller o método en existente que reporte los valores anteriores.
- `curl http://localhost:8080/api/v1/metrics` devuelve JSON.
- Test de integración que verifique que el JSON tiene `uptime_seconds > 0`.

---

## R3 — Scripts de mantenimiento (bash)

**Criterio**: Tres scripts en `scripts/` que resuelvan tareas operativas comunes.

### R3.1 — `backup-db.sh`
- **Comando**: `pg_dump -U nexus -d nexus --no-owner --no-acl -Fc -f backups/backup-$(date +%Y%m%d).backup`
- **Rotación**: Se quedan los últimos 7 archivos ( `ls backups/ | wc -l` ≤ 7 → `find backups/ -name "backup-*.backup" -mtime +7 -delete`).
- **Seguridad**: La contraseña viene de `$PGPASSWORD` del entorno, **nunca** hardcodeada.
- **Uso**: `./scripts/backup-db.sh` → crea `backups/backup-20261029.backup`.
- **Evidence**: archivo `.backup` creado en `backups/` con fecha de hoy.

### R3.2 — `verify-consistency.sh`
- **Comando**: `psql -d nexus -c "SELECT count(*) FROM products WHERE stock < 0"`.
- **Salida esperada**: `0` (ningún producto con stock negativo).
- **Si hay resultados**: `echo "ALERT: X products con stock negativo"` y `exit 1`.
- **Si todo bien**: `echo "OK: todos los stocks son válidos"` y `exit 0`.
- **Uso**: `./scripts/verify-consistency.sh` → `OK` o `ALERT`.
- **Evidence**: script sale con `exit 0` y imprime el mensaje de OK.

### R3.3 — `cleanup-sessions.sh`
- **Comando**: `psql -d nexus -c "DELETE FROM oauth_access_tokens WHERE expired_at < now() - interval '30 days'"` (o la tabla que use el proyecto para sesiones).
- **Exclusión**: No toca las sesiones `admin@nexus.dev` ni `e2e@nexus.dev` (protección hardcodeada o por patrón de email).
- **Log**: `echo "Cleaned X expired sessions"`.
- **Uso**: `./scripts/cleanup-sessions.sh` → imprime cuántas sesiones se borraron.
- **Evidence**: número menor de sesiones viejas en la BD después de ejecutar.

---

## R4 — Logging estructurado (JSON)

**Criterio**: Los logs del backend deben outputarse en formato JSON para facilitar su consumo por herramientas de monitoreo.

- **Formato**: `log.info("mensaje", Map.of("campo1", valor1, "campo2", valor2))`.
- **Ejemplo** (en `ProductReviewController` o similar):
  ```java
  log.info("Opinión creada", Map.of(
      "event", "review_created",
      "product_id", productId,
      "user_email", userEmail,
      "timestamp", Instant.now().toString()
  ));
  ```
- **Que siga funcionando** `log.info("mensaje simple")` para logs internos (no rompe retrocompatibilidad).
- **En `application-production.properties`**: `logging.pattern.console=%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n` **se mantiene** o se ajusta para que coexistan.
- **No es obligatorio** convertir todo el código existente, sino añadir logging JSON en **nuevos endpoints** o **módulos nuevos** de la Fase 8.

### Evidencia esperada
- Al menos **un** controlador nuevo o método que use `log.info("msg", map)` con JSON.
- Search en código: `log.info(` con `Map.of` o nueva clase `LogEntry`.
- `grep -r "log.info" backend/src/main/java/ | grep -c "Map.of"` devuelve al menos 1.

---

## R5 — Dashboard operativo en frontend (opcional pero valorado)

**Criterio**: Un componente React/Vue sencillo en el admin que muestre el estado del sistema.

- **Ruta**: `/admin/system` o similar, detrás de `AdminRoute`.
- **Muestra**:
  - Estado de `health check` (UP/DOWN).
  - Última vez que se ejecutó `backup-db.sh` (fecha del último archivo en `backups/`).
  - Si `verify-consistency.sh` dió OK últimamente (fecha/hora).
- **No requiere API nueva** si los datos los dan los scripts + fecha de archivo.
- **Seguridad**: detrás de `hasRole("ADMIN")`, igual que `/admin/orders`, `/admin/users`.

### Evidencia esperada
- Componente `SystemStatus` en `src/admin/system/page.tsx` (o ruta similar).
- Pantalla accesible como admin que muestre indicadores verdes/rojos.
- Sin `console.error` al cargar.

---

## 6. Fuera de alcance

| Fuera de alcance | Justificación |
|:---|---|
| Nuevos endpoints públicos de API | Ya hay suficientes; esta fase es interna |
| Cambio de base de datos (PostgreSQL → otro) | Ya está elegida y configurada |
| Optimizaciones de performance profundas | Fuera del scope "operación", es "mejora" |
| Migración a contenedores (Docker/K8s) | Puede hacerse después, no bloquea Fase 8 |
| Rediseño de UI/UX en frontend | Fuera de scope; la UI actual ya es funcional |
| Nuevas integraciones con third-party (Sentry, Datadog, etc.) | Opcional y fuera de scope inmediato |

---