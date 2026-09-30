# Memory — Roadmap Nexus Commerce Core

> **Archivo de memoria del agente.** Contiene las tareas planificadas y el contexto de trabajo.
> Se actualiza al completar tareas o cuando el usuario añade nuevas.

---

## Fase Actual: FASE 1 — Resiliencia UI (En curso)

### Tarea 1.2 — Skeletons de Carga y Límites de Error (Error Boundaries)
- **Estado**: COMPLETADA
- **Por qué**: Evitar parpadeos en blanco (layout shifts) mientras se consultan los precios en tiempo real o se vectoriza una búsqueda.
- **Acciones**: Implementar componentes Skeleton con animación de pulso sutil en el grid del catálogo y en la ficha técnica de la PDP.
- **Implementación**: 
  - `Skeleton.tsx` — Componente base con `animate-pulse` y `aria-hidden`
  - `ProductCardSkeleton.tsx` — Skeleton del grid del catálogo
  - `ProductDetailSkeleton.tsx` — Skeleton de la PDP con layout de doble columna
  - `ErrorBoundary.tsx` — Error boundary con fallback editorial y botón de reintento
  - Integración en `page.tsx` (home) y `products/[reference]/page.tsx` (PDP)
  - Tests: 13 tests pasando (Vitest + React Testing Library)

---

## Fase 2: Carrito de Compra (Bolsa) y Checkout Multilínea (P1 — Alta)

**Objetivo**: Pasar de la compra unitaria directa ("Comprar ya") a la gestión completa de una cesta de la compra con múltiples prendas.

### Tarea 2.1 — Estado Global de la Bolsa (CartContext / Store ligero)
- **Estado**: COMPLETADA
- **Por qué**: Permitir al cliente añadir varias prendas o tallas distintas, gestionar cantidades y persistir la bolsa en localStorage para que no se pierda al navegar.
- **Implementación**:
  - `CartContext.tsx` — Estado global con React Context + useReducer
  - `useLocalStorage.ts` — Hook de persistencia en localStorage
  - `CartIcon.tsx` — Icono de carrito con badge en el header
  - `AddToCartButton.tsx` — Botón "Añadir a la bolsa" con confirmación visual
  - `Toast.tsx` — Notificación temporal
  - Integración en `layout.tsx`, `Header.tsx` y PDP
  - Reemplaza botón "Comprar Ahora" por "Añadir a la bolsa" (modelo Zara)
  - Tests: 24 tests pasando (Vitest + React Testing Library)

### Tarea 2.2 — Cajón Lateral de la Bolsa (Slide-Over Cart Drawer)
- **Estado**: COMPLETADA
- **Por qué**: Estándar absoluto en moda de alta gama. Al hacer clic en "Añadir a la bolsa", se despliega un panel lateral derecho suave sin abandonar la página actual, mostrando el subtotal acumulado y el cálculo estimado de impuestos.
- **Implementación**:
  - `CartDrawerContext.tsx` — Estado abierto/cerrado del drawer
  - `CartDrawer.tsx` — Overlay lateral con animación slide-in/slide-out
  - `CartItemRow.tsx` — Fila de item con controles de cantidad (+/-) y eliminar
  - `app/cart/page.tsx` — Página completa del carrito
  - Integración en `Header.tsx` (abre drawer) y `layout.tsx` (providers)
  - Cerrar con clic fuera, tecla Escape o botón X
  - Tests: 27 tests pasando (Vitest + React Testing Library)

### Tarea 2.3 — Adaptación del Checkout a Multilínea
- **Estado**: COMPLETADA
- **Por qué**: Conectar el botón de tramitación del carrito con el payload completo de CheckoutRequest (array de items con sus respectivos almacenes) y disparo de Idempotencia-Key único para todo el carrito.
- **Implementación**:
  - Backend: `WarehouseSelectionService` con algoritmo de selección de almacén por distancia (Haversine)
  - Backend: Coordenadas geográficas en `Warehouse` (latitude, longitude)
  - Backend: `CheckoutRequest` extendido con coordenadas de destino
  - Frontend: Checkout multilínea desde `/cart` con Idempotencia-Key única
  - Frontend: Página de confirmación `/orders/[orderNumber]` estilo Zara
  - Tests: 27 tests pasando (Vitest + React Testing Library)

---

## Fase 3: Experiencia Editorial, Familias y Multimercado (P2 — Media)

**Objetivo**: Reforzar la identidad visual de marca y permitir la navegación jerárquica real de un gran catálogo.

### Tarea 3.1 — Navegación por Familias y Filtros (/category/[family])
- **Estado**: PENDIENTE
- **Por qué**: Poder filtrar por OUTERWEAR, SHIRTS, TROUSERS, etc., actualizando la URL de forma limpia y permitiendo combinar filtros por categoría con el buscador semántica.

### Tarea 3.2 — Selector Dinámico de Mercado y Divisa
- **Estado**: PENDIENTE
- **Por qué**: El backend ya soporta multidivisa y fiscalidad por país. Esta tarea añade un conmutador en la cabecera (ej: ES (EUR / 21% IVA) vs US (USD / 0% TAX)) que recalcula instantáneamente los precios y el stock de la tienda según el mercado seleccionado.

### Tarea 3.3 — Galería de Imágenes Responsive y Vista de Detalle Editorial
- **Estado**: PENDIENTE
- **Por qué**: La moda entra por los ojos. Layout de doble columna con fotografía editorial a sangre, placeholders SVG optimizados mientras carga y tipografías con proporciones áureas.

---

## Fase 4: Calidad Enterprise, Testing y Rendimiento (P3 — Pulido)

**Objetivo**: Blindar el frontend con la misma rigurosidad que aplicamos en el backend.

### Tarea 4.1 — Suite de Pruebas Unitarias de Componentes (Vitest + React Testing Library)
- **Estado**: PENDIENTE
- **Tests**: Selección de talla en PDP, cálculo de totales en la bolsa, y renderizado del score de similitud en la búsqueda vectorial.

### Tarea 4.2 — Test E2E Transaccional con Playwright
- **Estado**: PENDIENTE
- **Flujo**: Simulación completa automatizada en navegador headless: Abrir Home → Buscar semánticamente → Seleccionar talla → Añadir a bolsa → Tramitar compra → Validar creación del pedido y reducción de stock.

### Tarea 4.3 — Auditoría Core Web Vitals y Accesibilidad (a11y)
- **Estado**: PENDIENTE
- **Métricas**: LCP < 1.2s, CLS = 0, soporte completo de navegación por teclado y etiquetas ARIA para lectores de pantalla.

---

## Notas de Contexto

- **Rama actual**: `feat/ui-resilience-skeletons`
- **Prioridad actual**: FASE 1 (Resiliencia UI) → FASE 2 (Carrito) → FASE 3 (Editorial) → FASE 4 (Calidad)
- **Convenciones**: Ver `AGENTS.md` en la raíz del proyecto
