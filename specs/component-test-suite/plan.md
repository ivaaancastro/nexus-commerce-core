# Plan — Tarea 4.1 · Suite de Pruebas Unitarias de Componentes

| Campo | Valor |
|:---|:---|
| **Feature** | `component-test-suite` |
| **Rama** | `feat/component-test-suite` |
| **Fase** | 4 — Calidad Enterprise |
| **Fecha** | 2026-10-07 |
| **Estado** | Borrador → **⛔ pendiente de aprobación** |

---

## 0. Preguntas previas (respondidas por el usuario el 2026-10-07)

1. **¿Alcance de la 4.1?** → **Tests + cobertura + CI**
2. **¿Qué regla de cobertura?** → **Medir y congelar el actual**
3. **¿Dejamos ESLint en 0 errores?** → **Sí, se arreglan los 3**

---

## 1. Objetivos

1. Los **10 módulos de frontend sin test directo** pasen a tenerlo:
   `AddToCartButton`, `CartIcon`, `CartItemRow`, `CatalogFilters`,
   `OrderStatusBadge`, `SemanticSearchBar`, `Toast`,
   `hooks/useLocalStorage`, `lib/checkout`, `lib/utils`.
2. El frontend pase a **medir cobertura** y a **impedir que baje**: umbral en
   `vitest.config.ts` verificado dentro del job de CI.
3. El paso de CI de frontend suba el reporte como artefacto, en espejo del
   `jacoco-report` que ya sube el de backend.
4. **ESLint a 0 errores** (hoy 3), **sin** `eslint-disable` ni comentarios de
   supresión.

## 2. No-Objetivos

- **No subir la cobertura a 90 %**. La regla aprobada es «nunca baja», no un
  número de referencia heredado del backend (D3).
- **No tocar `backend/`** — ni tests, ni JaCoCo, ni `pom.xml`.
- **No E2E** (eso es la 4.2, con Playwright) ni **auditoría CWV/a11y** (4.3).
- **No cambiar de runner ni de librería de tests**: seguimos con Vitest 5 +
  React Testing Library + jsdom.
- **No refactor de comportamiento**, salvo los 3 arreglos de ESLint (D5).
- **No tests de páginas**: las 13 páginas del App Router ya tienen los suyos y
  siguen cubriendo sus propios flujos.
- **No ADR**: `@vitest/coverage-v8` es *tooling* de desarrollo y `ci.yml` ya
  existe; no cambia stack ni arquitectura.

---

## 3. Decisiones de Diseño

### D1 — Alcance: los 10 módulos sin test, ni uno más

Es el hueco medido con los imports reales de `src/__tests__/`:

| Módulo | Líneas | Por qué importa |
|:---|---:|:---|
| `components/CatalogFilters.tsx` | 188 | El **acumular** filtros (D2 de 3.1) y «Limpiar filtros»: si se regresara a *sustituir*, rompería el AND del backend |
| `components/CartItemRow.tsx` | 96 | Decrementar con cantidad 1 ⇒ **eliminar**, no dejar a 0 |
| `components/AddToCartButton.tsx` | 77 | Construye el `CartItem` completo y dispara la confirmación temporal |
| `components/SemanticSearchBar.tsx` | 69 | Envío con espacios ⇒ `trim()`; vacío ⇒ no llama; botón deshabilitado |
| `components/Toast.tsx` | 47 | Cierre automático y animación de salida (y recibe uno de los arreglos de lint) |
| `components/OrderStatusBadge.tsx` | 40 | 5 estados × (etiqueta + estilo) — tabla de correspondencias |
| `components/CartIcon.tsx` | 36 | Badge: sin artículos ⇒ sin badge; `> 99` ⇒ `99+` |
| `hooks/useLocalStorage.ts` | 38 | Persistencia, JSON inválido y `isHydrated` (recibe otro arreglo de lint) |
| `lib/utils.ts` | 10 | `cn()`: resolución de conflictos Tailwind (`px-2` vs `px-4`) |
| `lib/checkout.ts` | 2 | `JUST_CHECKED_OUT_KEY` — constante usada por el flujo de compra |

Los tests se apoyan en lo que ya existe (mocks de `api`, providers del árbol
de `layout.tsx`) y **no duplican infraestructura**.

### D2 — Instrumentación de cobertura

- `@vitest/coverage-v8` en su **misma major que Vitest** (5.0.3 sobre
  `vitest@5.0.2`) — cualquier desajuste de versión rompe el arranque.
- Provider `v8`; reporteros `text` (para verlo en el log de CI), `html` y
  `lcov`.
- **`all: true`** para que entren en el informe también los ficheros que ningún
  test importa — es justo lo que queremos vigilar.
- **No se fija umbral todavía**: primero tests, después medida (D3).

### D3 — Umbral: congelar el piso actual, no perseguir un número

1. Se escriben los tests (suben la cobertura).
2. Se ejecuta `npm run test:coverage` y se anota el resultado real.
3. Se fija `coverage.thresholds` **justo por debajo** de ese valor, con
   holgura mínima, y se deja anotado en `vitest.config.ts` el porqué del
   número.
4. A partir de ahí **el job de CI falla si la cobertura baja**.

Decisión explícita: **no** se impone 90 %. Un umbral inalcanzable se cumple
apagando la luz un día; un umbral congelado obliga a no regresar. Si más
adelante se quiere subir, se sube el umbral — nunca lo contrario.

### D4 — Reporte en CI, en espejo del backend

En `.github/workflows/ci.yml`, job `frontend-tests`:

- `npx vitest run` → **`npm run test:coverage`** (así se aplican los umbrales,
  que sólo se evalúan con `--coverage`).
- Nuevo paso `actions/upload-artifact` de `frontend/coverage/` con nombre
  `coverage-report`, igual que el `jacoco-report` del backend.
- El paso `npm run build` no cambia.

### D5 — Los 3 arreglos de ESLint, sin `eslint-disable`

La regla `react-hooks/set-state-in-effect` prohíbe **cualquier `setState`
síncrono en el cuerpo de un efecto** (verificado empíricamente: los `setState`
que van dentro de un callback —`setTimeout`, promesa— **no** la activan, pero
tampoco la salva `useLayoutEffect`, que la dispara igual). Los tres arreglos:

| Fichero | Arreglo | Por qué es legítimo |
|:---|:---|:---|
| `Toast.tsx:21` | **Ajuste de estado durante el render** para la salida (`prevVisible` → `setIsAnimating(false)` al ocultarse) + **temporizadores** para la entrada y el cierre; el cuerpo del efecto no escribe estado | El estado se **deriva** de la prop en el render en que cambia — patrón de react.dev *«Adjusting state when a prop changes»* — y la entrada sigue cayendo tras el primer pintado, así que **la transición de 300 ms se conserva** |
| `AuthContext.tsx:36` | Colapsar el `if/else` en **una sola cadena de promesa**: `token ? api.getCurrentUser() : Promise.resolve(null)` → `.then(setUser).catch(...).finally(() => setIsLoading(false))` | Desaparece la rama síncrona; el código queda **más corto** y con idéntico resultado (sin token → `setUser(null)` + `isLoading = false`). Verificado: no afecta a ningún test |
| `useLocalStorage.ts:17` | **`useSyncExternalStore`**: el hook deja de tener efecto y de `useState`, y lee `localStorage` como lo que es, un store externo | Es la forma que React prescribe para esto. El valor está en el **primer render**, SSR seguro vía `getServerSnapshot`, y de paso sincronización entre pestañas |

#### Reabrir D5b (`useLocalStorage`) — decisión tomada durante la implementación

El primer intento fue mover la lectura a un `queueMicrotask` dentro del mismo
efecto: pasaba el lint, pero **rompió R8** — dos tests preexistentes
(`CartContext` y `CartPage`) pasaron a fallar porque el valor persistido ya no
estaba disponible de forma síncrona tras `render()`. La propia spec dice que en
ese caso *«hay que reabrirlo»*, así que se reabrió con el usuario.

Se descartó `useLayoutEffect` (comprobado: la regla también la prohíbe) y se
adoptó **`useSyncExternalStore`**, que además resuelve el problema de raíz en
lugar de desplazarlo en el tiempo. Consecuencias que hay que tener presentes:

- El hook crece de 38 a ~100 líneas y añade **caché de snapshots**: es
  obligatorio, porque `getSnapshot` debe devolver la misma referencia mientras
  el contenido no cambie y los `CartItem[]`/`Market` se parsean de JSON.
- `isHydrated` deja de ser «ya pasó el efecto» y pasa a ser **snapshot
  servidor/cliente**: `false` en servidor y durante el hidratado, `true` en el
  cliente. En los tests jsdom es `true` desde el primer render.
- Toca la persistencia del carrito y del mercado, pero **sin cambiar su
  contrato**: los 206 tests preexistentes siguen en verde sin tocar ni una
  aserción.

### D6 — Estilo de los tests

Mismo criterio que en backend: **GIVEN-WHEN-THEN** con `@DisplayName`
descriptivos en español (aquí, nombres de `it(...)`), assertions con
`expect(...)` de Vitest + `@testing-library/jest-dom`, interacciones con
`userEvent` (no `fireEvent`). Los ficheros nuevos se agrupan en
`src/__tests__/` con el mismo patrón que ya existe.

### D7 — Convención de estado y cierre

Se aplica la **D11 de la Tarea 3.3**: el bloque «ESTADO ACTUAL» de `AGENTS.md`
se redacta **dentro de esta PR**, formulado para ser verdad **después** del
merge y **sin números de PR ni SHA**. Consecuencia: **no habrá PR de
documentación de cierre**.

---

## 4. Orden de Implementación

1. Rama `feat/component-test-suite` + `plan.md` + `spec.md` → **⛔ aprobación**
2. `tasks.md`
3. Instalar `@vitest/coverage-v8`, cablear `vitest.config.ts` y el script
   `test:coverage` **sin umbral todavía**
4. Los **3 arreglos de ESLint** + test que reproduzca cada uno (la regla
   obliga a que un bug corregido tenga su test)
5. Los **10 ficheros de test**, de menor a mayor superficie
6. **Medir** → fijar el umbral → comprobar que `test:coverage` pasa
7. **CI**: `npm run test:coverage` + subida del artefacto
8. Baselines: `tsc`, ESLint **0**, `vitest`, `build`, `git diff main` sin
   `backend/`
9. Documentación en la misma PR (`CHANGELOG`, `README`, `AGENTS`, `MEMORY`)

## 5. Criterios de Aceptación (resumen — el detalle está en `spec.md`)

- [ ] Los 10 módulos tienen test directo con nombre de caso describiente
- [ ] `npm run test:coverage` existe, imprime el informe y **aplica el umbral**
- [ ] `vitest.config.ts` declara `coverage.thresholds` con el piso congelado
      y un comentario que explique el número
- [ ] El job `frontend-tests` de CI ejecuta cobertura y sube `coverage/`
- [ ] `npx eslint src scripts` → **0 errores, 0 warnings**… como mínimo 0
      errores; se revisan también los 4 warnings de imports sin usar
- [ ] Ningún `eslint-disable` en el repositorio (grep)
- [ ] `npx tsc --noEmit` · `npm run build` · `npx vitest run` en verde
- [ ] `git diff main --stat` **no toca `backend/`**

## 6. Estimación

| Bloque | Peso |
|:---|:---|
| Tooling (dependencia, config, CI) | bajo |
| 3 arreglos de lint + sus tests | bajo-medio |
| 10 ficheros de test | medio-alto — `CatalogFilters` y `CartItemRow` son los que más casos tienen |
| Medición + umbral | bajo |
| Documentación | bajo |

Sin ADR y sin PR de documentación de cierre.
