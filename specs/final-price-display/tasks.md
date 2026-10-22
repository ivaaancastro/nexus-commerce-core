# Tasks — Precio final con impuestos incluidos (`final-price-display`)

> Rama `feat/final-price-display` · **spec aprobada 2026-10-22** · XS-S.
> **Backend intocado**, `/receipt` y admin intactos · R8.3 declaradas (medidas, ver RT4).

## Implementación

- [x] **T1** — Rama `feat/final-price-display` desde `main` (71b1ae3)
- [x] **T2** — Helper de nota (**«Impuestos incluidos (X %)»** uniforme, D2/R4) en `src/lib/taxes.ts` (RT2) — `taxesIncludedAmount` (D3) · `formatTaxRate` · `taxesIncludedLabel` · `taxRateFromAmounts` (R3)
- [x] **T3** — `CartContext`: `taxEstimate` → **`taxIncluded`** con fórmula `subtotal × rate/(100+rate)` + **`taxRate`** expuesto (RT1, D3)
- [x] **T4** — `/cart`: `Total = Subtotal`, línea informativa con nota, fuera la nota del checkout (R2)
- [x] **T5** — `CartDrawer`: mismo trío (R2)
- [x] **T6** — PDP: nota en vez de línea «Impuestos (…) (Base: …)» (R1)
- [x] **T7** — `/orders/[orderNumber]`: «Total pagado» + nota, sin Subtotal/Impuestos, enlace al recibo (R3)
- [x] **T8** — Verificado por diff: `backend/`, `receipt/` y panel admin **intactos**

## Tests (R8.3 declaradas)

- [x] **T9** — Implementado, con una **corrección del alcance medida al hacerlo** (regla 3, anotada en RT4): las aserciones que **cambiaron** fueron sólo `CartContext.test` (fórmula), `ProductDetailPage.test` (regex `(21%)` → `(21 %)`) y `TaxCopy.test` (copy en módulo único, guardia reforzada). `CartPage.test`, `CartDrawer.test` y `OrderDetailPage.test` **no tenían aserciones sobre el trío**: se les **añadieron** pruebas nuevas (ninguna existente se tocó) + `Taxes.test.ts` nuevo para el helper.

## Gates

- [x] **T10** — **461/461** frontend, cobertura **85,91 / 81,94 / 83,45 / 87,98** sin bajar de 77/76/74/79 · backend **`./mvnw test` → 345/345** (⚠️ releve: sin el PostgreSQL del proyecto levantado el contexto de test **no carga** y da 125 errores — no es un fallo del código) · `tsc` 0 · ESLint 0/0 · build 0

## Verificación

- [x] **T11** — Verificación programática (Playwright one-off, **borrado** tras ejecutar): PDP sin desglose y con la nota · carrito/drawer `Total == Subtotal` y nota con la parte real · pedido sin desglose y con enlace al recibo · **`/receipt` con desglose (comprobación negativa)** · mercado **UK** con «Impuestos incluidos (20 %)» · capturas en `test-results/`
- [x] **T12** — `npx playwright test e2e/a11y.spec.ts --project=chromium` → **14/14**

## Cierre

- [ ] **T13** — `/spec-check final-price-display` → aprobado
- [x] **T14** — CHANGELOG (Fixed + Changed) + bloques ESTADO ACTUAL
- [ ] **T15** — ⛔ Pedir permiso para commit + push + PR
