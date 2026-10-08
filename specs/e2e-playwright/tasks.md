# Tasks — Tarea 4.2 · Test E2E con Playwright

> **Spec**: `specs/e2e-playwright/spec.md` (aprobada 2026-10-07)
> **Rama**: `feat/e2e-playwright`

---

## 0. Aprobación

- [x] `plan.md` escrito
- [x] `spec.md` escrito
- [x] **Spec aprobada por el usuario** (2026-10-07) ⛔

---

## 1. Tooling (R1)

- [x] `npm i -D @playwright/test` en `frontend/`
- [x] Instalar navegadores: `npx playwright install chromium firefox webkit`
- [x] `frontend/playwright.config.ts`:
      `testDir` explícito · `projects` (3) · `workers: 1` ·
      `webServer` de producción · `reporter` (`html` + `list`) ·
      `retries` 0 local / 1 CI
- [x] `package.json`: script `test:e2e` (3 navegadores) y `test:e2e:quick`
      (sólo chromium)
- [x] **Vitest no cambia**: `npx vitest run` sigue en 270 / 38
- [x] `npx tsc --noEmit` → `0` con el config incluido

## 2. `globalSetup` (R2) — la pieza de riesgo

- [x] `e2e/helpers/db.ts` — cliente `pg` (`pg` en `devDependencies`)
- [x] `e2e/helpers/api.ts` — `fetch` crudo contra el backend + tipados mínimos
- [x] Readiness: sondeo `GET /api/v1/markets` con techo de **120 s** y mensaje
      accionable
- [x] Usuario idempotente: login ⇒ si `200` se salta; si no, register →
      **leer `verification_code` por SQL** → verify → login
- [x] Dirección por defecto sólo si no existe ninguna
- [x] **Reset de stock incondicional** a los valores **exactos** de `V1`
      (`843321900101`: **150/5** en `WH_ARTEIXO`, **80/0** en `WH_ZARAGOZA`)
      — **no** un `40` genérico, que era un error de la primera redacción
- [x] La compra usa la **talla M** (`843321900101`); la L no tiene stock
- [x] Cada paso con su propio techo de tiempo y mensaje de fallo
- [x] **Comprobación de idempotencia**: dos corridas seguidas en verde

## 3. Las pruebas (R3 + R4 + R5)

- [x] `e2e/smoke.spec.ts`
- [x] **R3 — compra completa**: portada → catálogo → ficha `0432/021` → talla →
      «Añadir a la bolsa» → badge `1` → `/cart` → «Finalizar compra» →
      **`ORD-…` visible** → recargar y seguir viéndolo (sin duplicar)
- [x] **R4.1** — carrito persiste tras recargar
- [x] **R4.2** — ruta protegida sin sesión → `/login`
- [x] **R4.3** — login muestra `PEDIDOS`/`CUENTA` · logout vuelve a
      `INICIAR SESIÓN`
- [x] **R4.4** — confirmación de añadido que desaparece sola con reloj real
- [x] `test.describe` por flujo, nombres en español, GIVEN-WHEN-THEN
- [x] **R5 — determinismo**: localizadores por rol/label · esperas
      condicionales · **cero `waitForTimeout`** (grep) · sin red externa ·
      ninguna prueba depende de otra

## 4. CI (R6)

- [x] `ci.yml`: job **`e2e-tests`** sin `needs:` (en paralelo)
- [x] `services.postgres` (`pgvector/pgvector:pg16`) con health check
- [x] JDK 21 + **Node 22** + `npm ci` (el mismo que `frontend-tests`)
- [x] Override `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` (mismo patrón que
      `backend-tests`)
- [x] Backend en segundo plano **+ espera de readiness**
- [x] `npx playwright install --with-deps chromium firefox webkit`
- [x] `npm run test:e2e`
- [x] Subida de `playwright-report/` con `if: always()`
- [x] `backend-tests` y `frontend-tests` **sin cambios**

## 5. Baselines (R7)

- [x] `npx tsc --noEmit` → `0`
- [x] `npx eslint src scripts` → **0 errores, 0 warnings** · sin `eslint-disable`
- [x] `npx vitest run` → **270 tests** (mismo número que al empezar)
- [x] `npm run test:coverage` → verde con `77 / 76 / 74 / 79`
- [x] `npm run build` → `0`
- [x] `npm run test:e2e` → verde en **Chromium y WebKit** en local, en **dos
      corridas consecutivas** (10/10). **Firefox se valida en CI** — su build
      no arranca en headless en este macOS (plan **D10**)
- [x] `git diff main --stat` **no toca `backend/`**
- [x] **Sin ADR** (R7)

## 6. Documentación y cierre (R8)

- [x] `spec.md` §4 — todos los criterios marcados en verde
- [x] `CHANGELOG.md` — entrada en `[Unreleased]`
- [x] `README.md` — cómo levantar y ejecutar `npm run test:e2e`
- [x] `AGENTS.md` — regla de E2E en *Testing* + bloque «ESTADO ACTUAL»
      redactado en la PR (verdad tras el merge, **sin PR ni SHA**)
- [x] `MEMORY.md` — Tarea 4.2 completada
- [x] **Sin PR de documentación de cierre** (D11 de la 3.3)
- [ ] **Preguntar al usuario antes** de cualquier commit y PR ⛔ *pendiente*
