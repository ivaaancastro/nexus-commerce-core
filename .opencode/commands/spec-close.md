# Comando: spec-close

Cierra una feature: verifica, documenta y prepara el PR.

## Uso

```
/spec-close <nombre-feature>
```

Ejemplo: `/spec-close user-auth`

## Precondición

**Debe existir `/spec-check <feature>` en verde.** Si no, ejecutarlo primero y no continuar.

## Pasos

### Paso 1 — Verificación previa

Confirmar que:
- [ ] `/spec-check` reportó ✅
- [ ] No hay tareas pendientes en `tasks.md`
- [ ] Rama actual es la de la feature

```bash
git branch --show-current
grep -c "^- \[ \]" specs/<feature>/tasks.md
```

### Paso 2 — Tests en verde

```bash
cd backend && ./mvnw clean test
cd frontend && npx vitest run
cd frontend && npm run build
```

Si algo falla, **parar aquí** y reportar.

### Paso 3 — Revisar código limpio

```bash
grep -rn "TODO\|FIXME\|console.log\|debugger" backend/src frontend/src
```

Debe estar limpio. Si hay debug leftover, quitarlo.

### Paso 4 — Actualizar CHANGELOG.md

Añadir entrada en `## [Unreleased]` → `### Added` / `### Changed` / `### Fixed`.

Formato: `- **Descripción** de lo que hace.`

### Paso 5 — Marcar spec como completada

En `specs/<feature>/tasks.md`:
- Cambiar `> **Estado**: PENDIENTE` → `COMPLETADA`
- Añadir fecha de cierre

### Paso 6 — Actualizar AGENTS.md y MEMORY.md

- `AGENTS.md` → actualizar bloque ⚡ ESTADO ACTUAL con la nueva tarea siguiente
- `MEMORY.md` → mover la feature a "Tareas Completadas", actualizar fecha

### Paso 7 — Evaluar necesidad de ADR

Preguntar: ¿esta feature cambió arquitectura, stack, modelo de datos o patrones?

- **Sí** → crear `docs/adr/NNNN-nombre.md` (Contexto → Decisión → Alternativas → Consecuencias)
- **No** → continuar

### Paso 8 — Commit

```bash
git add -A
git commit -m "feat(<scope>): <descripción de la feature>"
```

Preguntar al usuario **antes** de ejecutar el commit.

### Paso 9 — Push y PR

```bash
git push -u origin <rama>
gh pr create --base <destino> --head <rama> \
  --title "feat(<scope>): <descripción>" \
  --body "$(cat specs/<feature>/plan.md)"
```

## Checklist final

Antes de reportar completado:

- [ ] `/spec-check` en verde
- [ ] Tests backend pasan
- [ ] Tests frontend pasan
- [ ] Build de producción correcto
- [ ] Sin TODO/FIXME/console.log
- [ ] CHANGELOG actualizado
- [ ] `tasks.md` marcado como COMPLETADA
- [ ] AGENTS.md y MEMORY.md actualizados
- [ ] ADR creado si aplica
- [ ] Commit con formato convencional
- [ ] PR creado

## Salida esperada

```
✅ Feature <nombre> cerrada

- Tests: 38 backend + 27 frontend
- Requisitos: 12/12 implementados
- ADR: no necesario
- Commit: <hash>
- PR: <url>

Siguiente paso: <siguiente feature del roadmap>
```
