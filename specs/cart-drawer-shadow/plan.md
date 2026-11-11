# Plan — Sombra del `CartDrawer` cerrado (`cart-drawer-shadow`)

> **Fallo visual preexistente** detectado en la Fase 10 al generar capturas con
> Playwright · documento de diseño (D1–D4) · **✅ aprobada 2026-11-11**.
> El alcance vinculante está en `spec.md`; la checklist en `tasks.md`.

---

## 1. Objetivo

El panel del carrito (`frontend/src/components/CartDrawer.tsx`, el
`<div role="dialog" aria-label="Carrito de compra">`) vive **siempre en el DOM**
y, cerrado, se aparca fuera de pantalla con `translate-x-full`. Pero lleva
`shadow-2xl` **en los dos estados**: la sombra se proyecta hacia la izquierda
desde el borde del panel aparcado y **asoma como una franja gris en el borde
derecho de todas las páginas** (incluida la landing `/proyecto`).

**Resultado esperado**: con el carrito cerrado no se ve ninguna franja; el
drawer abierto se ve **exactamente igual que hoy**.

## 2. Estado real — auditoría

| Señal | Hallazgo |
|:---|:---|
| `CartDrawer.tsx:56` | `shadow-2xl` fijo en la lista de clases del panel |
| `CartDrawer.tsx:59` | `${isOpen ? "translate-x-0" : "translate-x-full"}` — el único conmutador de estado |
| Overlay (`:47`) | `opacity-0 pointer-events-none` cerrado — no contribuye a la franja |
| `CartDrawer.test.tsx:42` | Ya comprueba `translate-x-full` por defecto — no prueba la sombra |
| Script de capturas de la Fase 10 | Anula la sombra con CSS sólo para las capturas; vive en la rama de la Fase 10, **no en `main`** — su línea se retira allí cuando este fix esté mergeado |

## 3. Decisiones de diseño

### D1 — La sombra va con el estado abierto
`shadow-2xl` sale de las clases fijas y entra en la rama `isOpen` del
conmutador: `isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"`. Es la
causa raíz: un panel fuera de pantalla no tiene nada que sombrear.

### D2 — La transición cubre también la sombra
Con sólo `transition-transform`, al cerrar la sombra desaparecería **de golpe**
en el primer frame mientras el panel aún desliza (300 ms visibles sin sombra).
Se cambia a **`transition-[transform,box-shadow]`** con la misma duración y
curva: la sombra se desvanece al cerrar y aparece al abrir. El estado final
abierto es idéntico al actual.

### D3 — Un test de regresión, sin tocar los existentes
Se añade un caso a `CartDrawer.test.tsx`: cerrado **sin** `shadow-2xl`; tras
abrirlo (vía `useCartDrawer().openDrawer`) **con** `shadow-2xl` y
`translate-x-0`. Aserto por clase porque la clase *es* el contrato visual aquí
(jsdom no pinta sombras). R8: ningún test existente cambia.

### D4 — Sin ADR, sin backend, sin E2E nuevos
Fix de presentación en un único componente. Verificación en navegador
(desktop + móvil) midiendo el píxel del borde derecho y el `box-shadow`
computado.

## 4. Estimación
XS — 1 línea de código, 1 test, verificación en navegador.
