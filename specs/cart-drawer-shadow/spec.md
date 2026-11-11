# Spec — Sombra del `CartDrawer` cerrado

> **Feature `cart-drawer-shadow`** · fix visual · **✅ aprobada 2026-11-11**.
> Basado en `plan.md` (D1–D4). Sin backend, sin ADR.

## 1. Requisitos funcionales

- **R1 — Sin franja con el carrito cerrado**: con el drawer cerrado, el borde
  derecho de cualquier página no muestra sombra ni franja gris, en desktop
  (1280×800) y en móvil (390×844).
- **R2 — Drawer abierto idéntico**: abierto, el panel conserva `shadow-2xl`,
  posición, ancho (`w-full sm:w-96`) y animación de entrada de 300 ms
  `ease-out`.
- **R3 — Semántica intacta**: mismo `role="dialog"`, `aria-modal`,
  `aria-label`, foco y cierre con Escape/overlay. Cero cambios en el árbol de
  accesibilidad.

## 2. Requisitos técnicos

- **RT1** — Único fichero de código: `frontend/src/components/CartDrawer.tsx`.
  `shadow-2xl` pasa a la rama abierta del conmutador
  (`isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"`) y
  `transition-transform` → `transition-[transform,box-shadow]` (D2).
- **RT2** — Test de regresión en `src/__tests__/CartDrawer.test.tsx`: cerrado
  ⇒ sin `shadow-2xl`; abierto ⇒ `shadow-2xl` + `translate-x-0`. Ningún test
  existente cambia su aserción (R8).
- **RT3** — Gates: `npx vitest run`, `npx tsc --noEmit`, `npx eslint`,
  `npm run build` en verde.

## 3. Criterios de aceptación

1. Navegador, carrito cerrado: `getComputedStyle(dialog).boxShadow === "none"`
   y el píxel del borde derecho del viewport es el fondo de la página, en
   desktop y en móvil.
2. Navegador, carrito abierto: `boxShadow` ≠ `none` (el de `shadow-2xl`).
3. Gates de RT3 en verde.

## 4. Fuera de alcance

- Retirar la anulación CSS del script de capturas de la Fase 10 (vive en esa
  rama; se hace allí tras el merge de este fix).
- Cualquier otro cambio en el drawer (trampa de foco, etc.).
