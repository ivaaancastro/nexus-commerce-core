# Plan — Fix del selector de método de pago (`/cart`)

> **Post-Fase 7 · feedback de prueba manual** · documento de diseño (D1–D4) · **⏳ pendiente de aprobación**.
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md` (se escribe tras la aprobación).

---

## 1. Objetivo

En la prueba guiada de la Fase 7 (2026-10-20) el usuario detectó un **fallo de
estilo en el bloque «Método de pago»** del carrito: las 4 opciones van en un
`grid grid-cols-2` cuyas etiquetas no centran el texto ni igualan la lectura
visual — «TRANSFERENCIA BANCARIA» envuelve a dos líneas y el bloque queda
desalineado (texto pegado arriba-izquierda, aspecto de rejilla rota).

**Resultado esperado**: las 4 celdas se ven **uniformes y centradas** con
cualquier longitud de texto, y de paso el bloque gana el **foco de teclado
visible** que hoy no tiene (el input es `sr-only` y no existe anillo de foco:
con Tab se navega a ciegas). Sólo presentación — cero cambios de negocio.

---

## 2. Estado real — auditoría previa (sobre `main` = 18ddb78)

| Señal | Hallazgo |
|:---|:---|
| `frontend/src/app/cart/page.tsx:266-287` | El `<label>` lleva `border px-3 py-2 text-xs uppercase tracking-wider` y el texto del label **inline**: sin `flex`, el texto se pega arriba-izquierda y con «TRANSFERENCIA BANCARIA» (2 líneas) la celda rompe la armonía del grid |
| Input de radio | `className="sr-only"` dentro del label — correcto para el a11y tree, pero **sin `peer`** ⇒ hoy es imposible estilar el label según foco/estado desde CSS |
| Patrón `peer-*` en el repo | **No existe** en ningún componente — esta feature lo introduce |
| Estilo del seleccionado | `border-neutral-900 text-neutral-900` (vs `border-neutral-200 text-neutral-600 hover:border-neutral-400`) — **se conserva tal cual** |
| `/cart` en gates | `a11y.spec.ts:102` (axe), `smoke.spec.ts:85,123`, `responsive.spec.ts:15` — la ruta ya está auditada |
| `CartPage.test.tsx:307-318` | Localizadores por **rol y nombre** (`getByRole("radio", { name: "Bizum" })`) — si la semántica no cambia, **el test no se toca** |
| `PAYMENT_METHODS` / `PAYMENT_METHOD_LABELS` | `types/commerce.ts` — sin cambios (el fallo es de CSS, no de datos) |
| Backend | **Intocado**: el checkout ya guarda `paymentMethod` desde la 5.5 |

---

## 3. Decisiones de diseño

### D1 — Sólo CSS de presentación; markup semántico intacto

- El `<label>` gana `flex items-center justify-center text-center h-full`:
  el texto se centra en ambos ejes de su celda.
- El **grid** gana `auto-rows-fr`: `h-full` por sí solo iguala alturas dentro
  de cada fila, pero las dos filas implícitas se dimensionan por separado
  (medido: 34 px vs 50 px) — `grid-auto-rows: 1fr` las iguala entre sí.
- **No se cambia** el árbol semántico: `<label>` + `<input type="radio"
  class="sr-only">` + `name="paymentMethod"` se quedan idénticos ⇒ el nombre
  accesible sigue siendo el texto del label y **ningún localizador** (unitario,
  E2E o axe) se mueve.
- Descartado: pasar a `buttons` con `aria-pressed` (rompería `getByRole("radio")`
  de los tests existentes y el patrón de formularios del repo, sin ganar nada).

### D2 — Foco de teclado visible (`has-[:focus-visible]`, no `peer-*`)

- El input `sr-only` actual **no tiene ningún indicador de foco**: es una
  deuda de accesibilidad del bloque (los gates del proyecto la tienen en alta).
- Solución: anillo en el label con **`has-[:focus-visible]:ring-1
  ring-neutral-900 ring-offset-2`** — sólo aparece con **foco visible**
  (ratón no lo ensucia) y respeta la paleta editorial `neutral-900`.
- **Corregido durante la implementación** (spec actualizada, regla 3): la
  primera aproximación con `peer-focus-visible:*` **no puede funcionar** —
  `peer-*` genera `.peer:focus-visible ~ .label` (hermano siguiente) y aquí el
  input está **dentro** del label. Medido con Playwright: `:focus-visible`
  matchea en el input pero `boxShadow` del label queda `none`. `has-` apunta
  al ancestro correcto.
- Mismo fichero, misma corrección: aprovechamos que ya estamos tocando el bloque.

### D3 — Sin test unitario nuevo, con justificación escrita

- Es una corrección **puramente visual** (clases CSS): un aserto sobre
  `justify-center` testaría **implementación, no comportamiento** y sería
  frágil ante el siguiente refacto de estilos.
- El comportamiento y la semántica ya están cubiertos por `CartPage.test.tsx`
  (radios por rol/nombre, selección, envío), y la accesibilidad de la ruta la
  cubre `a11y.spec.ts` (axe sobre `/cart`) + `responsive.spec.ts`.
- La verificación del fix es **visual y manual**, documentada en la PR con
  capturas (desktop y móvil, opción larga seleccionada y sin seleccionar).
- Precedente: la 6.1 (header responsive) tampoco añadió unit tests de CSS.

### D4 — Sin backend, sin ADR, sin PR de documentación de cierre

- Rama **`fix/payment-method-grid`**, commits convencionales en español.
- **Sin ADR** (ninguna decisión de arquitectura/stack; criterio 7.2–7.6).
- Estado del trabajo en la **feature PR** (convención D11); `CHANGELOG.md`
  dentro de la misma PR.

---

## 4. Fuera de alcance

- ❌ **Backend, DTOs, `PAYMENT_METHODS`/`PAYMENT_METHOD_LABELS`** — el dato ya viaja bien.
- ❌ **El resto de formularios/radios del proyecto** (filtros del catálogo, etc.):
  si en B o C aparece un patrón de tarjeta-radio reutilizable, se valorará allí.
- ❌ **Cambiar el diseño del selector** (colocación, nº de columnas, etiquetas):
  sólo se arregla la alineación y el foco.
- ❌ **Tests nuevos** (D3) y **cambios en tests existentes** (R8 intacto).

---

## 5. Estimación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | CSS del label (`flex` centrado + `h-full`) y foco `peer-focus-visible` en `cart/page.tsx` | XS |
| **B** | Gates: `npm run test:coverage` EXIT 0 · `tsc` 0 · ESLint 0/0 · `npm run build` 0 | bajo |
| **C** | Verificación visual (desktop + móvil) + `/cart` en axe con stack levantado + CHANGELOG + bloque ESTADO ACTUAL en la PR | bajo |

**Baselines** (tras 7.6): frontend **448** tests · coverage 85.84/81.78/83.33/87.91
(umbrales 77/76/74/79 + `api.ts` ≥ 99) · ESLint 0/0 · `tsc` 0 · build 0.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| Romper el localizador `getByRole("radio", { name: … })` | D1: markup semántico intacto; `CartPage.test.tsx` se ejecuta sin tocarlo |
| Que el `ring` choque con el estilo del estado seleccionado | `peer-focus-visible` sólo actúa con foco de teclado; el estilo `checked` (borde/texto `neutral-900`) no se modifica |
| Regresión visual en móvil | `responsive.spec.ts` ya cubre `/cart` + verificación manual en ambos anchos (bloque C) |
