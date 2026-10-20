# Spec — Fix del selector de método de pago (`/cart`)

> **Feature `checkout-payment-grid`** · fix cosmético + foco de teclado en el
> bloque de pago del carrito · **⏳ pendiente de aprobación**.
> Basado en `plan.md` (decisiones D1–D4). Sin backend, sin ADR.

---

## 1. Contexto

Durante la prueba manual de la Fase 7 (2026-10-20) se reportó que el bloque
**«Método de pago»** del carrito (`/cart`) se ve desalineado: la cuarta opción
«TRANSFERENCIA BANCARIA» envuelve a dos líneas y las celdas quedan con el
texto pegado arriba-izquierda y sin uniformidad. Auditoría: el `<label>` no
centra el texto (no hay `flex`) y, además, el input `sr-only` no tiene
indicador de foco de teclado.

## 2. Requisitos funcionales

- **R1 — Celdas uniformes y centradas**: cada una de las 4 opciones del
  selector se pinta **centrada horizontal y verticalmente**, con **misma
  altura** y borde limpio, tanto si su texto cabe en una línea («TARJETA»,
  «BIZUM», «PAYPAL») como si envuelve a dos («TRANSFERENCIA BANCARIA»).
  Válido en el ancho de columna del carrito **y en móvil**.
- **R2 — Foco de teclado visible**: al navegar con `Tab`, la opción enfocada
  muestra un **anillo `neutral-900`** (`peer-focus-visible`), que no aparece
  al hacer clic con ratón. El estilo del estado **seleccionado** es idéntico
  al actual (`border-neutral-900 text-neutral-900`).
- **R3 — Semántica intacta**: sigue siendo un grupo de radios
  (`name="paymentMethod"`, input `sr-only` dentro de `<label>`) con el nombre
  accesible = texto del label. Cero cambios en el árbol de accesibilidad.

## 3. Requisitos técnicos

- **RT1** — Único fichero tocado: `frontend/src/app/cart/page.tsx` (bloque del
  `<fieldset>` de pago, líneas ~266-287). El grid gana **`auto-rows-fr`** (las
  dos filas implícitas comparten altura: sin esto, `h-full` sólo igualaba
  *dentro* de cada fila y el resultado eran celdas de 34 px arriba y 50 px
  abajo — medido en la verificación de la implementación). El `<label>` añade
  `flex h-full items-center justify-center text-center` y el anillo con
  **`has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-neutral-900
  has-[:focus-visible]:ring-offset-2`**; el `<input>` **sigue siendo
  `sr-only` sin `peer`** — `peer-*` emite el selector `~` (hermano) y no puede
  estilar al label que lo **contiene** (medido: `boxShadow: none` con la
  primera aproximación; el enfoque correcto es `has-` sobre el padre).
- **RT2** — **Cero** cambios en: backend, `types/commerce.ts`
  (`PAYMENT_METHODS`/`PAYMENT_METHOD_LABELS`), resto de componentes, y
  **cualquier test existente** (R8 intacto, sin declaraciones R8.3).
- **RT3** — Sin test unitario nuevo (D3 del plan: un aserto sobre clases
  testearía implementación, no comportamiento; la semántica la cubre
  `CartPage.test.tsx` y la ruta la cubren `a11y.spec.ts`/`responsive.spec.ts`).

## 4. Alcance y no-alcance

| En alcance | Fuera de alcance |
|:---|:---|
| Selector de pago de `/cart` (las 4 opciones) | Backend, DTOs, checkout flow |
| Centrado + altura uniforme (R1) | Rediseño del bloque (columnas, posición, texto) |
| Anillo de foco `peer-focus-visible` (R2) | Otros radios/formularios del proyecto |
| | Tests nuevos o modificados |

## 5. Criterios de aceptación / gates

1. `cd frontend && npm run test:coverage` → **EXIT 0**, 448 tests, cobertura
   sin bajar de los umbrales congelados (77/76/74/79 + `api.ts` ≥ 99).
2. `tsc --noEmit` → 0 errores · ESLint → 0 errores, 0 warnings · `npm run build` → 0.
3. Verificación visual documentada en la PR: capturas de `/cart` con la opción
   «TRANSFERENCIA BANCARIA» seleccionada y sin seleccionar, en **desktop y
   móvil** — celdas uniformes y texto centrado.
4. Foco de teclado visible comprobado con `Tab` (captura del anillo).
5. Con stack levantado: `/cart` **sin hallazgos `critical`/`serious`** en axe
   (`a11y.spec.ts`).
6. `/spec-check checkout-payment-grid` → aprobado.

## 6. Datos y API

- **Sin cambios de datos ni de API**: el `paymentMethod` del checkout ya se
  guarda y muestra correctamente desde la 5.5 (order detail y admin).

## 7. Documentación

- `CHANGELOG.md` (sección Fixed) y bloque «ESTADO ACTUAL» de
  `AGENTS.md`/`MEMORY.md` **dentro de la feature PR** (convención D11).
- Sin ADR · sin PR de documentación de cierre.
