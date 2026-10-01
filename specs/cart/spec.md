# Spec: Fase 2 — Carrito de Compra

> **Estado**: COMPLETADA
> **Fecha**: 2026-09-30
> **Rama**: `feat/cart-context`, `feat/cart-drawer`

---

## 1. Requisitos

### R1 — Estado global del carrito
El carrito debe ser accesible desde cualquier página mediante un Context de React.

**Criterio**: `CartContext` expone `items`, `addItem`, `removeItem`, `updateQuantity`, `clearCart`, `totalItems`, `subtotal`, `taxEstimate`.

### R2 — Persistencia entre sesiones
El carrito debe sobrevivir a la recarga del navegador y al cierre de la pestaña.

**Criterio**: Los items se guardan en `localStorage` bajo la clave `nexus-cart`.

### R3 — Líneas independientes por talla
La misma prenda en tallas distintas debe ser una línea diferente.

**Criterio**: La clave de identidad de una línea es `(skuId, size)`. Añadir la misma talla incrementa la cantidad en vez de duplicar la línea.

### R4 — Cálculo de totales
El carrito debe calcular subtotal e impuestos estimados.

**Criterio**: `subtotal = Σ(unitPrice × quantity)`, `taxEstimate = subtotal × 0.21`.

### R5 — Badge en el header
El icono del carrito debe mostrar el número total de items.

**Criterio**: `CartIcon` muestra un badge con `totalItems` cuando es mayor que 0.

### R6 — Botón "Añadir a la bolsa"
La PDP debe permitir añadir items en lugar de comprar directamente.

**Criterio**: El botón "Comprar Ahora" se reemplaza por "Añadir a la bolsa". El modelo es Zara: no hay compra directa.

### R7 — Confirmación visual temporal
Al añadir un item debe aparecer una confirmación que desaparece sola.

**Criterio**: Toast visible 2.5 segundos, sin interacción del usuario.

### R8 — Drawer lateral
Al hacer clic en el icono del carrito se abre un panel lateral derecho.

**Criterio**: Panel con overlay oscuro, animación slide-in/out, ancho `sm:w-96`.

### R9 — Cierre del drawer
El drawer debe cerrarse de tres formas.

**Criterio**: Clic en el overlay, tecla `Escape`, o botón de cerrar (X).

### R10 — Controles de cantidad en el drawer
Cada línea debe permitir modificar su cantidad.

**Criterio**: Botones `+` y `−`. Con cantidad 1, el botón `−` elimina la línea.

### R11 — Página completa del carrito
Desde el drawer se accede a una página de carrito completa.

**Criterio**: Botón "Ver carrito completo" navega a `/cart`.

### R12 — Checkout multilínea
El carrito debe poder tramitarse como una sola transacción.

**Criterio**: `POST /api/v1/orders/checkout` recibe el array completo de items con una única `Idempotency-Key`.

### R13 — Selección automática de almacén
El backend debe elegir el almacén óptimo para cada item.

**Criterio**: `WarehouseSelectionService` calcula la distancia Haversine entre destino y cada almacén con stock, y elige el más cercano.

---

## 2. API

### Endpoints usados

| Método | Endpoint | Uso |
|:---|:---|:---|
| `GET` | `/api/v1/inventory/skus/{id}` | Desglose de stock por almacén |
| `GET` | `/api/v1/pricing/skus/{id}?market=ES` | Precio y mercado |
| `POST` | `/api/v1/orders/checkout` | Checkout multilínea |

### Cambio en `CheckoutRequest`

```java
public record CheckoutRequest(
    String marketCode,
    List<CheckoutItemRequest> items,
    String destinationCountryCode,   // nuevo
    Double destinationLatitude,       // nuevo
    Double destinationLongitude       // nuevo
) {}
```

---

## 3. Modelo de Datos

### Cambios en backend

| Entidad | Cambio |
|:---|:---|
| `Warehouse` | Añadidos `latitude` y `longitude` (Double) |
| `Order` | Añadida relación `user_id` |

### Migraciones

| Migración | Contenido |
|:---|:---|
| `V4__warehouse_coordinates.sql` | Columnas de coordenadas + datos de ejemplo |
| `V5__warehouse_coordinates_fix.sql` | Asigna coordenadas por defecto a almacenes sin latitud |
| `V7__orders_user_id.sql` | Columna `user_id` en `orders` |
| `V8__users_measurements_fix.sql` | Cambia `height`/`weight` a `DOUBLE PRECISION` |

### Componentes frontend

| Archivo | Responsabilidad |
|:---|:---|
| `context/CartContext.tsx` | Estado global con `useReducer` |
| `context/CartDrawerContext.tsx` | Estado abierto/cerrado del drawer |
| `hooks/useLocalStorage.ts` | Persistencia en localStorage |
| `components/CartIcon.tsx` | Icono con badge |
| `components/CartItemRow.tsx` | Línea con controles de cantidad |
| `components/CartDrawer.tsx` | Panel lateral |
| `components/AddToCartButton.tsx` | Botón + toast |
| `app/cart/page.tsx` | Página completa |

---

## 4. Criterios de Aceptación

- [x] El carrito persiste al recargar la página
- [x] Se pueden añadir múltiples prendas con tallas diferentes
- [x] Se puede actualizar la cantidad de cada línea
- [x] Se puede eliminar líneas individuales
- [x] El icono del carrito muestra el número total de items
- [x] Al añadir un item aparece un toast que desaparece solo
- [x] El drawer se cierra con clic fuera, Escape o botón X
- [x] El botón "Comprar Ahora" ya no existe en la PDP
- [x] El checkout se procesa como una sola transacción
- [x] El almacén se selecciona por distancia

---

## 5. Casos de Error

| Caso | Comportamiento esperado |
|:---|:---|
| Item sin stock | Botón deshabilitado, se muestra "Agotado" |
| Checkout falla | Se muestra error, permite reintentar |
| localStorage corrupto | Se ignora y se empieza vacío |
| Token de idempotencia repetido | El backend devuelve la orden existente |

---

*Spec completada el 2026-09-30.*
