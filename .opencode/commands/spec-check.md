# Comando: spec-check

Verifica que el código implementado cumple lo especificado en `spec.md`.

## Uso

```
/spec-check <nombre-feature>
```

Ejemplo: `/spec-check user-auth`

## Qué hace

### Paso 1 — Localizar los artefactos

```bash
ls specs/<nombre-feature>/
```

Debe existir `plan.md`, `spec.md` y `tasks.md`. Si falta alguno, avisar.

### Paso 2 — Extraer requisitos de la spec

Leer `specs/<nombre-feature>/spec.md` y listar cada requisito numerado o con checkbox.

### Paso 3 — Verificar cada requisito contra el código

Para cada requisito, buscar evidencia concreta:

| Tipo de requisito | Cómo verificar |
|:---|:---|
| Endpoint API | ¿Existe en el controller? ¿El método y ruta coinciden? |
| Entidad / campo | ¿Existe el campo en la entidad JPA? |
| Regla de negocio | ¿Hay validación o test que lo demuestre? |
| Criterio de aceptación | ¿Existe test que lo cubra? |
| UI / componente | ¿Existe el componente o ruta? |

Buscar con `grep` y `glob`. No asumir: cada requisito necesita evidencia.

### Paso 4 — Revisar tareas pendientes

```bash
grep -c "^- \[ \]" specs/<nombre-feature>/tasks.md
```

Reportar cuántas quedan sin marcar.

### Paso 5 — Ejecutar tests

```bash
cd backend && ./mvnw test
cd frontend && npx vitest run
```

### Paso 6 — Reporte

Presentar tabla:

| # | Requisito | Estado | Evidencia |
|:--|:---|:---|:---|
| 1 | Registro con email | ✅ | `AuthController.register()`, `AuthServiceTest` |
| 2 | Verificación por código | ✅ | `verifyEmail()` |
| 3 | Login social | ❌ | No implementado (fuera de alcance) |

## Formato de salida

```
## Verificación: <feature>

**Requisitos**: X/Y implementados
**Tareas pendientes**: N
**Tests**: ✅ pasan / ❌ fallan

### Cumple
- [x] Requisito 1 — evidencia
- [x] Requisito 2 — evidencia

### No cumple
- [ ] Requisito 3 — falta <qué>

### Fuera de alcance (documentado en plan.md)
- Requisito N — excluido explícitamente

### Veredicto
✅ APROBADO para /spec-close
   o
❌ BLOQUEADO — implementar lo pendiente antes de cerrar
```

## Notas

- No modificar código durante el check. Solo reportar.
- Si un requisito cambió durante la implementación, **actualizar `spec.md` primero** (regla 3 del workflow).
- Si el alcance cambió de verdad,_require_ nueva aprobación del usuario.
- Los requisitos explícitamente excluidos en `plan.md` no cuentan como shortfall.
