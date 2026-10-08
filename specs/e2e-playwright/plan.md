# Plan — Tarea 4.2 · Test E2E con Playwright

| Campo | Valor |
|:---|:---|
| **Feature** | `e2e-playwright` |
| **Rama** | `feat/e2e-playwright` |
| **Fase** | 4 — Calidad Enterprise |
| **Fecha** | 2026-10-07 |
| **Estado** | Borrador → **⛔ pendiente de aprobación** |

---

## 0. Preguntas previas (respondidas por el usuario el 2026-10-07)

1. **¿Contra qué backend corren los E2E?** → **Backend real** (Spring Boot + PostgreSQL)
2. **¿Qué flujos cubre la tanda inicial?** → **Smoke: camino crítico**
3. **¿Corren en CI?** → **Sí, job de CI separado**
4. **¿Qué navegadores?** → **Chromium + Firefox + WebKit**

---

## 1. Objetivos

1. Existe una suite E2E en navegador real que recorre **de punta a punta** el
   flujo transaccional: home → catálogo → ficha → talla → añadir a la bolsa →
   checkout → **pedido creado**.
2. Los E2E corren **contra backend real**, no contra API mockeada: lo que se
   valida es el contrato de verdad (`Idempotency-Key`, reserva de stock,
   creación de la orden), que es exactamente lo que ningún test de frontend
   cubre hoy.
3. Un job de CI **`e2e-tests`** los ejecuta en cada PR, en espejo de los dos
   jobs que ya existen, y sube el informe de Playwright como artefacto.
4. Los tres motores (Chromium, Firefox y WebKit) ejecutan la misma suite.

## 2. No-Objetivos

- **No tocar `backend/`** — ni código, ni tests, ni migraciones. Si algo
  exiguiera cambio de backend, se reabre el alcance con el usuario antes de
  escribirlo.
- **No reemplazar la suite unitaria**: los 270 tests de Vitest siguen siendo la
  primera línea; los E2E son una capa encima, no una sustitución.
- **No cubrir el catálogo completo, filtros, búsqueda, devoluciones ni
  perfil** en esta tanda (decisión 2: *smoke*). Se amplía en iteraciones
  posteriores si el smoke se estabiliza.
- **No automatizar el registro completo con envío de email**: no hay SMTP en el
  entorno. El usuario de prueba se deja **verificado** desde el *setup*, pero
  el registro en sí **no** es un test E2E de esta tanda.
- **No tests visuales ni de screenshot** (`toHaveScreenshot`) — fuera del
  alcance de la 4.2.
- **No ADR**: Playwright es *tooling* de testing, no un cambio de stack ni de
  arquitectura de la aplicación.

---

## 3. Decisiones de Diseño

### D1 — Backend real, no API mockeada

El frontend habla con el backend **por rewrite** (`next.config.ts`:
`/api/v1/:path*` → `http://localhost:8080/api/v1/:path*`), así que *podrías*
interceptar todo con `page.route()` y sería rapidísimo. Se descarta deliberada
razón: los 270 tests unitarios **ya mockean esa API**, y un E2E sobre mocks
comprobaría esencialmente que React pinta — que es lo que ya está cubierto.

Lo que **no** está cubierto en ningún sitio es que la cadena
`fetch → rewrite → Spring → JPA → PostgreSQL` se comporte de verdad. Ese es el
único valor añadido del E2E, y sólo aparece con backend real.

Consecuencias que hay que asumir:

- El job de CI necesita **Java 21 + PostgreSQL además de Node**.
- El estado **es compartido y mutable**: cada ejecución crea un pedido y
  decrementa stock. Se neutraliza en el *setup* (D5).
- Los tests son más lentos (segundos, no milisegundos) y dependen de que el
  backend esté sano. Se comprueba por sondeo antes de empezar (D7).

### D2 — Alcance: un solo camino crítico

Un flujo, cortado en pruebas cortas y legibles:

| # | Prueba | Qué demuestra |
|:--|:---|:---|
| 1 | **Compra completa**: home → `/catalog` → ficha → talla → «Añadir a la bolsa» → `/cart` → «Finalizar compra» → **pedido con número `ORD-…`** | El flujo transaccional entero funciona en navegador con backend real |
| 2 | **La bolsa persiste tras recargar** | `useSyncExternalStore` + `localStorage` en navegador real |
| 3 | **Ruta protegida sin sesión** → redirige a `/login` | `ProtectedRoute` y el guard de cliente |
| 4 | **Login con credenciales** → la cabecera muestra `PEDIDOS` / `CUENTA` y se puede salir | `AuthContext` + JWT de verdad en el navegador |
| 5 | **Aviso de confirmación que desaparece solo** | El temporizador de `AddToCartButton` con reloj real (complementa el test con fake timers) |

Unidades de ~4 pruebas × 3 navegadores = **~12–15 ejecuciones**.

### D3 — Job de CI `e2e-tests`, separado

Nuevo job en `.github/workflows/ci.yml`, en espejo de `backend-tests`:

- `services.postgres` con `pgvector/pgvector:pg16` (mismo que el job de
  backend).
- **Se reutiliza el patrón de override que ya funciona** en `backend-tests`:
  `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`,
  `SPRING_DATASOURCE_PASSWORD` por variable de entorno — es lo que hace que
  las pruebas de backend pasen en CI hoy aunque `application.properties`
  apunte a `dev_user`/`commerce_db`.
- Arranca el backend en segundo plano, espera a que responda, y después
  instala navegadores de Playwright con `--with-deps`.
- El informe de Playwright se sube con `if: always()`, en espejo de
  `jacoco-report` y `coverage-report`.
- `needs:` no se pone: el job corre **en paralelo** con los otros dos para no
  alargar el pipeline.

### D4 — Tres proyectos, una misma suite

`playwright.config.ts` declara `projects: [chromium, firefox, webkit]`.
El mismo directorio de pruebas se ejecuta tres veces; **no** se escriben tests
por navegador. Añadir un cuarto navegador es añadir una línea.

Para desarrollo rápido existe un script con `--project=chromium`.

### D5 — Semilla y aislamiento de datos en `globalSetup`

Es la decisión que sostiene todo lo demás. El *setup* garantiza, **antes** de
la primera prueba:

1. **Usuario de prueba** `e2e@nexus.dev` con contraseña conocida y
   **`email_verified = TRUE`**.
   - Se registra por la API real y el código de verificación se **lee de la
     columna `verification_code VARCHAR(6)` de la tabla `users`** para
     completar la verificación por el endpoint `/verify-email`. Así no hace
     falta SMTP, **no se crea ninguna migración** y además se ejercita el
     contrato real de registro.
   - **Idempotente**: si el login ya funciona, se salta todo el alta.
2. **Una dirección por defecto** vía `POST /api/v1/users/me/addresses`.
   El carrito **precoselecciona la dirección marcada `defaultAddress`**, así
   que las pruebas no tienen que tocar ese `select`.
3. **Reset de stock**: `UPDATE stock_items` restaurando **los valores exactos
   de la semilla** del único SKU que la suite compra (`843321900101`, talla M
   de `0432/021`): **150 / 5** en `WH_ARTEIXO` y **80 / 0** en
   `WH_ZARAGOZA`. Sin esto, cada ejecución consume una unidad y **a la 151ª
   la suite empezaría a fallar**.
   *(Corrección en implementación: la primera versión decía «40, las cifras de
   `V12`» y era falsa — `V12` no siembra stock de este producto; el blazer
   viene de `V1`.)*
   *(La prueba compra **talla M**: la talla L, `843321900102`, no tiene fila de
   stock en ninguna migración ⇒ el checkout devolvería `409`.)*

Implica **acceso directo a la BD desde el setup** (paquete `pg` en
`devDependencies`). Es la misma concesión que ya hace el propio CI al
levantar PostgreSQL, y se limita a lectura del código de verificación y a
restaurar cifras — **nunca escribe datos de negocio**.

> **Por qué no una migración de semilla**: `V12` ya siembra productos, así que
> hay precedente, pero una migración metería un usuario con contraseña
> conocida en el esquema de producción de forma permanente y **no serviría para
> resetear el stock**, que es el problema real. El *setup* resuelve ambos.

### D6 — Contra build de producción, `workers: 1`

- **`webServer` arranca `npm run build && npm run start`**: los E2E se ejecutan
  contra el mismo artefacto que sirve producción. Probar contra `next dev`
  es probar otra aplicación (dev tiene avisos, HMR y compilación en frío que
  añaden ruido y lentitud).
- **`workers: 1`**: hay **un solo usuario y una sola BD**. Ejecutar pruebas en
  paralelo haría que dos compras compitieran por el mismo stock y por el mismo
  token de sesión. La suite es corta; la serialización no duele y elimina una
  fuente entera de flakiness.

### D7 — Readiness: sondeo, no actuator

El backend **no tiene Actuator** ni endpoint `/health`. En lugar de añadirlo
(que sería tocar `backend/`), el *setup* sondea **`GET /api/v1/markets`**,
que es un endpoint público (`permitAll`) y que además sólo responde una vez
**Flyway ha terminado de migrar** — es decir, comprueba exactamente lo que
hace falta: aplicación levantada *y* esquema migrado.

El sondeo tiene techo (p. ej. 120 s) y, si se agota, **falla con un mensaje
que diga qué falta** en lugar de dejar un timeout críptico.

### D8 — Estructura y scripts

```
frontend/
├── playwright.config.ts      # al lado de vitest.config.ts
├── e2e/
│   ├── helpers/
│   │   ├── api.ts            # fetch crudo contra el backend (setup)
│   │   └── db.ts             # cliente pg + reset de stock
│   ├── global-setup.ts       # D5 + D7
│   └── smoke.spec.ts         # D2 — las 5 pruebas
```

| Script | Qué hace |
|:---|:---|
| `npm run test:e2e` | Build de producción + los 3 navegadores |
| `npm run test:e2e:quick` | Ídem sólo con Chromium (iteración local) |

`playwright.config.ts` **no** se toca desde `vitest.config.ts`: son runners
distintos y **Playwright no debe recoger los ficheros `*.spec.ts` de Vitest**
(`testDir` explícito para los dos).

### D9 — Convención de estado y cierre

Se aplica la **D11 de la Tarea 3.3**: el bloque «ESTADO ACTUAL» de `AGENTS.md`
se redacta **dentro de esta PR**, formulado para ser verdad **después** del
merge y **sin números de PR ni SHA**. Consecuencia: **no habrá PR de
documentación de cierre**.

### D10 — Firefox se valida en CI (decisión tomada durante la implementación)

Los **3 proyectos se mantienen** en `playwright.config.ts` (Chromium, Firefox
y WebKit), tal y como se aprobó. Lo que cambia es **dónde se demuestra** el
criterio:

- **En local**: la suite corre en verde sobre **Chromium y WebKit**
  (10/10 · 20,6 s).
- **Firefox no puede arrancar aquí.** Es un fallo del entorno, no del código:
  la build de Firefox Nightly 155 que empaqueta Playwright 1.63 **no arranca
  en modo headless** en este macOS 27.0.1. Está aislado con A/B — mismo
  binario, mismas flags `-juggler-pipe -silent`, misma ruta de perfil:

  | Variante | Resultado |
  |:---|:---|
  | `-profile <dir>` **sin** `-headless` | **vive** |
  | `-profile <dir>` **con** `-headless` | muere — `Could not find profile folder.` |
  | con `MOZ_HEADLESS=1` en vez de la flag | muere |
  | con perfil preexistente / perfil en el repo / `HOME` redirigido | muere |

  Chromium y WebKit arrancan headless sin incidencia.

- **Consecuencia**: el CA de `spec.md` R7 («verde en los 3 navegadores») se
  cumple **en CI**, sobre `ubuntu-latest`, donde el headless de Firefox es el
  camino más probado de Playwright. Si Firefox fallara allí, se vería en el
  PR — sin sorpresas silenciosas.

> **No se baja a 2 navegadores** para que quede verde en local: eso convertiría
> una limitación de esta máquina en una decisión de alcance del proyecto.

---

## 4. Orden de Implementación

1. Rama `feat/e2e-playwright` + `plan.md` + `spec.md` → **⛔ aprobación**
2. `tasks.md`
3. Instalar `@playwright/test` + `playwright.config.ts` (3 proyectos,
   `testDir`, `workers: 1`, `webServer` de producción) y los scripts
4. `globalSetup`: sondeo de readiness → usuario → dirección → reset de stock
5. Las 5 pruebas del smoke, empezando por la **compra completa** (la que
   arrastra todo lo demás)
6. **Local**: backend + Postgres corriendo, `npm run test:e2e` en verde en los
   3 navegadores
7. **CI**: job `e2e-tests` con postgres, backend en segundo plano y subida del
   informe
8. Baselines: `tsc`, ESLint, `vitest`, `build`, `test:e2e`,
   `git diff main --stat` sin `backend/`
9. Documentación en la misma PR (`CHANGELOG`, `README`, `AGENTS`, `MEMORY`)

## 5. Criterios de Aceptación (resumen — el detalle está en `spec.md`)

- [ ] `npx playwright test` ejecuta la suite en **chromium, firefox y webkit**
- [ ] La **compra completa** termina con un pedido visible (`ORD-…`) contra
      backend real
- [ ] `globalSetup` es **idempotente**: dos ejecuciones seguidas pasan sin
      sembrar duplicados ni agotar stock
- [ ] El job `e2e-tests` existe, arranca backend + PostgreSQL y sube el
      informe con `if: always()`
- [ ] `playwright.config.ts` usa `testDir` explícito y **no** arrastra los
      `*.spec.ts` de Vitest
- [ ] `git diff main --stat` **no toca `backend/`**
- [ ] `npx tsc --noEmit` · `npx eslint src scripts` · `npx vitest run` y
      `npm run build` siguen en verde — la suite E2E **añade**, no rompe
- [ ] Sin ADR

## 6. Estimación

| Bloque | Peso |
|:---|:---|
| Tooling (`@playwright/test`, config, scripts, instalación de navegadores) | medio |
| `globalSetup` (usuario + dirección + reset de stock + readiness) | **medio-alto** — es la pieza con más riesgo |
| 5 pruebas del smoke | medio |
| Job de CI con backend en segundo plano | medio |
| Documentación | bajo |

**Riesgo principal**: el *setup* (D5). Si no consigue dejar el entorno listo,
nada de lo demás funciona; por eso va antes que cualquier prueba. El segundo
riesgo es la **flakiness de red** entre Next y Spring en CI — mitigada con
`workers: 1` y con esperas por localizador (`getByRole` + `expect.poll`),
nunca con `waitForTimeout` fijo.
