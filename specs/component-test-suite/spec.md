# Spec: Tarea 4.1 — Suite de Pruebas Unitarias de Componentes

> **Estado**: 🟡 **PENDIENTE DE APROBACIÓN** ⛔ *punto de bloqueo SDD*
> **Fecha**: 2026-10-07
> **Rama**: `feat/component-test-suite`
> **Plan**: `specs/component-test-suite/plan.md`

> **Alcance acordado con el usuario (2026-10-07)**: **tests + cobertura + CI**
> para los 10 módulos de frontend sin test directo, **umbral congelado** sobre
> el valor medido (no un 90 % impuesto) y **ESLint a 0 errores** resolviendo
> los 3 preexistentes **sin `eslint-disable`**.

---

## 1. Requisitos

### R1 — Los 10 módulos sin test pasan a tenerlo

**Criterio**: cada uno de estos ficheros tiene un fichero de test propio, con
casos nombrados que digan qué se está comprobando.

| # | Módulo | Fichero de test nuevo |
|:--|:---|:---|
| 1 | `components/CatalogFilters.tsx` | `src/__tests__/CatalogFilters.test.tsx` |
| 2 | `components/CartItemRow.tsx` | `src/__tests__/CartItemRow.test.tsx` |
| 3 | `components/AddToCartButton.tsx` | `src/__tests__/AddToCartButton.test.tsx` |
| 4 | `components/SemanticSearchBar.tsx` | `src/__tests__/SemanticSearchBar.test.tsx` |
| 5 | `components/Toast.tsx` | `src/__tests__/Toast.test.tsx` |
| 6 | `components/OrderStatusBadge.tsx` | `src/__tests__/OrderStatusBadge.test.tsx` |
| 7 | `components/CartIcon.tsx` | `src/__tests__/CartIcon.test.tsx` |
| 8 | `hooks/useLocalStorage.ts` | `src/__tests__/useLocalStorage.test.tsx` |
| 9 | `lib/utils.ts` | `src/__tests__/Utils.test.ts` |
| 10 | `lib/checkout.ts` | `src/__tests__/Checkout.test.ts` |

Es el hueco medido comparando los imports reales de `src/__tests__/` con los
ficheros de `src/components`, `src/hooks` y `src/lib`. Los que no aparecen en
la lista **ya tienen test** (directo o a través de su página).

### R2 — Instrumentación de cobertura

**Criterio**: `npm run test:coverage` imprime el informe y sale con código
distinto de 0 si no se cumplen los umbrales.

- Dependencia **`@vitest/coverage-v8`** alineada con la major de Vitest
  (`^5`, sobre `vitest@5.0.2`) — una major distinta rompe el arranque.
- En `vitest.config.ts`, bloque `test.coverage`:
  - `provider: "v8"`
  - `reporter: ["text", "html", "lcov"]` — `text` es el que se ve en el log de
    CI, `html` y `lcov` para abrir el detalle.
  - `all: true` con `include: ["src/**/*.{ts,tsx}"]` para que entren en el
    informe también los ficheros que **ningún test importa**.
  - Excluidos de la medida: `src/__tests__/**`, `src/test/**` y los `*.d.ts`.
- Script en `package.json`: `"test:coverage": "vitest run --coverage"`.
- El script `"test"` y `npx vitest run` **siguen existiendo igual**.

### R3 — Umbral congelado sobre el valor medido

**Criterio**: `coverage.thresholds` está declarado en `vitest.config.ts`, con
un comentario que diga el valor medido y por qué está ahí.

- Se mide **después** de escribir los tests de R1 (suben la cobertura) y se
  fija el umbral **justo por debajo** de lo medido, con holgura mínima.
- Se fija sobre las **cuatro métricas**: `statements`, `branches`, `functions`
  y `lines`.
- **No se impone 90 %** ni ningún otro número de referencia: la regla
  aprobada es *nunca bajar*. Subir el umbral es una decisión futura y
  explícita; bajarlo, un cambio que debe verse en la PR.
- El número queda documentado en `specs/component-test-suite/tasks.md`.

### R4 — El job de CI mide y sube la cobertura

**Criterio**: en `.github/workflows/ci.yml`, el job `frontend-tests` ejecuta
cobertura y sube `frontend/coverage/`.

- El paso `Run frontend tests` pasa de `npx vitest run` a
  **`npm run test:coverage`**. Es obligatorio: los umbrales **sólo se evalúan
  con `--coverage`**, así que con el comando actual el umbral no protegería
  nada.
- Nuevo paso `Upload coverage report`, **espejo exacto** del del backend:
  `if: always()`, `actions/upload-artifact@v4`, `name: coverage-report`,
  `path: frontend/coverage/`.
- El paso `Build frontend` no cambia.

### R5 — ESLint a 0 errores sin supresiones

**Criterio**: `npx eslint src scripts` no imprime ni un problema, y no existe
ninguna directiva `eslint-disable` en el repositorio.

Los 3 errores y su arreglo (la regla `react-hooks/set-state-in-effect`
prohíbe **cualquier `setState` síncrono en el cuerpo del efecto** — también en
`useLayoutEffect`, comprobado—; un `setState` dentro de un callback sí está
permitido):

| # | Fichero | Arreglo |
|:--|:---|:---|
| 1 | `components/Toast.tsx:21` | **Ajuste de estado durante el render** para la salida (`prevVisible` → `setIsAnimating(false)` al ocultarse) y **temporizadores** para la entrada y el cierre. El cuerpo del efecto no escribe estado y la transición de 300 ms se conserva. Patrón de react.dev *«Adjusting state when a prop changes»*. |
| 2 | `context/AuthContext.tsx:36` | **Colapsar `if/else` en una sola cadena de promesa**: `token ? api.getCurrentUser() : Promise.resolve(null)` → `.then(setUser).catch(…).finally(() => setIsLoading(false))`. Sin token, `setUser(null)` deja el `user` en `null` — igual que antes. |
| 3 | `hooks/useLocalStorage.ts:17` | **`useSyncExternalStore`**: el hook deja de usar `useState` + efecto y lee `localStorage` como lo que es, un store externo. El valor está en el **primer render**, el SSR se resuelve con `getServerSnapshot` y las escrituras se propagan notificando a los suscriptores. |

> **Reabrir el arreglo 3 durante la implementación** (autorizado por la propia
> R8). La primera solución —la lectura en un `queueMicrotask` dentro del mismo
> efecto— pasaba el lint pero **rompió R8**: `CartContext.test` y
> `CartPage.test` dejaron de ver el valor persistido de forma síncrona tras
> `render()`. Descartado `useLayoutEffect` (la regla también la prohíbe) y
> adoptado `useSyncExternalStore`, que resuelve la causa en lugar de
> desplazarla en el tiempo. El contrato del hook **no cambia**: `useLocalStorage`
> sigue devolviendo `[storedValue, setValue, isHydrated] as const`.

Además se limpian los **4 warnings** actuales: imports sin usar en
`CartDrawer.test.tsx`, `ErrorBoundary.test.tsx`, `Skeleton.test.tsx` y
`AuthContext.tsx`.

**Prohibido** `eslint-disable`, `eslint-disable-next-line`, `@ts-ignore` o
cualquier comentario de supresión equivalente (verificable con grep).

### R6 — Cada arreglo de lint tiene su test

**Criterio**: los tres cambios de R5 están cubiertos por tests que fallarían si
el comportamiento se rompiera.

| Arreglo | Caso que lo protege |
|:---|:---|
| `Toast` | Alternar `isVisible` `false → true → false → true`: el toast vuelve a aparecer con su mensaje y vuelve a cerrarse solo. Se usa `vi.useFakeTimers()`. |
| `AuthContext` | **Sin token**, `isLoading` pasa a `false` y `user` queda `null`; **con token**, `isLoading` se mantiene `true` hasta que `api.getCurrentUser()` resuelve. Fichero nuevo `src/__tests__/AuthContext.test.tsx`. |
| `useLocalStorage` | Con un valor ya persistido, `stored` **lo refleja desde el primer render** (éste es exactamente el contrato que R8 protegía) e `isHydrated` es `true` en el cliente; `setValue` persiste, notifica y **no cambia la identidad** del snapshot mientras el contenido no cambie. |

### R7 — Estilo y calidad de los tests

**Criterio**: los tests nuevos siguen la convención del proyecto y son
deterministas.

- Estructura **GIVEN-WHEN-THEN** con comentario en español, como en backend.
- `it(...)` con nombre describiente **en español** que diga qué se verifica.
- Interacciones con **`userEvent`** (no `fireEvent`), con **una excepción
  documentada**: el test «la confirmación desaparece sola a los 2500 ms» de
  `AddToCartButton` necesita clic bajo temporizadores falsos, y user-event v14
  se cuelga indefinidamente en esa combinación (comprobado con las cuatro
  variantes: `toFake` completo o sólo `setTimeout` × con y sin `advanceTimers`,
  y con `delay: null`). Ahí se usa `fireEvent` con un comentario que lo explica;
  el resto del fichero usa `userEvent`.
- **Sin red real**: `@/lib/api` se mockea igual que en los tests existentes.
- **Sin temporizadores reales**: todo lo que espere a un temporizador usa
  `vi.useFakeTimers()` + `vi.advanceTimersByTime()`.
- Sin dependencias nuevas de test: ya están `vitest@5`, `@testing-library/react`,
  `user-event` y `jest-dom`.

### R8 — Sin cambio de comportamiento observable

**Criterio**: los 3 arreglos de R5 son refactors, no cambios funcionales.

- Todos los tests **preexistentes siguen en verde** sin tocar su aserción
  (si un test existente tuviera que cambiar su aserción, el arreglo no era un
  refactor y hay que reabrirlo).
- Se comprueba además con una pasada manual: arrancar el frontend, verificar
  que **el toast aparece y se cierra solo**, que **un carrito persistido se
  recarga** y que **`/login` sin sesión redirige**.

### R9 — Baselines y alcance

**Criterio**: todo verde y el backend intacto.

- `npx tsc --noEmit` sin errores.
- `npx eslint src scripts` → **0 problemas** (R5).
- `npx vitest run` en verde; `npm run test:coverage` en verde.
- `npm run build` sin errores.
- `git diff main --stat` **no toca `backend/`**.
- **Sin ADR**: `@vitest/coverage-v8` es *tooling* de desarrollo y `ci.yml` ya
  existía; no cambia stack ni arquitectura.

### R10 — Documentación y cierre

**Criterio**: la documentación va **dentro de esta misma PR**.

- `CHANGELOG.md` — entrada en `[Unreleased]`.
- `README.md` — cómo ejecutar la cobertura localmente.
- `AGENTS.md` — regla de cobertura en *Testing* + bloque «ESTADO ACTUAL»
  redactado en la PR, **verdad después del merge y sin números de PR ni SHA**
  (**D11** de la Tarea 3.3).
- `MEMORY.md` — Tarea 4.1 completada.
- **Sin PR de documentación de cierre** (consecuencia de D11).

---

## 2. Configuración

### `frontend/vitest.config.ts` (bloque nuevo)

```ts
coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    include: ["src/**/*.{ts,tsx}"],
    exclude: ["src/__tests__/**", "src/test/**", "src/**/*.d.ts"],
    // Umbrales: piso congelado sobre lo medido el 2026-10-07 tras añadir los
    // 10 ficheros de R1. Subirlos es una decisión explícita; no bajarlos.
    thresholds: { statements: 77, branches: 76, functions: 74, lines: 79 },
}
```

**Nota de implementación**: la opción `all: true` **no existe en Vitest 5** —
no compila (`tsc` la rechaza) porque fue retirada; lo que hace el trabajo es el
`include` explícito, que ya mide todos los ficheros que coinciden con el globo
aunque ningún test los importe. Comprobado empíricamente: la cifra es idéntica
con y sin `all`.

Los cuatro valores son la **medida real** de `tasks.md` §4
(78.01 / 76.32 / 74.72 / 79.85) menos un punto redondo de holgura. **La spec no
los inventa**: si se escribieran antes de medir, el umbral sería mentira.

### `frontend/package.json`

```json
"scripts": {
    "test:coverage": "vitest run --coverage"
}
```

### `.github/workflows/ci.yml` (job `frontend-tests`)

```yaml
      - name: Run frontend tests with coverage
        working-directory: ./frontend
        run: npm run test:coverage

      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: frontend/coverage/
```

---

## 3. Contratos de comando

| Comando | Qué debe hacer | Código de salida |
|:---|:---|:---|
| `npx vitest run` | Ejecuta la suite **sin** cobertura, igual que hoy | `0` si todo pasa |
| `npm run test:coverage` | Suite **con** informe e **incluye la comprobación de umbrales** | `0` si pasa; `≠0` si un test falla **o** la cobertura queda por debajo del umbral |
| `npx eslint src scripts` | Lint completo | `0` — **sin errores ni warnings** |
| `npx tsc --noEmit` | Tipos | `0` |
| `npm run build` | Build de producción | `0` |

**Contrato de CI**: el job `frontend-tests` falla si falla cualquiera de
`test:coverage` o `build`; el artefacto `coverage-report` se sube **aunque el
job falle** (`if: always()`), igual que `jacoco-report`.

---

## 4. Criterios de Aceptación

### R1 — Los 10 módulos

- [x] Existen los **10** ficheros de test de la tabla de R1
- [x] `CatalogFilters` — pinta las familias **con su recuento** tal y como las
      dan las props, sin derivarlas
- [x] `CatalogFilters` — elegir una familia **conserva** `size`/`color`/`sort`
      (acumula, no sustituye)
- [x] `CatalogFilters` — «Todas»/«Todos» quita **sólo su campo**
- [x] `CatalogFilters` — «Limpiar filtros» emite `onChange({})` y sólo aparece
      con filtros activos (`sort !== "default"` cuenta como activo)
- [x] `CatalogFilters` — con `disabled` aplica `opacity-50 pointer-events-none`
- [x] `CartItemRow` — muestra nombre, talla y color
- [x] `CartItemRow` — el total es `unitPrice × quantity` con **2 decimales**
- [x] `CartItemRow` — «Aumentar cantidad» llama a `updateQuantity(..., n+1)`
- [x] `CartItemRow` — «Disminuir» con cantidad **> 1** decrementa
- [x] `CartItemRow` — «Disminuir» con cantidad **1** llama a `removeItem` (no
      deja la línea en 0)
- [x] `CartItemRow` — «Eliminar … del carrito» llama a `removeItem`
- [x] `CartItemRow` — la imagen es `ProductThumb`, **nunca** un `<img>`
- [x] `AddToCartButton` — al pulsar llama a `addItem` con el `CartItem`
      **completo** y `quantity: 1`
- [x] `AddToCartButton` — muestra «Añadido a la bolsa — {name} (Talla {size})»
- [x] `AddToCartButton` — la confirmación desaparece a los **2500 ms**
      (`vi.useFakeTimers`)
- [x] `AddToCartButton` — con `disabled` el botón está deshabilitado y no
      llama a `addItem`
- [x] `SemanticSearchBar` — enviar con texto llama a `onSearch` con el valor
      **`trim()`**ado
- [x] `SemanticSearchBar` — enviar con sólo espacios **no** llama a `onSearch`
- [x] `SemanticSearchBar` — «Limpiar» llama a `onClear` y vacía el input
- [x] `SemanticSearchBar` — el botón «Limpiar» sólo se pinta si hay
      `activeQuery`
- [x] `SemanticSearchBar` — el botón de envío está deshabilitado con
      `isLoading` o input vacío, y el texto pasa a «Buscando...»
- [x] `Toast` — sin `isVisible` y sin animación pendiente **no** renderiza nada
- [x] `Toast` — visible ⇒ `role="status"` y `aria-live="polite"` con el mensaje
- [x] `Toast` — transcurrido `duration` (y los 300 ms de salida) llama a
      `onClose` — con temporizadores falsos
- [x] `OrderStatusBadge` — los 5 estados (`PENDING`, `CONFIRMED`, `SHIPPED`,
      `DELIVERED`, `CANCELLED`) muestran su etiqueta en español
- [x] `OrderStatusBadge` — cada estado aplica **su** estilo, distinto del resto
- [x] `CartIcon` — sin artículos **no** hay badge; con 1 sí
- [x] `CartIcon` — con más de 99 muestra **`99+`**
- [x] `CartIcon` — el `aria-label` es «Carrito con N artículos»
- [x] `useLocalStorage` — devuelve el valor inicial si no hay nada
      persistido
- [x] `useLocalStorage` — lee un valor ya persistido **en el primer render**
      (sin esperar a ningún efecto)
- [x] `useLocalStorage` — `setValue` persiste en `localStorage` y acepta
      updater de función
- [x] `useLocalStorage` — `setValue` **notifica**: otra instancia montada con
      la misma clave ve el cambio
- [x] `useLocalStorage` — el snapshot **conserva la identidad** mientras el
      contenido no cambie (condición que React impone a `getSnapshot`)
- [x] `useLocalStorage` — **JSON inválido** ⇒ conserva el valor, hace
      `console.warn` y **no lanza**
- [x] `useLocalStorage` — `isHydrated` es `true` en el cliente desde el primer
      render y `false` en el snapshot de servidor
- [x] `Utils` — `cn()` une clases y **resuelve conflictos** (`px-2 px-4` ⇒
      sólo `px-4`)
- [x] `Checkout` — `JUST_CHECKED_OUT_KEY` tiene el valor que distingue
      «acabo de comprar» de «estoy mirando un pedido viejo»

### R2–R4 — Cobertura y CI

- [x] `@vitest/coverage-v8` aparece en `devDependencies` con major **5**
- [x] `vitest.config.ts` declara `provider`, `reporter`, `include` y
      `exclude` como en §2 (**sin `all`**, que Vitest 5 ya no admite)
- [x] Existe `"test:coverage": "vitest run --coverage"` en `package.json`
- [x] `npm run test:coverage` **imprime el informe** en el log
- [x] `coverage.thresholds` declara las **4** métricas con su comentario
- [x] El umbral está **por debajo** de lo medido y el valor queda anotado en
      `tasks.md`
- [x] **Comprobación negativa**: con el umbral deliberadamente inflado el
      comando **falla** (prueba de que el umbral protege de verdad)
- [x] `ci.yml` ejecuta `npm run test:coverage` y sube `frontend/coverage/`
      con `if: always()`

### R5–R6 — ESLint y tests de los arreglos

- [x] `npx eslint src scripts` → **0 errores, 0 warnings**
- [x] `grep -rn "eslint-disable" src scripts` → **0 coincidencias**
- [x] Existe `src/__tests__/AuthContext.test.tsx` con los dos casos de R6
- [x] `Toast.test.tsx` incluye el caso de alternancia de `isVisible` (R6)
- [x] `useLocalStorage.test.tsx` incluye el caso de R6 (valor persistido en el
      primer render + `isHydrated` en cliente)

### R7–R9 — Calidad y baselines

- [x] Los tests nuevos usan `userEvent` y están en GIVEN-WHEN-THEN en español
- [x] Ningún test nuevo usa temporizadores reales ni red real
- [x] **Ningún test preexistente ha tenido que cambiar su aserción** (los
      cambios de R5 son refactors)
- [x] `npx tsc --noEmit` sin errores
- [x] `npx vitest run` en verde
- [x] `npm run build` sin errores
- [x] `git diff main --stat` **no toca `backend/`**
- [x] Verificación manual: toast que se cierra solo, carrito persistido que se
      recarga y `/login` sin sesión que redirige
- [x] Sin ADR

### R10 — Documentación

- [x] `CHANGELOG.md` con la entrada en `[Unreleased]`
- [x] `README.md` documenta `npm run test:coverage`
- [x] `AGENTS.md` con la regla de cobertura y el estado redactado en la PR
- [x] `MEMORY.md` con la Tarea 4.1 completada
- [x] Sin PR de documentación de cierre

---

## 5. Casos de Error

| Caso | Comportamiento esperado |
|:---|:---|
| Umbral no alcanzable en desarrollo local | `npm run test:coverage` sale con `≠0`. Se fija holgura mínima sobre lo medido precisamente para que esto **no** sea habitual |
| Ejecutar `npx vitest run` esperando que el umbral proteja | No lo hace: los umbrales sólo se evalúan con `--coverage`. Por eso CI ejecuta `test:coverage` |
| `@vitest/coverage-v8` con major distinta a `vitest` | El arranque de Vitest falla → se instala alineada (`^5`) |
| Test que depende del paso real del tiempo | Flaky → `vi.useFakeTimers()` obligatorio en `Toast` y `AddToCartButton` |
| `localStorage` con JSON corrupto | `console.warn` + valor inicial, sin excepción (ya es el comportamiento actual; se fija con test) |
| `localStorage` lleno o bloqueado (`setItem` lanza) | `setValue` captura y avisa; el componente no se rompe |
| El refactor de `AuthContext` apague `isLoading` antes de tiempo | `AuthContext.test.tsx` y `ProtectedRoute.test.tsx` lo detectan |
| Un test existente exige cambiar su aserción | **No se permite**: el cambio de R5 no sería un refactor → se reabre la decisión |

---

## 6. Trazabilidad

| Req | Archivos | Tests |
|:---|:---|:---|
| R1 | — | los **10** ficheros nuevos de `src/__tests__/` |
| R2 | `vitest.config.ts`, `package.json` | `tasks.md` §3 + ejecución |
| R3 | `vitest.config.ts` (`coverage.thresholds`) | comprobación negativa (§4) |
| R4 | `.github/workflows/ci.yml` | revisión de la PR + CI en verde |
| R5 | `Toast.tsx`, `AuthContext.tsx`, `useLocalStorage.ts` + 4 imports | `npx eslint src scripts` |
| R6 | — | `Toast.test.tsx`, `AuthContext.test.tsx`, `useLocalStorage.test.tsx` |
| R7 | — | revisión de los ficheros de test |
| R8 | — | suite preexistente intacta + verificación manual |
| R9 | `package.json`, `vitest.config.ts`, `ci.yml` | baselines |
| R10 | `CHANGELOG`, `README`, `AGENTS`, `MEMORY` | revisión |
