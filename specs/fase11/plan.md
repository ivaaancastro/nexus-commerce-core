# Fase 11 — Calidad final y CI/CD 🟠 — plan

> **Estado**: borrador (pendiente de aprobación del usuario). Decisiones y criterios de aceptación en `spec.md`.

## 1. Objetivo

Dejar el proyecto listo para el **lanzamiento (Fase 13 LinkedIn)** con:

1. **CD desde GitHub Actions**: despliegue automático del backend (Render) y del frontend (Vercel) tras un merge a `main`, sin pasos manuales del desarrollador en los paneles de cada proveedor.
2. **Calidad final**: detección de secretos en el repo (`sk_`, `pk_`, `whsec_`, `JWT_SECRET`), verificación global (tests, cobertura, lint, build, E2E, auditoría) y documentación de cierre (CHANGELOG, estado de AGENTS.md).

El proyecto ya está desplegado en producción (Vercel + Render + Neon, verificado 2026-11-16). Esta fase automatiza el despliegue futuro y cierra la calidad antes del anuncio público.

## 2. Situación de partida (medida en el código, hoy)

| Hecho | Consecuencia |
|:---|:---|
| Despliegue en producción verificado (Vercel + Render + Neon + Stripe test mode) | Ya existe `docs/deployment.md` con los pasos manuales (Neon → Render → Vercel → Stripe) |
| `ci.yml` tiene 4 jobs (`backend-tests`, `frontend-tests`, `e2e-tests`, `cwv-audit`), todos en `pull_request` y `push` a `main` | CI ya corre, pero **no despliega**: cada merge requiere ir a Render y Vercel a disparar el despliegue |
| No hay detección de secretos en el pipeline | `git log` y `git diff` podrían haber dejado claves (`sk_`, `pk_`, `whsec_`, `JWT_SECRET`) en commits históricos o en el árbol |
| README reescrito (PR #52) y fix de navbar (PR #53) ya en `main` | Fase 10 cerrada; todo el trabajo de contenido está hecho |
| `AGENTS.md` desactualizado: todavía dice que la Fase 10 está pendiente | Hay que reescribir el bloque «ESTADO ACTUAL» para que sea verdad tras el merge |

## 3. Decisiones de diseño

| # | Decisión | Justificación / alternativa descartada |
|:--|:---|:---|
| **D1** | **CD en `ci.yml`**: job `deploy` que corre solo en `push` a `main` (no en PR) y **después** de que los 4 jobs de calidad pasen (`needs: [backend-tests, frontend-tests, e2e-tests, cwv-audit]`). Despliega backend a Render y frontend a Vercel. | Hacer el despliegue en cada PR es peligroso (se desplegaría código no revisado). Hacerlo solo en `main` es el modelo estándar de GitHub Flow. |
| **D2** | **Render**: `render.yaml` ya existe (Fase 10 PR A). El job `deploy` usa `curl` contra la API de Render para disparar un *deploy* del servicio backend (`render.yaml` define el servicio; se necesita `RENDER_API_KEY` y el `serviceId`). | Render no tiene una Action oficial mantenida; `curl` a su API es lo más ligero y no añade dependencias nuevas. |
| **D3** | **Vercel**: el frontend ya está conectado a Vercel por integración Git (despliegue automático en cada push a `main`). El job `deploy` solo **notifica/verifica** que el despliegue de Vercel ocurrió (consulta la API de despliegues de Vercel o usa `vercel`). | Si ya está conectado por Git, no hace falta una Action adicional. El job de CI solo confirma que el despliegue está en marcha y verifica la URL. |
| **D4** | **Detección de secretos**: job `secret-scan` (o paso dentro del job de calidad) que busca `sk_`, `pk_`, `whsec_`, `JWT_SECRET` en el árbol con `git grep`/`grep -R` y falla si encuentra alguno. Excepciones documentadas: ninguno (ninguna clave debe estar en el repo). | `truffleHog`/`gitleaf` añaden dependencia y config. `grep` es suficiente, determinista y no trae nuevas herramientas. |
| **D5** | **Calidad final obligatoria antes del despliegue**: el job `deploy` tiene `needs:` a los 4 jobs de calidad. Si cualquiera falla, no se despliega. | Evita desplegar una regresión a producción. |
| **D6** | **Secreto de JWT en producción**: ya existe `JwtSecretGuard` (aborta si el secreto es el del repo o < 32 bytes). En CI de calidad no se usa `prod` (se usa el perfil por defecto); solo en `deploy` se pasan las variables reales. | Coherente con la Fase 10 PR A. |
| **D7** | **Variables de entorno del despliegue**: `RENDER_API_KEY`, `RENDER_BACKEND_SERVICE_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` como secrets de GitHub. Ninguna se versiona. | Estándar de GitHub Actions. |
| **D8** | **Fuera de alcance**: dominios propios, monitoreo externo, backups gestionados, i18n (Fase 12), dominio propio de pago. Se declara para no reabrirlo. | Ya declarado fuera de alcance en la Fase 10 (§7 y D13). |

## 4. Riesgos

| Riesgo | Mitigación |
|:---|:---|
| `RENDER_API_KEY` o `VERCEL_TOKEN` expuestos en logs | No se imprime nunca; se usan solo en las llamadas a API. |
| Despliegue de Render falla (backend duerme, OOM, variables faltantes) | El job `deploy` informa el fallo; el despliegue de Vercel es independiente. Se documenta cómo revisar los logs de Render. |
| Detección de secrestos encuentra algo legítimo (ej. ejemplos en docs) | Se revisa a mano antes de aprobar; si hay un ejemplo necesario, se documenta como excepción con comentario. |
| El job `deploy` se dispara en cada `push` a `main` aunque solo cambie docs | `needs:` a los 4 jobs de calidad + `if: github.ref == 'refs/heads/main'`. Se puede añadir `paths:` para ignorar solo `docs/` y `README.md`, pero se deja desplegar siempre por simplicidad y para que el README esté siempre actualizado en producción. |

## 5. Estimación

~1 jornada: job `deploy` (Render + Vercel), paso de detección de secretos, verificación global, CHANGELOG, bloque de estado de AGENTS.md.

---

Pendiente de aprobación del usuario antes de escribir `spec.md` y `tasks.md`.
