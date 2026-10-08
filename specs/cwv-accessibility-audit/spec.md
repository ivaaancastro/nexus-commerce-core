# Spec — Tarea 4.3: Auditoría Core Web Vitals y Accesibilidad

> **Fase 4 · Calidad Enterprise** · requisitos (R1–R7) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D11) · checklist en `tasks.md`.

---

## Resumen

Se añade una **auditoría automatizada y bloqueante** de Core Web Vitals y
accesibilidad:

- **axe-core** sobre las **14 rutas** del App Router, dentro del job `e2e-tests`
  que ya existe.
- **Lighthouse CI** con **presupuesto declarativo** en un job de CI nuevo,
  **en paralelo**, contra la build de producción **con el backend real levantado**.
- Umbrales **medidos y congelados** (herencia de la 4.1), que **arrancan en verde**
  — lo que no esté en verde se corrige o se saca con justificación escrita.

---

## R1 — Instrumentación local

**Criterio**: existe un comando local que cualquiera puede lanzar, y la
configuración vive en un fichero revisable.

- Dependencias de desarrollo en `frontend/`:
  - `@axe-core/playwright` — axe dentro del runner que ya usamos.
  - `@lhci/cli` — Lighthouse CI, con `lighthouse` como dependencia suya.
- **`frontend/lighthouserc.json` versionado**, con la estructura
  `collect` / `assert` / `upload` de LHCI. **Los presupuestos viven ahí**, no
  escondidos en flags de un script (**D4**).
- Scripts nuevos en `frontend/package.json`:
  - `audit:a11y` — sólo la espec de axe.
  - `audit:cwv` — sólo Lighthouse CI.
  - `audit` — ambos.
- **Navegador reutilizado**: Lighthouse apunta al **Chrome for Testing que ya
  instala Playwright** (`CHROME_PATH`), **sin descargar navegador nuevo**.
- **`chromeFlags: "--no-sandbox"` en `collect.settings`**: Playwright lanza
  Chromium **sin sandbox de serie** (`chromiumSandbox: false` → `--no-sandbox`),
  y en el runner de CI (Ubuntu 24.04, donde AppArmor restringe los *user
  namespaces*) Chrome **se aborta** con `No usable sandbox!`. Es alinearse con
  lo que ya hacen los E2E, no una degradación nueva. **Sólo se vio en CI**:
  macOS arranca con sandbox y allí el gate se caía antes de medir nada.
- `npm ci` en una máquina limpia instala todo sin pasos manuales.

### ⚠️ Compromiso conocido — dependencias de Lighthouse

Descubierto al instalar (información nueva respecto a la aprobación original) y
**aceptado explícitamente por el usuario**:

| | `main` (baseline) | con `@lhci/cli` |
|:---|:---|:---|
| Total | 7 high | 24 (18 high · 4 moderate · 2 low) |
| **Producción** (`--omit=dev`) | **2 high** | **2 high — sin cambios** |

- Los **17 nuevos son `dev`**: vienen todos de `@lhci/cli → lighthouse@12.6.1`
  (versión **actual**), y mayormente de `puppeteer-core` / `proxy-agent` —
  árbol de un CLI que **sólo corre en local y en CI** y **no se empaqueta**.
- `npm audit fix` **resuelve 0 de 24**; `--force` instalaría
  `@lhci/cli@0.1.0`, una versión de hace años — **descartado**.
- Los **2 high de producción son preexistentes** (`source-map-js`, cadena
  Next/Tailwind) y **no tienen relación con esta tarea**.

**Se acepta** con criterio de producción: no se introduce ninguna
vulnerabilidad que llegue al usuario final.

### ⚠️ Trampa local — un puerto ocupado mide otro build

Descubierto al verificar (nueva información respecto a la aprobación) y
**caro**: `collect.startServerCommand` lanza `next start`; si el puerto ya está
ocupado, ese proceso muere sin bindear, LHCI lo da por «servidor arrancado» y
**mide lo que haya escuchando**, que es un build que nadie eligió.

- Una corrida medida así dio **LCP 6 998 ms** sobre una página que en la
  corrida limpia siguiente dio **3 057 ms**. También podría haber salido al
  revés: en **verde**, sobre código que ya no es el nuestro.
- Por eso `scripts/lighthouse.mjs` **comprueba el puerto antes de lanzar** y
  aborta con `exit 1` si algo ya escucha en él. En CI es no-op, nadie escucha.
- Y el comando que se documentaba para limpiar era **falso**:
  `pkill -f "next start"` no mata nada, porque el proceso se llama
  **`next-server`**. Estaba avisado en el README y aun así me mordió.

### Criterios de aceptación

- [x] `@axe-core/playwright` y `@lhci/cli` están en `devDependencies`
- [x] Existe `frontend/lighthouserc.json` **versionado** con `collect` y `assert`
- [x] Los presupuestos están en `lighthouserc.json`, **no** en argumentos de línea
- [x] Existen los 3 scripts (`audit:a11y`, `audit:cwv`, `audit`)
- [x] No se descarga ningún navegador fuera de los que ya gestiona Playwright
- [x] `npx tsc --noEmit` → **0** con la config nueva incluida
- [x] `npm audit --omit=dev` sigue en **2 high** (los preexistentes de
      `source-map-js`) — **ninguna vulnerabilidad nueva en producción**
- [x] `collect.settings.chromeFlags` incluye **`--no-sandbox`**: sin él Chrome
      **no arranca en el runner de CI** y el gate se cae antes de medir
- [x] `scripts/lighthouse.mjs` **aborta con `exit 1`** si el puerto de la
      auditoría ya está ocupado — probado en las dos direcciones:
      `exit 1` con el puerto ocupado, `exit 0` con `assert` y con el puerto libre
- [x] El comando de limpieza documentado es el **correcto**
      (`pkill -f "next-server"`, no `next start`)

---

## R2 — Espec de axe sobre las 14 rutas

**Criterio**: la accesibilidad se comprueba **ejecutando la página**, no
leyéndola.

- Espec nueva `frontend/e2e/a11y.spec.ts`.
- **Las 14 rutas** del App Router, cada una con su propio `test`:

  ```
  /                        /catalog                 /search
  /products/[reference]    /cart                    /orders
  /orders/[orderNumber]    /receipt/[orderNumber]   /profile
  /addresses               /login                   /register
  /verify-email            /forgot-password
  ```

- **Rutas parametrizadas resueltas con datos reales**:
  - `/products/[reference]` → `0432/021` (la semilla).
  - `/orders/[orderNumber]` y `/receipt/[orderNumber]` → se obtiene **un pedido
    real por API** (el último de la cuenta) — no se inventa ni se hardcodea un
    número que no exista.
- **Rutas autenticadas** (`/profile`, `/addresses`, `/orders`, …) → se usa la
  sesión que ya deja preparada `globalSetup`.
- **Ejecución sólo en Chromium** (**D5**): `test.skip` explícito en Firefox y
  WebKit **con el motivo documentado en el propio fichero** — las reglas de axe
  inspeccionan el DOM, y el DOM es idéntico en los tres motores.
- La **severidad mínima que bloquea es `critical` + `serious`** (**D7**); las
  `moderate` y `minor` **se reportan** pero no tumbarán el gate.

### Criterios de aceptación

- [x] Existe `frontend/e2e/a11y.spec.ts`
- [x] Hay **14 tests**, uno por ruta
- [x] Cada test ejecuta axe sobre la página y comprueba el umbral de severidad
- [x] `/products/[reference]` usa la semilla `0432/021`
- [x] `/orders/[orderNumber]` y `/receipt/[orderNumber]` resuelven un pedido
      **real obtenido por API** (no un literal inventado)
- [x] Las rutas protegidas pasan por la sesión de `globalSetup`
- [x] Hay `test.skip` en Firefox y WebKit **con el motivo comentado**
- [x] **0 violaciones `critical` y `serious`** en las 14 rutas
- [x] Las violaciones `moderate`/`minor` se **informan** (log), no se silencian
- [x] El resto de specs **no cambian** (`smoke.spec.ts` intacto)
- [x] El umbral se aplica con la API de `@axe-core/playwright`, **sin
      `eslint-disable` ni suppressions de axe**

---

## R3 — Presupuesto de Core Web Vitals

**Criterio**: los CWV se miden con Lighthouse **contra la página real** y el
presupuesto es **declarativo**.

- `npm run audit:cwv` lanza LHCI **contra la build de producción**.
- **Backend real levantado** durante la medición (**D2**) — un `/catalog` sin
  API pintaría su estado de error y estaríamos midiendo un mensaje de fallo.
- **`numberOfRuns: 3` con mediana** (**D4**) — Lighthouse es ruidoso con una
  sola pasada.
- La auditoría cubre al menos: **`/`**, **`/catalog`**,
  **`/products/0432/021`** y **`/login`** (portada, catálogo, ficha y una página
  de formulario estática).
- Las métricas del presupuesto y sus valores se **deciden tras la primera
  medición** y se **escriben en esta spec** (**D1**, **D8**): sólo entra lo que
  Lighthouse reporta de forma fiable en laboratorio. La INP **no se presenta
  como métrica de usuario real** (**D8**, **D9**).
- El resultado se juzga por las **aserciones de `lighthouserc.json`**, no por un
  script que interprete el JSON.
- **`aggregationMethod: "median-run"`**: LHCI evalúa por defecto en `optimistic`
  (la **mejor** de las 3 corridas), lo que dejaría sin efecto la razón de **D4**
  —*tres tomas y mediana*. Se fija explícitamente la mediana para que el gate
  mida lo que dice medir.

### 📊 Presupuesto congelado — medición del 2026-10-08 (**D1**)

Medida local con backend real, `numberOfRuns: 3` por ruta, valores en
**mediana**. `LCP` y `TBT` en ms; `perf`/`a11y` en puntuación 0–100.

| Ruta | perf | a11y | **LCP** | **CLS** | **TBT** |
|:---|---:|---:|---:|---:|---:|
| `/` | 95 | 100 | 2 966 | 0.000 | 36 |
| `/catalog` | 94 | 100 | **3 041** | 0.000 | **46** |
| `/login` | 98 | 100 | 2 350 | 0.000 | 43 |
| `/products/0432/021` | 95 | 100 | 2 982 | 0.000 | 39 |

**Dispersión entre corridas**: LCP ±50–100 ms · CLS siempre `0.000`
(máx. corrida aislada `0.00035`) · TBT ±10 ms. Con ese ruido, la mediana es
estable y el gate no puede bailar.

| Métrica | Congelado | Peor medido en CI | Holgura | Justificación |
|:---|---:|---:|---:|:---|
| `largest-contentful-paint` | **≤ 3 750 ms** | 3 193 | +17 % | banda CI 2 112–3 193, estable entre corridas (±114) |
| `cumulative-layout-shift` | **≤ 0,05** | 0,000 | siempre 0 | sólo cae si se rompe el layout de verdad |
| `total-blocking-time` | **≤ 250 ms** | 192 | +30 % | el entorno no resuelve mejor — razón abajo |
| `categories:performance` | **≥ 85** | 0,90 | −5 pts | perf pondera el TBT, así que sigue detectando regresiones grandes de CPU |
| `categories:accessibility` | **≥ 95** | 1,00 | −5 pts | axe ya gatea a 0 violaciones; esto cubre el set de reglas distinto de Lighthouse |

### 📊 Recalibración — el gate corre en CI, y en CI el TBT baila

La medición inicial se hizo en **local (macOS)**, pero el gate corre en **CI
(Ubuntu)**. Se analizaron los **12 informes** de **cada corrida de CI**
(artefacto `lighthouse-report/`). Las tres corridas de este bloque cambiaron
**sólo** configuración y documentación — **el código de la app es idéntico**.
Mismo Chromium, misma versión (12.6.1), mismo `throttlingMethod: simulate`.

Peor mediana por ruta:

| | **LCP** | **CLS** | **TBT** | **perf** | **a11y** |
|:---|---:|---:|---:|---:|---:|
| **Corrida 1** (verde, umbrales de local) | 3 079 | 0,000 | 88 | 0,94 | 1,00 |
| **Corrida 2** (roja: TBT 178 > 100) | 3 193 | 0,000 | **178** | **0,91** (0,90 en una corrida) | 1,00 |
| **Corrida 3** (verde, umbrales recalibrados) | 3 169 | 0,000 | **192** | 0,90 | 1,00 |
| Local (macOS) | 3 035–3 057 | 0,000 | 40–46 | 0,94 | 1,00 |

**Margen real de los umbrales sobre lo peor de las 3 corridas**: LCP **581 ms** ·
TBT **58 ms** · perf **0,05**. El TBT tiene dos platós — ~90 cuando el runner
está tranquilo, ~190 cuando está cargado —, y **250 cubre el plató cargado con
un +30 %**. Es el umbral más apretado del conjunto y el primero a vigilar.

- **LCP, CLS y a11y son estables.** LCP coincide entre local y CI a ±114 ms,
  lo que confirma que la simulación de Lantern no se va con el sistema
  operativo. **D1 aguanta**.
- **TBT varía ×2 entre corridas con el mismo código** (88 con el runner
  tranquilo; 178 y 192 cargado) y arrastra a
  `perf` hasta el borde (0,90 frente a un umbral de 0,90). La causa no es
  azar: **D2 exige medir con el backend real**, así que en el mismo VM
  conviven PostgreSQL + Spring Boot + `next start` + Chrome, y las páginas
  llaman a Java mientras Chrome graba la traza. El TBT mide bloqueo de CPU
  **observado**, y esa contención es **autoinfligida por diseño**.
- **`median-run` no protege**: en la corrida roja `/catalog` dio
  **187 / 178 / 162** — las tres altas. Más corridas dentro del mismo job no
  ayudan: la contención es sistemática **dentro** del job y distinta
  **entre** jobs.
- **Consecuencia**: en este entorno el TBT **no puede ser un detector fino**.
  Se recalibra con lo peor de las tres corridas más margen (**≤ 250** sobre
  192) y queda dicho aquí. Sigue detectando una regresión grande de CPU (un
  `await` bloqueante de 500 ms saldría rojo) pero no una de +30 ms — **y con
  este entorno de medición no se puede pedir más**.
- **Primera decisión y su retractación**: con la corrida 1 se propuso
  mantener TBT ≤ 100 y el usuario lo aprobó. La corrida 2, **con código
  idéntico**, la desmintió. Se recalibra con ambas. La lección queda escrita:
  **una medición de CI no es una medición, son dos o tres**.

### ⚠️ INP — **no se congela porque no es medible** (**D8**)

Lighthouse 12 **no produce un valor de INP de laboratorio**:

- `interaction-to-next-paint-insight` existe, pero llega con
  **`score: null` y sin `numericValue`** — es un *insight*, no una métrica.
- La puntuación de `performance` no incluye INP; incluye
  **`max-potential-fid`**, que está **obsoleto**.
- El único sustituto medible es **`total-blocking-time`**, y **se dice
  explícitamente que es un proxy**: no es la INP.

Consecuencia honesta: **la INP no está protegida por este gate.** Decir lo
contrario sería presentar una cifra de laboratorio como métrica de usuario real
(**D9**). Medir la INP exige datos de campo, y no hay despliegue.

### Criterios de aceptación

- [x] `npm run audit:cwv` ejecuta LHCI de principio a fin
- [x] La medición se hace con **el backend real levantado**
- [x] `numberOfRuns: 3` está configurado (mediana, no una sola pasada)
- [x] Se auditan `/`, `/catalog`, `/products/0432/021` y `/login`
- [x] Lighthouse apunta al Chrome for Testing de Playwright vía `CHROME_PATH`
- [x] Las métricas congeladas y sus valores están **escritas en esta spec**
- [x] El presupuesto de **LCP y CLS** está declarado en `lighthouserc.json`
- [x] **Todo lo medido está por encima del presupuesto** (gate en verde)
- [x] El presupuesto se ha verificado **también en CI**, sobre los 12 informes
      del artefacto `lighthouse-report/` de **dos corridas** — no sólo en local
- [x] Las diferencias entre local y CI están **medidas y explicadas** (TBT ×2),
      y el umbral se ha **recalibrado con los datos de CI encima de la mesa**
- [x] El entorno de medición tiene una **limitación conocida y escrita**: el
      backend real compite por CPU con Chrome, así que el TBT de CI no puede
      ser un detector fino. **No se esconde, se documenta**
- [x] Si alguna métrica no es fiable en laboratorio, **queda dicho aquí**
      explícitamente en vez de silenciarse
- [x] No se afirma ningún dato de campo / CrUX

---

## R4 — Job de CI `cwv-audit`

**Criterio**: la auditoría corre en cada PR **sin frenar los tests**.

- Job nuevo `cwv-audit` en `.github/workflows/ci.yml`, **sin `needs:`**
  (paralelo con `backend-tests`, `frontend-tests` y `e2e-tests`).
- Puesta en marcha en espejo de `e2e-tests`: servicio
  `pgvector/pgvector:pg16` con health check → **override `SPRING_DATASOURCE_*` en
  el paso que arranca el backend** → espera de readiness con **volcado de log si
  se agota** → `npm ci` → `npm run build` → `npm run audit:cwv`.
- **El informe de Lighthouse se sube con `if: always()`**, en espejo de
  `jacoco-report`, `coverage-report` y `playwright-report`.
- **axe no necesita job nuevo**: corre dentro de `e2e-tests` (**D3**).
- Los **4 jobs existentes no cambian**.

### Criterios de aceptación

- [x] Existe el job `cwv-audit` en `ci.yml`
- [x] **Sin `needs:`** — corre en paralelo
- [x] `services.postgres` con health check, igual que los otros jobs
- [x] Override `SPRING_DATASOURCE_*` **en el paso que arranca el backend**
- [x] Espera de readiness **anterior** a la medición, con volcado de log
- [x] El informe se sube con `if: always()`
- [x] `backend-tests`, `frontend-tests` y `e2e-tests` **no cambian**
- [x] El job **no aparece como obligatorio** si falla por ruido de medición —
      la configuración de mediana (**D4**) existe precisamente para evitarlo

---

## R5 — Corrección acotada

**Criterio**: el gate **arranca en verde** o no arranca (**D6**).

- Si el diagnóstico inicial encuentra violaciones `critical`/`serious` o un CWV
  fuera de presupuesto, **se corrigen antes de activar la aserción**.
- La corrección es **acotada**: arreglar lo que haga falta para que el
  presupuesto sea cierto, **no** refactorizar la UI.
- Si algún hallazgo exige rediseño, **se saca** y el umbral queda **por encima de
  lo actual** con **la justificación escrita en esta spec**.
- Cada corrección de accesibilidad **tiene su test**: si se arregla algo que axe
  detecta, la espec de R2 debe cubrir esa ruta (ya la cubre por definición).

### 🩺 Diagnóstico inicial (medido, no supuesto)

axe sobre las **14 rutas con sesión activa** → **14/14 en rojo**, pero
**34 elementos únicos con sólo 2 reglas** distintas:

| Regla | Impacto | Elementos | Bloquea |
|:---|:---|---:|:---:|
| `color-contrast` | **serious** | 33 | ✅ sí |
| `heading-order` | moderate | 1 | ❌ no (D7) |

**Causa raíz única**: `text-neutral-400` (`#a1a1a1`) sobre fondos claros.
Ratios medidos por axe: **2,36 – 2,79** frente al **4,5** que exige WCAG AA
para texto pequeño.

### 🔧 La corrección

**Un solo token en 46 líneas de 15 ficheros**: `text-neutral-400` →
`text-neutral-600`. Se sustituyó **todas** las ocurrencias de base, no sólo las
medidas — dejar las no medidas (estados vacíos, borradores) habría dejado la
bomba para el próximo estado.

#### ¿Por qué `neutral-600` y no `neutral-500`?

No es un gusto: es la aritmética. El proyecto usa tres fondos claros y hay que
pasar en **los tres**:

| Gris | `#ffffff` | `#fafafa` | `#f5f5f5` | ¿Pasa AA (4,5)? |
|:---|---:|---:|---:|:---:|
| `neutral-400` `#a1a1a1` *(hoy)* | 2,58 | 2,47 | 2,37 | ❌ |
| `neutral-500` `#737373` | 4,74 | 4,54 | **4,35** | ❌ |
| **`neutral-600` `#525252`** | **7,82** | **7,49** | **7,17** | ✅ |

`neutral-500` **se descarta con dato, no con opinión**: aprueba en blanco y en
`#fafafa`, pero **se queda corto en `#f5f5f5`**, que es el fondo de las
insignias `ProductThumb` (medido por axe en **2,36** — el peor de todo el
catálogo). `neutral-600` es el único que pasa en los tres.

#### El único caso que **no** se tocó

`app/page.tsx:120` es `text-neutral-600 group-hover:text-neutral-400`. La
tarjeta editorial se oscurece al pasar el ratón (`hover:bg-neutral-900`), así
que ahí el gris **claro** es el correcto — cambiarlo habría roto el contraste
del estado hover. Se preservó esa variante expresamente.

#### `heading-order` (moderate)

`ProductCard` usaba `<h3>` justo después del `<h1>` de la página (catálogo y
búsqueda saltan un nivel). **Corregido a `<h2>`**: el componente sólo se
instancia tras un `<h1>`. `CartItemRow` usa `<h3>` tras `<h2>` y **se dejó
como estaba** — ahí la jerarquía ya es correcta.

#### Verificación de la corrección

| Comprobación | Resultado |
|:---|:---|
| axe sobre las 14 rutas | **14/14** · **0 hallazgos informados** |
| `npx vitest run` | **270 / 270** · **ningún test preexistente cambió** |
| `npx tsc --noEmit` · `npx eslint src scripts` | **0** · **0 / 0** |
| Ningún `text-neutral-400` de base restante | ✅ (sólo sobrevive el `group-hover`) |
| `backend/` | sin tocar |

**Hallazgos descartados: ninguno.** Los 34 se corrigieron todos — no hizo
falta eximir ninguna regla (**D6**).

**Y el gate se demostró que gatea**: con los umbrales congelados pasa
(`exit 0`); forzando `maxNumericValue: 1000` en LCP **falla en las 4 rutas**
(`exit 1`). Un gate que no se ha visto fallar no es un gate.

### Criterios de aceptación

- [x] El gate de axe pasa en las 14 rutas
- [x] El presupuesto CWV pasa en las 4 rutas
- [x] **Ninguna corrección cambia un test preexistente** (mismo criterio R8 de la
      4.1): si un test roto obliga a cambiar una aserción, eso es una señal
- [x] Todo hallazgo **descartado** tiene su justificación escrita en esta spec
- [x] No hay `eslint-disable` ni suppressions de axe
- [x] No se ha tocado `backend/`

---

## R6 — Alcance y baselines

**Criterio**: la 4.3 **añade**, no toca.

- [x] `git diff main -- stat` **no toca `backend/`** (0 líneas: ni Java, ni
      `pom.xml`, ni migraciones)
- [x] `npx tsc --noEmit` → `0` (incluye la config nueva y la espec de axe)
- [x] `npx eslint src scripts` → **0 errores, 0 warnings** · sin `eslint-disable`
- [x] `npx eslint e2e playwright.config.ts scripts` → **0 / 0**. Sobre
      `lighthouserc.json` **no aplica**: ESLint no tiene configuración que
      empareje `.json` y lo reporta como *file ignored* (no es un error, es que
      **no es JavaScript**). Su validación real es que **parsea como JSON** y
      que **LHCI lo consume** — comprobado ambas cosas
- [x] `npx vitest run` → **270 tests / 38 ficheros** (sin cambios)
- [x] `npm run test:coverage` → verde con **77 / 76 / 74 / 79**
- [x] `npm run build` → `0`
- [x] E2E en CI → **15/15** (5 pruebas × 3 navegadores) **más** la espec de axe
- [x] La espec de axe **no duplica** las pruebas de humo ni depende de ellas
- [x] **Sin ADR** (**D10**)

---

## R7 — Documentación

**Criterio**: queda constancia auditable de la auditoría.

- `CHANGELOG.md` — entrada en `[Unreleased]`.
- `README.md` — sección con los comandos (`audit:a11y`, `audit:cwv`, `audit`) y
  **qué mide cada uno**, más la advertencia de que son datos de **laboratorio**
  (**D9**).
- `AGENTS.md` — bloque «ESTADO ACTUAL» redactado **dentro de esta PR**, para ser
  verdad **después** del merge y **sin números de PR ni SHA** (**D11**), más la
  sección de Testing actualizada.
- `MEMORY.md` — Tarea 4.3 completada.
- **`specs/e2e-playwright/tasks.md:96`** → se marca el criterio
  *«Preguntar al usuario antes de cualquier commit y PR»* que quedó en `main`
  sin marcar siendo **ya cumplido** (**D11**).
- **Sin PR de documentación de cierre** (**D11**).

### Criterios de aceptación

- [x] CHANGELOG con la entrada de la 4.3
- [x] README con los comandos y la advertencia de laboratorio
- [x] AGENTS: bloque de estado redactado para ser verdad tras el merge
- [x] AGENTS: sección de Testing con la auditoría
- [x] MEMORY: 4.3 completada
- [x] `specs/e2e-playwright/tasks.md:96` **marcado `[x]`**
- [x] **No existe** PR de documentación de cierre

---

## Fuera de alcance

| Excluido | Motivo |
|:---|:---|
| Datos de campo (CrUX / Speed Insights) | no hay despliegue (**plan D9**) |
| Refactor de UI para subir puntuaciones | sólo lo que exige el presupuesto (**plan D6**) |
| Auditoría de seguridad, SEO o backend | la tarea es CWV + accesibilidad |
| Regresión visual con screenshots | trabajo aparte |
| Validación humana con lector de pantalla | axe automatiza reglas comprobables |
| Cualquier cambio en `backend/` | **prohibido en todo el ciclo** |
