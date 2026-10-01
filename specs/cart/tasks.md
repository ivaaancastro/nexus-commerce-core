# Tasks: Fase 2 — Carrito de Compra

> **Estado**: COMPLETADA
> **Fecha**: 2026-09-30

---

## Tarea 2.1 — Estado Global del Bolsa

### Tipos y utilidades
- [x] Tipos `CartItem`, `CartState`, `CartAction` en `types/commerce.ts`
- [x] Hook `useLocalStorage` con manejo de JSON corrupto

### Estado
- [x] `CartContext` con `useReducer`
- [x] Acción `ADD_ITEM` (fusiona si mismo sku+talla)
- [x] Acción `REMOVE_ITEM`
- [x] Acción `UPDATE_QUANTITY` (elimina si cantidad ≤ 0)
- [x] Acción `CLEAR_CART`
- [x] Acción `HYDRATE` desde localStorage
- [x] Derivados: `totalItems`, `subtotal`, `taxEstimate`

### UI
- [x] `CartIcon` con badge
- [x] `AddToCartButton` con toast de confirmación
- [x] `Toast` con auto-cierre a 2.5s
- [x] `AuthProvider` en `layout.tsx`
- [x] Reemplazar "Comprar Ahora" por "Añadir a la bolsa" en PDP

### Tests
- [x] Estado inicial vacío
- [x] Añadir item
- [x] Fusionar misma talla
- [x] Líneas distintas por talla
- [x] Eliminar item
- [x] Actualizar cantidad
- [x] Limpiar carrito
- [x] Cálculo de subtotal
- [x] Cálculo de impuesto (21%)
- [x] Persistencia en localStorage

---

## Tarea 2.2 — Cajón Lateral

### Estado
- [x] `CartDrawerContext` con `isOpen`, `openDrawer`, `closeDrawer`, `toggleDrawer`

### Componentes
- [x] `CartDrawer` con overlay y panel
- [x] `CartItemRow` con controles `+` / `−` / eliminar
- [x] Muestra imagen, nombre, talla, cantidad y precio
- [x] Muestra subtotal, impuestos y total estimado
- [x] Botón "Ver carrito completo" → `/cart`

### Comportamiento
- [x] Animación slide-in/out con `transition-transform`
- [x] Cierre con clic en overlay
- [x] Cierre con tecla `Escape`
- [x] Cierre con botón X
- [x] Bloquea scroll del body mientras está abierto

### Integración
- [x] `CartIcon` abre el drawer
- [x] `CartDrawerProvider` en `layout.tsx`

### Tests
- [x] Drawer cerrado por defecto (`translate-x-full`)
- [x] Mensaje de carrito vacío
- [x] Renderizado del drawer

---

## Tarea 2.3 — Checkout Multilínea

### Backend — Selección de almacén
- [x] Coordenadas `latitude`/`longitude` en `Warehouse`
- [x] `WarehouseRepository.findWarehousesWithStockForSku`
- [x] `WarehouseSelectionService` con fórmula de Haversine
- [x] `OrderService` usa el almacén seleccionado
- [x] `CheckoutRequest` extendido con coordenadas de destino

### Migraciones
- [x] `V4__warehouse_coordinates.sql`
- [x] `V5__warehouse_coordinates_fix.sql`
- [x] `V7__orders_user_id.sql`
- [x] `V8__users_measurements_fix.sql`

### Frontend — Checkout
- [x] Botón "Tramitar pedido" en `/cart`
- [x] Genera `Idempotency-Key` con `crypto.randomUUID()`
- [x] Envía todos los items del carrito
- [x] Estado de carga durante el proceso
- [x] Limpia el carrito tras el éxito
- [x] Redirige a `/orders/[orderNumber]`

### Páginas
- [x] `/orders/[orderNumber]` — confirmación
- [x] `/receipt/[orderNumber]` — recibo con descarga PDF

### Bug fixes
- [x] Import de `InsufficientStockException` en `OrderService`
- [x] `scale` inválido en columnas `Double` de `Warehouse`
- [x] Checksum mismatch por modificar migración V4 aplicada
- [x] `handleResponse` con body vacío

### Tests
- [x] `OrderServiceTest` actualizado con nuevos campos
- [x] `WarehouseSelectionService` mockeado
- [x] 31 tests backend en verde

---

## Cierre

- [x] Tests backend en verde (31)
- [x] Tests frontend en verde (27)
- [x] Build de producción correcto
- [x] CHANGELOG actualizado
- [x] Migraciones aplicadas y validadas

---

*Tasks completadas el 2026-09-30.*
