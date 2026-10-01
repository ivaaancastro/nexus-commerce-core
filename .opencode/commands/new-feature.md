# Comando: new-feature

Inicia una feature siguiendo el ciclo SDD. Crea rama y estructura de spec.

## Uso

```
/new-feature <nombre-descriptivo>
```

Ejemplos: `/new-feature user-profile`, `/new-feature cart-drawer`, `/new-feature size-recommendation`

## Flujo

Este comando cubre los pasos **1, 2 y 4** del ciclo SDD. El paso **3 (aprobación)** lo hace el usuario.

```
PLAN ──► SPEC ──► ⛔ APROBACIÓN ──► TASKS
  1      2            3              4
```

## Paso 1 — Crear rama

```bash
git checkout main && git pull
git checkout -b feat/<nombre-descriptivo>
```

## Paso 2 — Crear estructura

```bash
mkdir -p specs/<nombre-descriptivo>
```

## Paso 3 — Escribir `plan.md`

Responder antes de escribir:
1. ¿Qué problema resuelve?
2. ¿Por qué ahora?
3. ¿Qué alternativas se consideraron?
4. ¿Qué queda fuera de alcance?

```markdown
# Plan: <título>

> **Estado**: EN PLANIFICACIÓN
> **Fecha**: <YYYY-MM-DD>
> **Rama**: `feat/<nombre>`

## 1. Objetivos
## 2. No-Objetivos
## 3. Decisiones de Diseño
## 4. Orden de Implementación
## 5. Criterios de Aceptación
## 6. Estimación
```

## Paso 4 — Escribir `spec.md`

Especificación técnica. Debe incluir:
- Requisitos funcionales numerados
- API endpoints (o "no aplica")
- Modelo de datos (o "no aplica")
- Criterios de aceptación verificables
- Casos de error

```markdown
# Spec: <título>

> **Estado**: PENDIENTE DE APROBACIÓN
> **Fecha**: <YYYY-MM-DD>

## 1. Requisitos
### R1 — <nombre>
### R2 — <nombre>

## 2. API
## 3. Modelo de Datos
## 4. Criterios de Aceptación
## 5. Casos de Error
```

## Paso 5 — ⛔ PEDIR APROBACIÓN

Detenerse aquí. Presentar resumen de `plan.md` y `spec.md` y preguntar:

> "Esta spec refleja lo que quieres construir. ¿La apruebas para pasar a implementación?"

**No escribir código hasta que el usuario apruebe.**

## Paso 6 — Escribir `tasks.md` (tras aprobación)

```markdown
# Tasks: <título>

> **Estado**: PENDIENTE
> **Fecha**: <YYYY-MM-DD>
> **Rama**: `feat/<nombre>`

## Backend
- [ ] ...

## Frontend
- [ ] ...

## Tests
- [ ] ...

## Docs
- [ ] CHANGELOG actualizado
- [ ] ADR (si aplica)
```

Desglosar `spec.md` en pasos concretos y verificables.

## Paso 7 — Actualizar estado

- `AGENTS.md` → actualizar bloque ⚡ ESTADO ACTUAL
- `MEMORY.md` → añadir a tareas pendientes

## Notas

- Los requisitos de `spec.md` deben ser **verificables** con `grep` o un test.
- Si durante la implementación cambia el alcance: actualizar `spec.md` y volver a pedir aprobación.
- ¿La feature cambia arquitectura o stack? Entonces necesita ADR.
