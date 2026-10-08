# Spec — Tarea 4.2 · Test E2E con Playwright

> **Estado**: **⛔ PENDIENTE DE APROBACIÓN**
> **Fecha**: 2026-10-07
> **Plan**: `specs/e2e-playwright/plan.md` · decisiones D1–D9 del usuario y del equipo

---

## 1. Requisitos

### R1 — Instalación y configuración

**Criterio**: la suite E2E existe como capa propia, separada de Vitest.

- `@playwright/test` en `devDependencies` de `frontend/`.
- `frontend/playwright.config.ts`:
  - `testDir: "./e2e"` — **explícito** en ambos runners, para que Vitest no
    recoja los `*.spec.ts` de Playwright ni Playwright los de Vitest.
  - `projects` con **`chromium`, `firefox` y `webkit`** (D4). Un solo directorio
    de pruebas; ningún test duplicado por navegador.
  - `workers: 1` (D6 — BD y usuario compartidos).
  - `webServer` que arranca **build de producción**: `npm run build && npm run
    start`, con `reuseExistingServer: !process.env.CI`.
  - `reporter`: `html` (para subirlo como artefacto) + `list` (para el log).
  - Sin `retries` en local; `retries: 1` sólo en CI.
- Scripts en `frontend/package.json`:
  - `test:e2e` — los 3 navegadores.
  - `test:e2e:quick` — sólo `--project=chromium`.
- `npx vitest run` **no** cambia de comportamiento ni de número de ficheros.
- `playwright.config.ts` **queda fuera** del `include` de `vitest.config.ts`
  y de `tsconfig` del `src` — se comprueba con `npx tsc --noEmit`.

### R2 — `globalSetup`: dejar el entorno listo (D5 + D7)

**Criterio**: antes de la primera prueba, el entorno está sembrado y el
backend responde. **Idempotente**: dos ejecuciones seguidas pasan sin duplicar
datos ni agotar stock.

Orden estricto, cada paso con techo de tiempo y mensaje de fallo identificable:

1. **Readiness del backend**: sondeo `GET /api/v1/markets` hasta `200` o
   **120 s**. Si se agota ⇒ fallo con mensaje tipo *«el backend no responde en
   … — arranca `./mvnw spring-boot:run` y PostgreSQL»*. **No** se añade
   Actuator ni ningún endpoint nuevo (R7: `backend/` intacto).
2. **Usuario `e2e@nexus.dev`**:
   - Si `POST /api/v1/auth/login` con la contraseña de prueba devuelve `200`,
     el usuario **ya existe** → se salta el alta (rama idempotente).
   - Si no, `POST /api/v1/auth/register` → se lee `verification_code` de la
     tabla `users` por SQL → `POST /api/v1/auth/verify-email` con ese código →
     login. **Sin SMTP y sin migración.**
3. **Dirección por defecto**: si `GET /api/v1/users/me/addresses` está vacía,
   `POST /api/v1/users/me/addresses` con `defaultAddress: true`. El carrito
   precoselecciona esa dirección, así que ninguna prueba tiene que tocar el
   `select`.
4. **Reset de stock**: `UPDATE stock_items` restaurando **los valores exactos
   de la semilla**, no un número genérico. Para el único SKU que la suite
   compra (`843321900101`, talla **M** de `0432/021`): **150 / 5** en
   `WH_ARTEIXO` y **80 / 0** en `WH_ZARAGOZA` (`V1`). Se ejecuta
   **siempre**, no sólo en la primera corrida.

   > **Corrección durante la implementación**: la primera redacción decía
   > `40` «las cifras de `V12`» y era **falso** — `V12` sólo siembra stock de
   > sus 4 barcodes (80 en ARTEIXO, 40 en ZARAGOZA) y el blazer viene de `V1`,
   > donde los valores son 150/5 y 80/0. Un `UPDATE` ciego a 40 habría
   > corrompido la semilla.

   > **La prueba compra talla M**: `843321900102` (talla L) **no tiene ninguna
   > fila de stock** en ninguna migración, así que el checkout devolvería
   > `409`. Elegir M no es un detalle cosmético, es condición de que el flujo
   > funcione.

El setup **no** escribe datos de negocio: sólo lee el código de verificación y
restaura cifras de stock (D5).

### R3 — La compra completa

**Criterio**: una única prueba recorre el flujo transaccional entero contra
backend real.

- GIVEN el usuario en la portada
- WHEN navega al catálogo, abre la ficha `0432/021`, elige talla y pulsa
  «Añadir a la bolsa»
- THEN ve el badge del carrito con `1` y la confirmación de añadido

- WHEN abre `/cart` y pulsa «Finalizar compra»
- THEN se crea el pedido y la aplicación llega a una vista con **número de
  pedido que empieza por `ORD-`**
- AND el número de pedido se puede recargar en el navegador y el pedido sigue
  ahí — el `Idempotency-Key` del cliente no ha duplicado nada

La prueba **falla** si el pedido no llega a existir: no se mockea nada en
ningún punto (D1).

### R4 — Pruebas complementarias del smoke

Cuatro pruebas cortas, independientes entre sí:

| # | GIVEN / WHEN / THEN |
|:--|:---|
| 4.1 | GIVEN un carrito con un artículo **WHEN se recarga la página THEN el badge sigue en `1`** (persistencia real de `localStorage`) |
| 4.2 | GIVEN el navegador sin sesión **WHEN visita una ruta protegida (`/orders` o `/profile`) THEN redirige a `/login`** |
| 4.3 | GIVEN el usuario de prueba **WHEN introduce credenciales válidas en `/login` THEN la cabecera muestra `PEDIDOS` y `CUENTA`** — y GIVEN autenticado **WHEN pulsa «Cerrar sesión` THEN la cabecera vuelve a `INICIAR SESIÓN`** |
| 4.4 | GIVEN el producto en la ficha **WHEN se añade a la bolsa THEN la confirmación visible desaparece sola** (temporizador con reloj real, complemento del test con fake timers) |

### R5 — Determinismo y estilo de las pruebas

**Criterio**: las pruebas son estables o no valen.

- Localizadores **por rol y texto accesible** (`getByRole`, `getByLabel`) —
  nunca por selectores CSS arbitrarios ni por XPath.
- Esperas **condicionales** (`expect(...).toBeVisible()` con auto-espera,
  `expect.poll`). **Prohibido `waitForTimeout` con espera fija** — es la
  receta clásica de flakiness.
- Cada prueba es **independiente**: no depende del orden ni del resultado de
  otra. Las que necesitan sesión inician sesión ellas mismas.
- Nombres de prueba **en español**, con `test.describe` por flujo, en la
  misma convención que los tests de Vitest.
- **Sin red externa**: sólo el backend local y el frontend local.
- Estado de sesión: preferir **iniciar sesión en la prueba** o guardar la
  sesión con `storageState`, no manipular `localStorage` a mano salvo que sea
  el propio sujeto de la prueba.

### R6 — Job de CI `e2e-tests` (D3)

**Criterio**: el flujo de compra se comprueba en cada PR.

- Nuevo job `e2e-tests` en `.github/workflows/ci.yml`, **sin `needs:`**
  (corre en paralelo con `backend-tests` y `frontend-tests`).
- `services.postgres` → `pgvector/pgvector:pg16` con health check, igual que
  el job de backend.
- Pasos: checkout → JDK 21 + Temurin (con `cache: maven`) → **Node 22 +
  `npm ci`** (el mismo que `frontend-tests`, no 20) → `pg_isready` → arrancar
  el backend en segundo plano → **esperar readiness** → `npx playwright install
  --with-deps chromium firefox webkit` → `npm run test:e2e` → **subir
  `playwright-report/` con `if: always()`**.
- **El override de datasource va en el paso que lanza el backend**, no en el de
  espera: es el proceso padre quien hereda el entorno y se lo transmite al
  JVM. (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`,
  `SPRING_DATASOURCE_PASSWORD`.)
- La espera es **explícita y previa a Playwright**: `globalSetup` sólo aguanta
  120 s y un arranque frío de Maven en CI puede superarlos. Si se agota, se
  vuelca `/tmp/backend.log` — sin ese volcado, un backend caído es un timeout
  mudo.
- Las credenciales de `pg` del `globalSetup` se inyectan como `PG*` en el paso
  de pruebas, con los valores del servicio (en local tienen los de
  `application.properties`).
- El informe se sube **aunque las pruebas fallen**, en espejo de
  `jacoco-report` y `coverage-report`.
- El paso de build va dentro del `webServer` (R1), no duplicado.

### R7 — Alcance y baselines (R7 del plan)

**Criterio**: la E2E **añade**, no toca.

- `git diff main --stat` **no toca `backend/`** — ni Java, ni `pom.xml`, ni
  migraciones.
- `npx tsc --noEmit` → `0`.
- `npx eslint src scripts` → **0 errores, 0 warnings**; sin `eslint-disable`.
  (`playwright.config.ts` y `e2e/` quedan fuera de esos globo — se comprueba
  explícitamente si ESLint llega a ellos.)
- `npx vitest run` → **270 tests** en verde, **mismo número** que al empezar.
- `npm run test:coverage` en verde con el umbral congelado de la 4.1
  (`77 / 76 / 74 / 79`) — el E2E **no** altera la cobertura de unitarios.
- `npm run build` → `0`.
- **Sin ADR**.

### R8 — Documentación y cierre

- `CHANGELOG.md` con la entrada en `[Unreleased]`.
- `README.md`: cómo levantar lo necesario y ejecutar `npm run test:e2e`.
- `AGENTS.md`: bloque «ESTADO ACTUAL» redactado dentro de la PR (verdad tras
  el merge, **sin números de PR ni SHA**) y la regla de E2E en *Testing*.
- `MEMORY.md`: Tarea 4.2 completada.
- **Sin PR de documentación de cierre** (D11 de la 3.3).

---

## 2. API

**No hay endpoints nuevos.** La suite consume los que ya existen:

| Endpoint | Uso | ¿Desde la prueba o desde el setup? |
|:---|:---|:---|
| `GET /api/v1/markets` | Sondeo de readiness | `globalSetup` |
| `POST /api/v1/auth/register` | Alta del usuario de prueba | `globalSetup` |
| `POST /api/v1/auth/verify-email` | Verificar con el código leído de BD | `globalSetup` |
| `POST /api/v1/auth/login` | Idempotencia del alta + prueba 4.3 | ambos |
| `GET/POST /api/v1/users/me/addresses` | Dirección por defecto | `globalSetup` |
| `POST /api/v1/orders/checkout` | Creación del pedido (con `Idempotency-Key`) | **la prueba**, a través de la UI |

Los endpoints de catálogo, ficha e inventario se consumen **a través de la UI**,
sin tocarlos directamente.

---

## 3. Modelo de Datos

**No hay entidades nuevas ni migraciones.** El setup toca dos tablas
existentes, con un alcance mínimo:

| Tabla | Operación | Motivo |
|:---|:---|:---|
| `users` | **SELECT** de `verification_code` | Completar la verificación sin SMTP (D5) |
| `users` | INSERT del usuario de prueba (vía API) | Semilla idempotente |
| `addresses` | INSERT de la dirección por defecto (vía API) | El checkout exige `addressId` |
| `stock_items` | **UPDATE** de `quantity_available` y `quantity_reserved` a los valores de la semilla (`150/5` y `80/0` para `843321900101`) | Cada compra consume stock; sin reset, la suite fallaría cuando se agote |

**Ningún dato de negocio se escribe directamente**: pedidos, líneas y
reservas los crea siempre el backend.

---

## 4. Criterios de Aceptación

### R1 — Instalación y configuración

- [x] `@playwright/test` está en `devDependencies` de `frontend/`
- [x] Existe `frontend/playwright.config.ts`
- [x] `testDir` explícito en **`playwright.config.ts`** (`"./e2e"`)
- [x] `testDir`/`include` explícito en `vitest.config.ts` (no recoge `e2e/`)
- [x] `projects` declara `chromium`, `firefox` y `webkit`
- [x] `workers: 1`
- [x] `webServer` ejecuta build de producción (`build` + `start`)
- [x] `reporter` incluye `html` y `list`
- [x] `retries` = 0 en local, 1 en CI
- [x] Existe el script `test:e2e` (3 navegadores)
- [x] Existe el script `test:e2e:quick` (sólo chromium)
- [x] `npx vitest run` no cambia: sigue en **270 tests / 38 ficheros**
- [x] `npx tsc --noEmit` → `0` con el config de Playwright incluido

### R2 — `globalSetup`

- [x] El sondeo usa `GET /api/v1/markets`
- [x] El sondeo tiene techo de **120 s**
- [x] El fallo de readiness muestra un **mensaje accionable** (qué levantar)
- [x] El alta del usuario usa la **API real**, no SQL
- [x] El código de verificación se lee de la columna `verification_code`
- [x] **No** se envía ningún email y **no** existe ninguna migración nueva
- [x] Rama idempotente: con el usuario ya creado, el setup **no** falla ni
      duplica
- [x] Se crea una dirección con `defaultAddress: true` sólo si no existe ninguna
- [x] El reset de stock se ejecuta **en cada corrida**
- [x] El setup no escribe datos de negocio (grep: ningún `INSERT`/`UPDATE` sobre
      `orders`, `order_items` ni `reservations`)

### R3 — La compra completa

- [x] Existe una prueba de compra completa sin mocks de API
- [x] Selecciona talla antes de poder añadir (el botón está deshabilitado sin
      talla)
- [x] El badge del carrito llega a `1`
- [x] La prueba termina viendo un número de pedido `ORD-…`
- [x] El pedido **se recarga** en el navegador y sigue visible
- [x] Se comprueba que **no se ha duplicado** (una sola orden creada)

### R4 — Pruebas complementarias

- [x] El carrito **persiste tras recargar**
- [x] Ruta protegida sin sesión **redirige a `/login`**
- [x] Login correcto **muestra `PEDIDOS` y `CUENTA`**
- [x] Logout **vuelve a `INICIAR SESIÓN`**
- [x] La confirmación de añadido **desaparece sola** con reloj real
- [x] Hay un `test.describe` por flujo y nombres en español

### R5 — Determinismo y estilo

- [x] **Cero** `waitForTimeout` con espera fija (grep)
- [x] Localizadores por **rol/label**, no por selectores CSS arbitrarios
- [x] Ninguna prueba depende de la ejecución de otra
- [x] Sin llamadas a red externa (grep: ningún dominio externo)
- [x] `workers: 1` en configuración

### R6 — CI

- [x] Existe el job `e2e-tests` en `ci.yml`
- [x] **Sin `needs:`** (corre en paralelo)
- [x] `services.postgres` con `pgvector/pgvector:pg16` y health check
- [x] Override del datasource por `SPRING_DATASOURCE_*` **en el paso que
      arranca el backend**
- [x] El backend se arranca en segundo plano **y se espera readiness** antes
      de las pruebas (paso propio, con volcado del log si se agota)
- [x] `npx playwright install --with-deps` de los 3 navegadores
- [x] El informe se sube con `if: always()`
- [x] Los jobs `backend-tests` y `frontend-tests` **no cambian**

### R7 — Alcance y baselines

- [x] `git diff main --stat` **no toca `backend/`**
- [x] `npx tsc --noEmit` → `0` (incluye `e2e/` y `playwright.config.ts`)
- [x] `npx eslint src scripts` → **0 errores, 0 warnings** · sin `eslint-disable`
- [x] `npx eslint e2e playwright.config.ts` → **0 errores, 0 warnings** (además
      del baseline; fuera del globo del comando de R7)
- [x] `npx vitest run` → **270 tests** (mismo número que al empezar)
- [x] `npm run test:coverage` → verde con `77 / 76 / 74 / 79`
- [x] `npm run build` → `0`
- [x] `npm run test:e2e` → verde en **Chromium y WebKit** en local · **los 3
      navegadores en CI** — Firefox no puede arrancar en headless en esta
      máquina (**plan D10**: es una limitación del entorno, no del alcance; no
      se baja a 2 navegadores)
- [x] Dos corridas **consecutivas** en verde (idempotencia del `globalSetup`)
- [x] **Sin ADR**

### R8 — Documentación

- [x] `CHANGELOG.md` con la entrada en `[Unreleased]`
- [x] `README.md` documenta cómo ejecutar los E2E
- [x] `AGENTS.md` con la regla de E2E + bloque «ESTADO ACTUAL» redactado en la
      PR (verdad tras el merge, **sin PR ni SHA**)
- [x] `MEMORY.md` con la Tarea 4.2 completada
- [x] Sin PR de documentación de cierre

---

## 5. Casos de Error

| Caso | Comportamiento esperado |
|:---|:---|
| Backend no arrancado | `globalSetup` agota los 120 s y **falla con mensaje accionable** («arranca `./mvnw spring-boot:run`»), no con un timeout críptico |
| PostgreSQL no disponible | El sondeo del backend nunca contesta ⇒ mismo fallo, distinto mensaje si se puede discriminar |
| Usuario ya existe | Se detecta por intento de login y **se salta el alta** — la segunda corrida pasa igual que la primera |
| Código de verificación nulo o caducado | El setup **falla indicando la causa**; no continúa con un usuario sin verificar (el login posterior lo delataría con un error confuso) |
| Dirección ya existente | Se reutiliza; no se crean direcciones duplicadas |
| Stock insuficiente (reset omitido) | El checkout devuelve **409** y la prueba falla en el paso de creación del pedido ⇒ por eso el reset es **incondicional** |
| Dos compras en paralelo | Compiten por el stock y por la sesión ⇒ mitigado por `workers: 1`; si alguien lo cambia, la suite se vuelve flaky |
| Navegador no instalado | Playwright avisa con el comando exacto (`npx playwright install`); documentado en README |
| `next dev` en el puerto 3000 | `reuseExistingServer` lo reutiliza **sólo fuera de CI**; en CI se garantiza build de producción |
| Endpoint de catálogo cambia de nombre | La prueba falla en localizador ⇒ se ve en el informe HTML con el snapshot |
