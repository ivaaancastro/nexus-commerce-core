# Comando: new-feature

Crea la estructura completa para un nuevo feat: rama, specs y actualización de memoria.

## Uso

```
/new-feature <nombre-descriptivo>
```

Ejemplo: `/new-feature user-profile`

## Pasos

1. **Crear rama** desde `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/<nombre-descriptivo>
   ```

2. **Crear estructura de specs**:
   ```
   specs/<nombre-descriptivo>/
   ├── plan.md    → Objetivos, decisiones, orden de implementación
   ├── spec.md    → Especificación técnica, API, tests
   └── tasks.md   → Checklist de tareas
   ```

3. **Actualizar MEMORY.md** con la nueva tarea en "Tareas Pendientes"

4. **Actualizar docs/constitution.md** si hay cambios en arquitectura o stack

## Plantilla para plan.md

```markdown
# Plan: <título del feat>

> **Estado**: PENDIENTE
> **Fecha**: <fecha actual>
> **Rama**: `feat/<nombre-descriptivo>`

## 1. Objetivos
- ...

## 2. No-Objetivos
- ...

## 3. Decisiones de Diseño
- ...

## 4. Orden de Implementación
1. ...
2. ...

## 5. Criterios de Aceptación
- [ ] ...

## 6. Estimación
- **Total**: X-Y horas
```

## Plantilla para tasks.md

```markdown
# Tasks: <título del feat>

> **Estado**: PENDIENTE
> **Fecha**: <fecha actual>
> **Rama**: `feat/<nombre-descriptivo>`

## Backend
- [ ] ...

## Frontend
- [ ] ...

## Tests
- [ ] ...
```

## Notas

- Seguir las convenciones de `AGENTS.md`
- Actualizar `MEMORY.md` al completar cada tarea
- Crear PR al rama padre cuando esté completo
