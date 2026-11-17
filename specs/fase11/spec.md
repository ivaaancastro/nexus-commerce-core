# Fase 11 — Calidad final y CI/CD — spec

> **Estado**: borrador (pendiente de aprobación del usuario). Decisiones en `plan.md` (D1–D8) · checklist en `tasks.md`.

---

## 1. Requisitos funcionales

| # | Requisito |
|:--|:---|
| **R1** | **Job `deploy` en `.github/workflows/ci.yml`** que corre solo en `push` a `main` y **después** de que pasen los 4 jobs de calidad (`backend-tests`, `frontend-tests`, `e2e-tests`, `cwv-audit`). |
| **R2** | El job `deploy` **despliega el backend a Render** (despliegue del servicio definido en `render.yaml` vía API de Render con `RENDER_API_KEY` y `RENDER_BACKEND_SERVICE_ID`). |
| **R3** | El job `deploy` **despliega el frontend a Vercel** (Vercel ya despliega por integración Git en cada push a `main`; el job verifica que el despliegue está en marcha y reporta la URL). |
| **R4** | **Detección de secretos** en el árbol: `sk_`, `pk_`, `whsec_`, `JWT_SECRET` (y variantes de clave Stripe y JWT). El job falla si encuentra alguna coincidencia en ficheros rastreados por git. Sin excepciones documentadas. |
| **R5** | **Calidad final obligatoria antes del despliegue**: si cualquiera de los 4 jobs de calidad falla, el job `deploy` no se ejecuta (`needs:` con éxito requerido). |
| **R6** | **Variables de entorno del despliegue** como secrets de GitHub: `RENDER_API_KEY`, `RENDER_BACKEND_SERVICE_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Ninguna se versiona. |
| **R7** | El job `deploy` **no corre en PRs** (solo en `push` a `main`). |
| **R8** | **Verificación global post-despliegue**: tras desplegar, el job hace una petición de humo a `https://nexus-commerce-core.vercel.app/api/v1/markets` (o equivalente) y falla si no responde `200`. |
| **R9** | **CHANGELOG.md** actualizado con la entrada de la Fase 11 (Keep a Changelog es-ES, sección `[Unreleased]`). |
| **R10** | **Bloque «ESTADO ACTUAL» de `AGENTS.md`** reescrito para ser verdad después del merge (sin números de PR ni SHA). |
| **R11** | **`MEMORY.md`** marca la Fase 11 completada. |
| **R12** | **Sin ADR nuevo** (la topología de despliegue ya está documentada en ADR-0008; esta fase solo la automatiza). |
| **R13** | **Sin PR de documentación de cierre** (regla D11 de AGENTS.md). |

---

## 2. Requisitos no funcionales

| # | Requisito |
|:--|:---|
| **RNF1** | Los 4 jobs de calidad existentes **no cambian**: `backend-tests` (553 tests), `frontend-tests` (605 tests + cobertura + build), `e2e-tests` (33 rápido), `cwv-audit` (Lighthouse). |
| **RNF2** | `tsc` 0 · ESLint 0/0 · `build` 0 en `frontend/` antes de desplegar. |
| **RNF3** | `./mvnw clean test` en verde en `backend/` antes de desplegar (553 tests). |
| **RNF4** | Ninguna clave secreta en el repo: sin `sk_`, `pk_`, `whsec_`, `JWT_SECRET` en ficheros rastreados. |
| **RNF5** | El job `deploy` es **idempotente**: volver a dispararlo no duplica despliegues ni falla si ya está desplegado. |
| **RNF6** | Tiempo de despliegue razonable (< 5 min el job `deploy`, sin contar los jobs de calidad). |

---

## 3. API y cambios de código

| Endpoint / fichero | Cambio |
|:---|:---|
| `.github/workflows/ci.yml` | + job `deploy` (`push` a `main`, `needs:` a los 4 jobs de calidad) + paso de detección de secretos + verificación de humo post-despliegue. |
| `README.md` | Sección con los secretos de GitHub necesarios y cómo funciona el CD (aditivo, no borra nada). |
| `CHANGELOG.md` | Entrada en `[Unreleased]` con la Fase 11. |
| `AGENTS.md` | Bloque «ESTADO ACTUAL» actualizado (verdad tras el merge). |
| `MEMORY.md` | Fase 11 marcada como completada. |

Sin cambios en `backend/` ni en `frontend/` (solo CI y docs).

---

## 4. Detalles del job `deploy`

El job `deploy` se añade a `.github/workflows/ci.yml`:

```yaml
deploy:
    name: Despliegue a producción (Render + Vercel)
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests, e2e-tests, cwv-audit]
    if: github.ref == 'refs/heads/main'
    steps:
      - Checkout code
      - Detección de secretos (grep sk_/pk_/whsec_/JWT_SECRET)
      - Despliegue backend a Render (curl API de Render con RENDER_API_KEY + serviceId)
      - Despliegue/verificación frontend a Vercel (vercel CLI o API con VERCEL_TOKEN)
      - Verificación de humo: GET https://nexus-commerce-core.vercel.app/api/v1/markets → 200
```

- **Secrets de GitHub**: `RENDER_API_KEY`, `RENDER_BACKEND_SERVICE_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Si falta algún secreto, el job falla con mensaje claro (no se despliega a ciegas).
- La detección de secretos se hace antes de desplegar: si encuentra algo, se aborta sin tocar producción.

---

## 5. Criterios de aceptación

- [ ] Existe el job `deploy` en `.github/workflows/ci.yml` (solo `push` a `main`, `needs:` a los 4 jobs de calidad).
- [ ] El job despliega el backend a Render vía API (despliegue del servicio de `render.yaml`).
- [ ] El job despliega/verifica el frontend en Vercel.
- [ ] Paso de detección de secretos: falla si encuentra `sk_`, `pk_`, `whsec_` o `JWT_SECRET` en el árbol rastreado.
- [ ] Verificación de humo post-despliegue: `GET /api/v1/markets` → `200` en la URL de producción.
- [ ] Los 4 jobs de calidad existentes **no cambian** y siguen en verde.
- [ ] `tsc` 0 · ESLint 0/0 · `build` 0 en `frontend/` (verificado antes del despliegue).
- [ ] `./mvnw clean test` en verde en `backend/` (553 tests).
- [ ] Sin `sk_`, `pk_`, `whsec_`, `JWT_SECRET` en ficheros rastreados por git.
- [ ] `CHANGELOG.md` con entrada de la Fase 11.
- [ ] Bloque «ESTADO ACTUAL» de `AGENTS.md` redactado para ser verdad tras el merge.
- [ ] `MEMORY.md` marca la Fase 11 completada.
- [ ] **Sin ADR nuevo** · **sin PR de documentación de cierre**.
- [ ] `/spec-check fase11` aprobado.

---

## 6. Qué NO hace esta fase (fuera de alcance)

- Dominio propio de pago (se sigue usando `*.vercel.app`).
- Analytics, `/pricing`, monitorización externa, backups gestionados.
- i18n ES/EN (Fase 12, opcional).
- Lanzamiento LinkedIn (Fase 13).
- Cualquier cambio en `backend/` o `frontend/` (solo CI y docs).
