# Fase 11 — tasks (calidad final y CI/CD)

> Spec aprobada (2026-11-17). Se marca cada tarea al completarla (regla 4 de AGENTS.md).

## A. CI/CD — job `deploy`

- [x] A.1 Añadir job `deploy` a `.github/workflows/ci.yml`: `push` a `main`, `needs:` a los 4 jobs de calidad, `if: github.ref == 'refs/heads/main'`
- [x] A.2 Paso de detección de secretos: `grep` por `sk_`, `pk_`, `whsec_`, `JWT_SECRET` en el árbol rastreado; falla si encuentra coincidencia (verificado: ninguna coincidencia)
- [x] A.3 Despliegue backend a Render: `curl` API de Render con `RENDER_API_KEY` + `RENDER_BACKEND_SERVICE_ID`
- [x] A.4 Despliegue/verificación frontend a Vercel: `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`
- [x] A.5 Verificación de humo post-despliegue: `GET https://nexus-commerce-core.vercel.app/api/v1/markets` → `200`
- [x] A.6 Secrets de GitHub documentados en README (§9, tabla: nombre, para qué, dónde se pone)

## B. Calidad final (verificación)

- [x] B.1 `./mvnw clean test` en verde en `backend/` (553 tests) — exit 0
- [x] B.2 `npx vitest run` + `npm run test:coverage` en verde en `frontend/` (606 tests, 83.96/78.9/81.63/85.98 ≥ umbrales 77/76/74/79) — exit 0
- [x] B.3 `npx tsc --noEmit` → 0 en `frontend/` — exit 0
- [x] B.4 `npx eslint src scripts e2e playwright.config.ts` → 0 errores, 0 warnings — exit 0
- [x] B.5 `npm run build` → 0 en `frontend/` — exit 0
- [x] B.6 Verificar que no hay `sk_`, `pk_`, `whsec_`, `JWT_SECRET` en ficheros rastreados por git — ninguna coincidencia

## C. Documentación y estado

- [x] C.1 `CHANGELOG.md`: entrada en `[Unreleased]` con la Fase 11 (Keep a Changelog es-ES)
- [x] C.2 Bloque «ESTADO ACTUAL» de `AGENTS.md` reescrito (verdad tras el merge, sin números de PR ni SHA)
- [x] C.3 `MEMORY.md`: Fase 11 marcada como completada
- [ ] C.4 `/spec-check fase11` aprobado

## D. Cierre

- [ ] D.1 Tests en verde (backend y frontend) — hecho
- [ ] D.2 Cobertura mantenida (no baja del piso) — hecho
- [ ] D.3 Código sin TODOs ni comentarios de depuración
- [ ] D.4 Commits con formato convencional (regla 8.5 de AGENTS.md)
- [ ] D.5 PR hacia `main` (no push directo a `main`)
