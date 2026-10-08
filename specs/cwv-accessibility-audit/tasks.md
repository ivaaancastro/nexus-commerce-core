# Tasks — Tarea 4.3: Auditoría Core Web Vitals y Accesibilidad

> Spec: `spec.md` (R1–R7 · 58 criterios) · decisiones: `plan.md` (D1–D11).
> Regla: marcar cada tarea al completarla. **Nada de código antes de aprobación** — ✅ concedida.

---

## §1 — Instrumentación local *(R1)*

- [x] `@axe-core/playwright` en `devDependencies`
- [x] `@lhci/cli` en `devDependencies` (arrastra `lighthouse`)
- [x] `frontend/lighthouserc.json` con `collect` / `assert` / `upload`
- [x] El presupuesto vive en `lighthouserc.json`, **no** en flags de script
- [x] Scripts `audit:a11y`, `audit:cwv` y `audit` en `package.json`
- [x] Lighthouse resuelve el **Chrome for Testing de Playwright** vía `CHROME_PATH`
      (sin descargar navegador nuevo)
- [x] `collect.settings.chromeFlags: "--no-sandbox"` — **CI**: sin él Chrome no
      arranca en el runner (Ubuntu 24.04 + AppArmor). Probado en las dos
      direcciones
- [x] `scripts/lighthouse.mjs` **comprueba el puerto antes de lanzar** y aborta
      con `exit 1` si algo ya escucha. Probado con el puerto ocupado (`exit 1`),
      con `assert` (`exit 0`) y con una carrera completa (`exit 0`)
- [x] Documentación de limpieza **corregida**: `pkill -f "next-server"`, no
      `next start` (que no mata nada)
- [x] `npx tsc --noEmit` → `0` con la config nueva
- [x] `npx eslint` sobre los ficheros nuevos → **0 / 0**

---

## §2 — Espec de axe *(R2)*

- [x] `frontend/e2e/a11y.spec.ts`
- [x] Helper que lanza `AxeBuilder` y filtra por severidad
      (`critical`/`serious` = bloqueante; `moderate`/`minor` = informado)
- [x] **14 tests**, uno por ruta:
- [x] `/` · `/catalog` · `/search`
- [x] `/cart` · `/login` · `/register` · `/verify-email` · `/forgot-password`
- [x] `/products/[reference]` → semilla `0432/021`
- [x] `/orders` · `/profile` · `/addresses` (sesión de `globalSetup`)
- [x] `/orders/[orderNumber]` · `/receipt/[orderNumber]` → **pedido real por API**
- [x] `test.skip` en Firefox y WebKit **con el motivo comentado en el fichero**
- [x] `moderate`/`minor` **se imprimen en el log**, no se descartan
- [x] Sin `eslint-disable` ni suppressions de axe
- [x] `smoke.spec.ts` **intacto**
- [x] La espec pasa en local (`--project=chromium`)

---

## §3 — Presupuesto CWV *(R3)*

- [x] El stack real está levantado (Postgres + backend + `npm run build`)
- [x] `CHROME_PATH` apunta al Chrome for Testing de Playwright
- [x] **Primera medición**: `npm run audit:cwv` con `assert` vacío →
      **capturar resultados**
- [x] Decidir, sobre lo medido, **qué métricas entran** y con qué valor
      (**D1**, **D8**): LCP y CLS seguro; el resto según fiabilidad observada
- [x] **Escribir las métricas congeladas en `spec.md` R3** (regla 3)
- [x] Rellenar `assert` en `lighthouserc.json` con esos valores
- [x] `numberOfRuns: 3` (mediana) configurado
- [x] Re-ejecutar → **verde**
- [x] Las 4 rutas auditadas: `/`, `/catalog`, `/products/0432/021`, `/login`
- [x] **Backend real levantado durante la medición** (no un estado de error)

---

## §4 — Corrección acotada *(R5)* — **sólo si hace falta**

- [x] Ejecutar axe sobre las 14 rutas y **listar hallazgos con severidad y ruta**
- [x] **0 `critical` + 0 `serious`** → corregir cada uno
- [x] Cada corrección **sin cambiar ningún test preexistente** (criterio de la 4.1)
- [x] Hallazgos **descartados** → justificación escrita en `spec.md R5`
- [x] Hallazgos que exigan rediseño → **fuera de alcance**, umbral por encima de
      lo actual **con su justificación**
- [x] Sin `eslint-disable`, sin suppressions de axe
- [x] **Ningún cambio en `backend/`**

---

## §5 — Job de CI `cwv-audit` *(R4)*

- [x] Job `cwv-audit` en `.github/workflows/ci.yml`, **sin `needs:`**
- [x] `services.postgres` con health check (espejo de `backend-tests`)
- [x] **Override `SPRING_DATASOURCE_*` en el paso que arranca el backend**
      (no en el de espera)
- [x] Espera de readiness con **volcado de `/tmp/backend.log` si se agota**
- [x] `npm ci` → `npx playwright install --with-deps chromium` →
      **`npm run audit:cwv`** — *sin un `npm run build` aparte*: el build vive
      dentro de `audit:cwv`, y correr **exactamente el mismo comando en local y
      en CI** es lo que hace que «verde en mi máquina» y «verde en CI»
      signifiquen lo mismo (un build duplicado eran ~40 s perdidos y dos
      secuencias distintas que podían divergir)
- [x] Inyección de `CHROME_PATH` del navegador de Playwright vía
      `scripts/lighthouse.mjs` (resuelve `chromium.executablePath()`), más su
      instalación en el job con `npx playwright install --with-deps chromium`
- [x] Informe de Lighthouse subido con **`if: always()`**
- [x] `backend-tests`, `frontend-tests` y `e2e-tests` **sin cambios**
      (comprobado: **byte-idénticos a `main`**, 0 líneas borradas)
- [x] **axe sigue dentro de `e2e-tests`** (no crea job propio): el
      `testDir: "./e2e"` sin `testMatch` ya recoge `a11y.spec.ts`
- [x] El YAML parsea (comprobación con `js-yaml`, como en la 4.2)

---

## §6 — Baselines *(R6)*

- [x] `git diff main --stat -- backend/` → **vacío**
- [x] `npx tsc --noEmit` → **0**
- [x] `npx eslint src scripts` → **0 / 0** · sin `eslint-disable`
- [x] `npx eslint e2e playwright.config.ts` → **0 / 0**
- [x] `npx vitest run` → **270 tests / 38 ficheros**
- [x] `npm run test:coverage` → **77 / 76 / 74 / 79**
      (medida real **78.01 / 76.32 / 74.72 / 79.85** — sin moverse respecto a
      la 4.1: la corrección de contraste no ha tocado ningún código con test)
- [x] `npm run build` → **0**
- [x] E2E local → **24 passed + 14 skipped** (Chromium + WebKit)
      *(el «10/10» de la 4.2 quedaba desactualizado: eran 5×2; ahora entran
      además las 14 de axe en Chromium, y en WebKit se saltean por **D5**)*
- [x] axe en local → **14/14** · **0 hallazgos informados**
- [x] Lighthouse en local → **verde**

---

## §7 — Documentación *(R7)*

- [x] `CHANGELOG.md` — entrada en `[Unreleased]`
- [x] `README.md` — comandos `audit:a11y` / `audit:cwv` / `audit`, qué mide cada
      uno y **la advertencia de que son datos de laboratorio** (D9)
- [x] `AGENTS.md` — bloque «ESTADO ACTUAL» **redactado dentro de la PR**, verdad
      tras el merge, **sin PR ni SHA** (D11)
- [x] `AGENTS.md` — sección de Testing actualizada con la auditoría
- [x] `MEMORY.md` — 4.3 completada
- [x] **`specs/e2e-playwright/tasks.md:96` → `[x]`** (cabo suelto acordado)
- [x] `spec.md` — 58 criterios marcados + métricas congeladas escritas

---

## §8 — Cierre

- [x] **Preguntar antes de cualquier commit, push y PR** ⛔
- [x] Rama `feat/cwv-accessibility-audit` → PR contra `main`
- [x] Verificar los **3 jobs en CI** + el nuevo `cwv-audit`
      (primer intento: 3 verdes, `cwv-audit` rojo por `No usable sandbox!` —
      arreglado con `chromeFlags: "--no-sandbox"`. **Re-validado: 4/4 verdes**)
- [x] Analizar los informes de CI y decidir el umbral con los datos
      (LCP coincide con local a ±40 ms; TBT 88 en local/40–46. **≤ 100 se
      mantiene** — decisión del usuario)
- [ ] Merge + borrar rama
