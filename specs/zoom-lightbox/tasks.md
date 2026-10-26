# Tasks: V2 — Zoom/lightbox en la galería de la ficha

> **Spec**: `specs/zoom-lightbox/spec.md` (R1–R10) · **Plan**: `specs/zoom-lightbox/plan.md` (D1–D9)
> **Aprobación**: ✅ 2026-10-26 — bloque SDD superado.
> Marcar `[x]` al completar cada tarea. **Regla**: nada de código fuera de aquí.

## A — Base y preparación

- [x] A1 · Rama `feat/zoom-lightbox` + `plan.md` / `spec.md` escritos y **aprobados**
- [x] A2 · Leer la guía relevante de `frontend/node_modules/next/dist/docs/` antes de código (regla AGENTS de frontend): `next/image`, componentes cliente en App Router, **deprecaciones de Next 16.3.7**

## B — Movimiento de `GALLERY_SIZES` (D3 / R8)

- [x] B1 · `src/lib/gallery-sizes.ts` con el literal **idéntico** al actual (sin recalcular)
- [x] B2 · Ficha: import de `GALLERY_SIZES` desde `lib/` (1 línea) · grep sin imports colgados
- [x] B3 · Test del literal/origen único + actualización de imports en tests si procede (sin tocar aserciones)

## C — Visor modal (D4 / R2–R6)

- [x] C1 · `src/components/ProductLightbox.tsx`: overlay `fixed inset-0 z-[60]` + `bg-neutral-950/95` + imagen vía `ProductImage` (`sizes="100vw"`, caja con aspecto reservado)
- [x] C2 · Cierres: ✕, Escape y fondo con **guarda anti-arrastre** + bloqueo/restauración de scroll del `body` (y en *cleanup*)
- [x] C3 · Navegación **circular** ‹/› (sólo si `images.length > 1`), ←/→, contador **«n / total» con `role="status"`**
- [x] C4 · A11y: `role="dialog"` + `aria-modal` + `aria-label` · foco inicial en ✕ · **trampa** Tab/Shift+Tab · `aria-label` en español en todos los controles
- [x] C5 · **Zoom ×2** con `cursor-zoom-in` y `transform-origin`-cursor bajo `@media (hover: hover) and (pointer: fine)` · `motion-reduce:transition-none` · sin zoom fuera de esa condición

## D — Integración en la galería (D1/D2 / R1)

- [x] D1 · `ProductGallery.tsx` → `"use client"` · `<button type="button">` por celda con `aria-label` «Ampliar imagen: {alt}» · **placeholder no va en botón**
- [x] D2 · Estado `abierto`/`índice` + montaje del visor + **devolución del foco** al gatillo al cerrar
- [x] D3 · Atributos de carga **intactos** (2 primeras `eager` + `fetchPriority`, `sizes`, `alt`) — verificado con los tests preexistentes

## E — Tests de componente (D8 / R7)

- [x] E1 · `ProductLightbox.test.tsx`: apertura con índice · ✕/Escape/fondo cierran · **anti-arrastre** · ‹ › con wrap y ausencia con 1 imagen · ←/→ · contador · foco inicial y **retorno** · **trampa** de Tab · scroll bloqueado/restaurado · zoom con/sin `pointer: fine`
- [x] E2 · `ProductGallery.test.tsx`: los **6 actuales intactos** + nuevos (celda-botón con nombre accesible · placeholder sin botón · abrir en el índice pulsado)
- [x] E3 · **R8.3 declarada** en los ficheros donde se toque alguna query existente (objetivo: 0 toques; diff = adiciones)

## F — Gate de accesibilidad (D7 / R9)

- [x] F1 · `e2e/a11y.spec.ts`: **+1** auditoría de la ficha **con el visor abierto** (las 14 existentes sin tocar, sin supresiones) → `npm run audit:a11y` **15/15**

## G — Gates de cierre (spec §4)

- [x] G1 · `npx tsc --noEmit` **0** · ESLint **0 errores / 0 warnings** · `npm run build` **0**
- [x] G2 · `npm run test:coverage` en verde (**470 + nuevos**) sobre los umbrales congelados
- [x] G3 · E2E rápido **25/25** (sin tocar las 5 humo)
- [x] G4 · Verificación en navegador: desktop (apertura, zoom lupa, teclado, cierre) + móvil (visor ‹›, sin zoom) · **CLS 0 al abrir** medido con `PerformanceObserver('layout-shift')` · sin errores de consola
- [x] G5 · `/spec-check zoom-lightbox` → **APROBADO**

## H — Documentación y cierre

- [x] H1 · `CHANGELOG.md` — entrada V2 en `[Unreleased]`
- [x] H2 · `AGENTS.md` — «ESTADO ACTUAL» para ser verdad tras el merge (sin PR/SHA) + bloque «Decisiones V2»
- [x] H3 · `MEMORY.md` — V2 completada en el bloque de vitrina + estado actual
- [x] H4 · `tasks.md` 100 % · **pedir permiso** para commit / push / PR
