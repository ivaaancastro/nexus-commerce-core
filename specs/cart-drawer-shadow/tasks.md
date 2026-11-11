# Tasks — Sombra del `CartDrawer` cerrado (`cart-drawer-shadow`)

> Rama `fix/cart-drawer-shadow` · spec aprobada 2026-11-11 · XS.
> Sin backend, sin ADR, R8 intacto (ningún test existente cambia su aserción).

## Implementación

- [x] **T1** — Rama `fix/cart-drawer-shadow` desde `main`
- [x] **T2** — `CartDrawer.tsx`: `shadow-2xl` a la rama `isOpen` y `transition-transform` → `transition-[transform,box-shadow]` (RT1, D1/D2) — 3+/3−
- [x] **T3** — Test de regresión en `CartDrawer.test.tsx` (RT2): cerrado sin `shadow-2xl`; tras abrir con `openDrawer`, `translate-x-0` + `shadow-2xl`. **Comprobación negativa**: con el `CartDrawer.tsx` de `main` el test **falla** (1 failed | 4 passed); con el fix pasa

## Gates

- [x] **T4** — `npx vitest run` → **591/591** (62 ficheros) EXIT 0
- [x] **T5** — `npx tsc --noEmit` 0 · `npx eslint` 0 · `npm run build` 0 (en un worktree recién creado `tsc` da `LayoutProps` no encontrado **hasta el primer build**: los tipos los genera Next en `.next/types`)

## Verificación en navegador (Playwright one-off sobre `next start -p 3002`, sin backend)

- [x] **T6** — R1, cerrado, `/proyecto` (y `/`): `boxShadow = none`; luminancia mínima en los 30 px del borde derecho a media altura **235 → 255** (antes = sombra forzada con CSS; después = fondo blanco) en **desktop 1280×800 y móvil 390×844**; `scrollWidth` = viewport (sin desborde)
- [x] **T7** — R2, abierto: `boxShadow` = el de `shadow-2xl` (`0 25px 50px -12px rgb(0 0 0 / .25)`), panel en `x=896 w=384` (desktop) y `x=0 w=390` (móvil); captura visual igual que antes. Tras Escape vuelve a `none`

## Cierre

- [x] **T8** — Spec-check (código vs `spec.md`) → **APROBADO**: R1 (T6) y R2 (T7) medidas en navegador · R3: diff sin cambios en `role`/`aria-*`/handlers · RT1: único fichero de código `CartDrawer.tsx` (3+/3−, exactamente las dos clases de la spec) · RT2: test nuevo, ningún aserto existente tocado · RT3: gates en verde
- [x] **T9** — CHANGELOG (`[Unreleased]` → Fixed) + línea de decisiones en el bloque ESTADO de `AGENTS.md`, formulada para ser verdad tras el merge
- [x] **T10** — Commit en `fix/cart-drawer-shadow` autorizado por el usuario (vía la sesión de la Fase 10). **Sin push ni PR** (no pedidos)
- [ ] **T11** — ⏳ pendiente, vive en la rama de la Fase 10: retirar la anulación de sombra de `scripts/capture-screenshots.mjs` tras el merge
