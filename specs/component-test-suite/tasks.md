# Tasks — Tarea 4.1 · Suite de Pruebas Unitarias de Componentes

> **Spec**: `specs/component-test-suite/spec.md` (aprobada 2026-10-07)
> **Rama**: `feat/component-test-suite`

---

## 0. Aprobación

- [x] `plan.md` escrito
- [x] `spec.md` escrito
- [x] **Spec aprobada por el usuario** (2026-10-07) ⛔

---

## 1. Tooling de cobertura (R2)

- [x] `npm i -D @vitest/coverage-v8` alineado con Vitest (5.0.3 sobre vitest 5.0.3)
- [x] `vitest.config.ts`: `provider`, `reporter`, `include`, `exclude`,
      `thresholds` — **sin `all`**: en Vitest 5 esa opción ya no existe (no
      compilaba) y `include` explícito hace el mismo trabajo; comprobado que la
      cifra es idéntica con y sin ella
- [x] `package.json`: script `test:coverage`
- [x] `npx vitest run` **sin** `--coverage` sigue funcionando igual
- [x] `npm run test:coverage` imprime el informe

> **Medida base (sin los tests nuevos)**: statements 76.36 · branches 76.22 ·
> functions 70.89 · lines 78.19

---

## 2. Los 3 arreglos de ESLint (R5) + sus tests (R6)

- [x] `Toast.tsx` → estado derivado en render (`prevVisible`) para la salida +
      temporizadores para entrada/cierre
- [x] `AuthContext.tsx` → colapsar `if/else` en una sola cadena de promesa
- [x] `useLocalStorage.ts` → **`useSyncExternalStore`** (D5b reabierta: el
      primer intento con `queueMicrotask` rompía R8; ver `plan.md`)
- [x] Limpieza de los **4 warnings** (imports sin usar en `CartDrawer.test`,
      `ErrorBoundary.test`, `Skeleton.test` y `AuthContext.tsx`)
- [x] `grep -rn "eslint-disable" src scripts` → 0
- [x] **Ningún test preexistente ha cambiado su aserción** (R8) — los 206
      siguen en verde tal y como estaban
- [x] `Toast.test.tsx` — alternancia de `isVisible` + cierre automático (R6)
- [x] `AuthContext.test.tsx` (nuevo) — sin token ⇒ `isLoading=false` y
      `user=null`; con token ⇒ `isLoading=true` hasta resolver; token caducado
      ⇒ se borra la clave (R6)
- [x] `useLocalStorage.test.tsx` — valor en el primer render + `isHydrated`
      (R6). **Extensión `.tsx`**: el fichero lleva JSX, no `.ts`

---

## 3. Los 10 ficheros de test (R1)

- [x] `CatalogFilters.test.tsx` — familias con recuento · acumular ·
      «Todas»/«Todos» sólo quitan su campo · «Limpiar filtros» · `sort` cuenta
      como activo · `disabled` · opción activa
- [x] `CartItemRow.test.tsx` — datos · total × cantidad con 2 decimales ·
      incrementar · decrementar · **cantidad 1 ⇒ `removeItem`** · eliminar ·
      `ProductThumb` y no `<img>`
- [x] `AddToCartButton.test.tsx` — `CartItem` completo · confirmación ·
      desaparece a 2500 ms · `disabled`
- [x] `SemanticSearchBar.test.tsx` — `trim()` · espacios vacíos no envían ·
      «Limpiar» · «Limpiar» sólo con `activeQuery` · deshabilitado +
      «Buscando...» · parte de `activeQuery`
- [x] `Toast.test.tsx` — invisible ⇒ nada · `role="status"` + `aria-live` ·
      `onClose` con temporizadores falsos · salida sin dejar el nodo
- [x] `OrderStatusBadge.test.tsx` — 5 etiquetas en español · estilo propio
      por estado · `uppercase`/`tracking-widest` · extremos de la paleta
- [x] `CartIcon.test.tsx` — sin badge · badge con 1 · `99+` · `aria-label`
      vacío y con artículos
- [x] `useLocalStorage.test.tsx` — inicial · **valor en el primer render** ·
      escribe · updater · notifica entre instancias · identidad estable ·
      JSON inválido · `isHydrated` · snapshot de servidor
- [x] `Utils.test.ts` — `cn()` une, resuelve conflictos y descarta falsy
- [x] `Checkout.test.ts` — `JUST_CHECKED_OUT_KEY` y su recorrido por
      `sessionStorage`
- [x] GIVEN-WHEN-THEN, `userEvent` salvo la excepción documentada de R7,
      temporizadores falsos donde toca, sin red real

---

## 4. Medida y umbral (R3)

- [x] Ejecutar `npm run test:coverage` **tras** los tests de §3 y anotar el
      resultado aquí abajo
- [x] Fijar `coverage.thresholds` (las 4 métricas) **justo por debajo** de lo
      medido, con el comentario en `vitest.config.ts`
- [x] **Comprobación negativa**: umbral inflado a propósito (`statements: 100`)
      ⇒ `npm run test:coverage` **falló con EXIT=1** y se revirtió
- [x] `npm run test:coverage` en verde con el umbral real (EXIT=0)

> **Medida 2026-10-07** — estable en 4 corridas seguidas; la primera dio
> 78.09/76.44 y se tomó el mínimo observado como referencia.
>
> | Métrica | Medido | Umbral fijado |
> |:---|---:|---:|
> | statements | 78.01 | **77** |
> | branches | 76.32 | **76** |
> | functions | 74.72 | **74** |
> | lines | 79.85 | **79** |
>
> Bajada vs. la medida base: statements 76.36 → 78.01 · branches 76.22 → 76.32
> · functions 70.89 → 74.72 · lines 78.19 → 79.85. La cifra se frena por
> `lib/api.ts` (20.77 %, toda la capa HTTP se mockea), que queda **dentro** del
> alcance: el `include` explícito lo mete en la medición sin trampas.
>
> **Hallazgo**: la opción `all: true` **ya no existe en Vitest 5** — `tsc` la
> rechaza (`TS2769`, no está en `CoverageOptions`). Se retiró y el `include`
> explícito hace el trabajo. Comprobado empíricamente: la cifra es **idéntica**
> con y sin ella (78.01 / 76.32 / 74.72 / 79.85), así que no era necesaria.

---

## 5. CI (R4)

- [x] `ci.yml`: `npx vitest run` → `npm run test:coverage`
- [x] `ci.yml`: paso `Upload coverage report` con `if: always()`,
      `actions/upload-artifact@v4`, `name: coverage-report`,
      `path: frontend/coverage/`
- [x] Paso `Build frontend` intacto (sigue el último, después del upload)

---

## 6. Baselines (R9)

- [x] `npx tsc --noEmit` sin errores — **EXIT=0** (tras retirar `all`)
- [x] `npx eslint src scripts` → **0 errores, 0 warnings**; `grep` de
      `eslint-disable` en `src scripts` = **0 coincidencias**
- [x] `npx vitest run` en verde — **38 ficheros · 270 tests**
- [x] `npm run test:coverage` en verde con umbral aplicado — EXIT=0
- [x] `npm run build` sin errores — 14 rutas generadas
- [x] `git diff main --stat` **no toca `backend/`** (R9)
- [x] Verificación manual en navegador (1440×900, dev server + backend):
  - `/profile` sin sesión **redirige a `/login`** ✓
  - carrito con 1 artículo **sobrevive a la recarga** (badge + `CartItemRow`):
        `useSyncExternalStore` lee el valor ya en el primer render ✓
  - toast de devolución: aparece con «DEVOLUCIÓN SOLICITADA · 79.95 EUR»,
        estilo editorial correcto y **se cierra solo a los 2689 ms**
        (2500 de lectura + 300 de salida), medido con un observador en la
        página (sin latencia de modelo entre el envío y la observación) ✓
  - consola **sin errores ni avisos de hidratado** en todo el recorrido ✓
- [x] Sin ADR (R9) — no existe `docs/adr/*` nuevo; `@vitest/coverage-v8` es
      tooling de desarrollo y `ci.yml` ya existía

> **Nota de entorno**: para llegar al flujo de devolución se pasó a `DELIVERED`
> en la **BD local** el pedido `ORD-6DB9E249` de la cuenta de pruebas (antes
> `CONFIRMED`) — el endpoint exige pedido entregado. Es **sólo dato local**,
> no toca ningún fichero del repo.

---

## 7. Documentación y cierre (R10)

- [x] `spec.md` §4 — todos los criterios marcados en verde
- [x] `CHANGELOG.md` — entrada en `[Unreleased]`
- [x] `README.md` — cómo ejecutar la cobertura (`npm run test:coverage`)
- [x] `AGENTS.md` — regla de cobertura en *Testing* + bloque «ESTADO
      ACTUAL» redactado en la PR (verdad tras el merge, **sin PR ni SHA**)
- [x] `MEMORY.md` — Tarea 4.1 completada
- [x] **Sin PR de documentación de cierre** (D11 de la 3.3)
- [x] Preguntar al usuario **antes** de cualquier commit y PR
