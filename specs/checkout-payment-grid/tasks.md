# Tasks — Fix del selector de método de pago (`checkout-payment-grid`)

> Rama `fix/payment-method-grid` · spec aprobada 2026-10-20 · XS.
> Sin backend, sin ADR, sin tests nuevos (D3), R8 intacto.

## Implementación

- [x] **T1** — Rama `fix/payment-method-grid` desde `main` (18ddb78)
- [x] **T2** — `cart/page.tsx`: grid con `auto-rows-fr` (iguala filas), `<label>` con `flex h-full items-center justify-center text-center` + anillo `has-[:focus-visible]:ring-1 ring-neutral-900 ring-offset-2` (R1/R2, RT1). **Nota**: `peer-focus-visible` no funciona con el input anidado en el label (selector `~`) — spec actualizada con la regla 3
- [x] **T3** — Verificado RT2: diff de la feature = 1 fichero de código (`cart/page.tsx`, 6+/6−); ningún test ni tipo tocado

## Gates

- [x] **T4** — `npx vitest run` → EXIT 0, **448/448** (51 ficheros) · `test:coverage` → EXIT 0, cobertura 85.84/81.78/83.33/87.91 (sin bajar de umbrales)
- [x] **T5** — `tsc --noEmit` 0 · ESLint 0/0 · `npm run build` 0 (reconstruido con `rm -rf .next` y `next start` detenido por puerto)

## Verificación

- [x] **T6** — Verificación visual **programática** (Playwright one-off, ya eliminado): alturas 50/50/50/50 y `flex center/center` en las 4 celdas, desktop 1280×800 y móvil 390×844 · capturas en `/tmp/fix-a-{1,2,3,4}-*.png`
- [x] **T7** — Foco de teclado: tras `Tab`+`Shift+Tab` el label del radio enfocado tiene anillo (`boxShadow` con anillo `neutral-900` medido; tras clic de ratón `:focus-visible` = false, sin anillo)
- [x] **T8** — `npx playwright test e2e/a11y.spec.ts --project=chromium` → **14/14 passed** (`/cart` sin violaciones bloqueantes)

## Cierre

- [x] **T9** — `/spec-check checkout-payment-grid` → **APROBADO** (R1/R2/R3 verificadas arriba; RT1–RT3 por diff; gates completos)
- [ ] **T10** — CHANGELOG (Fixed) + bloques ESTADO ACTUAL (`AGENTS.md`/`MEMORY.md`) — **dentro de la feature PR**
- [ ] **T11** — ⛔ Pedir permiso para commit + push + PR antes de ejecutarlo
