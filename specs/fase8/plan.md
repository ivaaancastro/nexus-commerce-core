# Plan — Fase 8: Operación interna y monitoring

> **Bloque fuera del V1–V6** · fase de operación, no de features de usuario.
> El objetivo es dejar el proyecto listo para operación diaria por parte del equipo
> interno, con herramientas de observabilidad y mantenimiento.

---

## 1. Objetivo

Dejar el proyecto **listo para operación interna** sin funcionalidad nueva de usuario.
El sistema ya tiene todas las features (V1–V6) completadas y mergeadas a `main`.
Esta fase se enfoca en:

- **Observability**: Saber si el sistema va bien en tiempo real.
- **Maintenance**: Herramientas para tareas rutinarias (backups, verificaciones).
- **Onboarding**: Que un nuevo desarrollador pueda coger el proyecto y entender cómo operarlo.
- **Sin venta**: No hay preparación para venta (PSP inexistente), el proyecto ya está en `main` y funcional.

---

## 2. Decisiones de diseño (D1–D3)

### D1 — Sin features de usuario, solo operatividad

- **No se añaden endpoints públicos** nuevos para el usuario final.
- **Sí se añaden endpoints internos/ de admin** para monitoreo y mantenimiento.
- **La seguridad mantiene** `hasRole("ADMIN")` en los nuevos endpoints operativos.
- **El frontend no cambia** (o cambia mínimamente, solo nuevos componentes de dashboard operativo).

### D2 — Monitoring sobre nuevos endpoints

- **`GET /api/v1/health` ya existe** (Fase 6 D7) → se extiende para incluir dependencias.
- **No se añade `actuator` de Spring Boot** (ya configurado o decisión deliberada).
- **Métricas básicas** en `/api/v1/metrics` o endpoint similar, sin Prometheus/Grafana Complejo.
- **Logs estructurados** (JSON) como estándar para que cualquier herramienta pueda leerlas.

### D3 — Scripts de mantenimiento, no migraciones

- **Scripts en `scripts/`** (bash) para tareas rutinarias.
- **No hay migraciones Flyway nuevas** a menos que sea para añadir tablas de log si se requiere.
- **Idempotencia**: los scripts pueden ejecutarse varias veces sin daño.
- **Cero impacto en el negocio**: las tareas no tocan datos de pedidos, usuarios, productos (salvo mantenimiento puro).

---

## 3. Alcance y no-alcance

| En alcance | Fuera de alcance |
|:---|:---|
| Health check mejorado | Nuevas funcionalidades de usuario |
| Scripts de backup/verify | Nuevos endpoints públicos de API |
| Métricas básicas de sistema | Mejoras de performance profundas |
| Logs estructurados | Rediseño de UI/UX |
| Tareas de limpieza | Cambio de arquitectura |

---

## 4. Estimación y orden de trabajo

| # | Bloque | Contenido |
|:-:|:---|---|
| 1 | **Health check extendido** | Mejoras a `/api/v1/health` con dependencias |
| 2 | **Endpoint de métricas básicas** | `/api/v1/metrics` o endpoint similar |
| 3 | **Scripts de mantenimiento** | `backup-db.sh`, `verify-consistency.sh`, `cleanup-sessions.sh` |
| 4 | **Logging estructurado** | Formato JSON en logs del backend |
| 5 | **Dashboard operativo** | Componente frontend simple en `/admin` o página interna |

**Observación**: Estimación **S** (pequeña) — todas las tareas pueden completarse en 1-2 días de trabajo.

---

## 5. Riesgos identificados

| Riesgo | Mitigación |
|:---|---|
| **Script rompe la BD** | Se ejecuta en entorno de staging primero; `verify-consistency.sh` validación previa |
| **Logs JSON rompen lectores humanos** | Opcional: mantener ambos formatos durante una transición de 2 semanas |
| **Endpoints de monitoring expuestos** | Atrás de `hasRole("ADMIN")`, sin `permitAll` |
| **Medir bien el alcance** | Tener claro que esto es "operación", no "features"; evitar scope creep |

---