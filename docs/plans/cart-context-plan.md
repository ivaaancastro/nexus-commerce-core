# Plan de Implementación: Tarea 2.1 — Estado Global de la Bolsa (CartContext)

> **Estado**: Planificación  
> **Fecha**: 2026-09-30  
> **Rama objetivo**: `feat/cart-context`

---

## 1. Objetivos

Implementar un carrito de compra persistente que:
- Guarde prendas con tallas y cantidades específicas
- Persista en `localStorage` (sin necesidad de cuentas de usuario)
- Reemplace el botón "Comprar Ahora" por "Añadir a la bolsa" (modelo Zara)
- Muestre confirmación visual temporal al añadir items
- Sea accesible desde todas las páginas vía icono en el header

---

## 2. No-Objetivos (fuera de alcance)

- Cuentas de usuario y autenticación
- Sincronización con backend (el carrito es 100% cliente)
- Procesamiento de pago (lo cubre la Tarea 2.3)
- Persistencia en base de datos

---

## 3. Decisiones de Diseño

### 3.1. Arquitectura del Estado

```
CartContext (React Context + useReducer)
├── Estado: CartItem[]
├── Acciones: addItem, removeItem, updateQuantity, clearCart
├── Persistencia: localStorage (hook useLocalStorage)
└── Derivados: subtotal, totalItems, taxEstimate
```

### 3.2. Tipos de Datos

```typescript
interface CartItem {
    productId: number;
    referenceCode: string;
    name: string;
    family: string;
    skuId: number;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;      // Snapshot del precio al añadir
    currency: string;
    imageUrl?: string;      // Placeholder si no hay imagen
}

interface CartState {
    items: CartItem[];
}

type CartAction =
    | { type: "ADD_ITEM"; payload: CartItem }
    | { type: "REMOVE_ITEM"; payload: { skuId: number; size: string } }
    | { type: "UPDATE_QUANTITY"; payload: { skuId: number; size: string; quantity: number } }
    | { type: "CLEAR_CART" }
    | { type: "HYDRATE"; payload: CartItem[] };
```

### 3.3. Persistencia

- **Hook**: `useLocalStorage<CartItem[]>("nexus-cart", [])`
- **Estrategia**: Escritura en cada mutación, lectura al montar
- **Clave**: `nexus-cart` (versión v1, migración futura si cambia el schema)

### 3.4. Integración con PDP

- Reemplazar botón "Comprar Ahora" por "Añadir a la bolsa"
- El botón de añadir usa el precio ya cargado (no hace nueva petición)
- Toast de confirmación: *"Añadido a la bolsa — {name} (Talla {size})"*

---

## 4. Archivos a Crear/Modificar

### 4.1. Nuevos archivos

| Archivo | Propósito |
|:---|:---|
| `frontend/src/context/CartContext.tsx` | Provider del carrito con useReducer |
| `frontend/src/hooks/useLocalStorage.ts` | Hook de persistencia genérico |
| `frontend/src/components/CartIcon.tsx` | Icono de carrito con badge de items |
| `frontend/src/components/AddToCartButton.tsx` | Botón de añadir a la bolsa |
| `frontend/src/components/Toast.tsx` | Notificación temporal |
| `frontend/src/__tests__/CartContext.test.tsx` | Tests del contexto |

### 4.2. Archivos a modificar

| Archivo | Cambio |
|:---|:---|
| `frontend/src/types/commerce.ts` | Añadir `CartItem`, `CartState`, `CartAction` |
| `frontend/src/components/Header.tsx` | Añadir `CartIcon` |
| `frontend/src/app/products/[reference]/page.tsx` | Reemplazar botón comprar por `AddToCartButton` |
| `frontend/src/app/layout.tsx` | Envolver con `CartProvider` |

---

## 5. Orden de Implementación

### Paso 1: Tipos y utilidades base
1. Añadir tipos `CartItem`, `CartState`, `CartAction` a `commerce.ts`
2. Crear hook `useLocalStorage`

### Paso 2: Contexto del carrito
1. Crear `CartContext` con `useReducer`
2. Implementar acciones: `ADD_ITEM`, `REMOVE_ITEM`, `UPDATE_QUANTITY`, `CLEAR_CART`, `HYDRATE`
3. Calcular derivados: `subtotal`, `totalItems`, `taxEstimate`

### Paso 3: Componentes de UI
1. Crear `CartIcon` con badge
2. Crear `AddToCartButton`
3. Crear `Toast` para confirmación visual

### Paso 4: Integración
1. Envolver `layout.tsx` con `CartProvider`
2. Añadir `CartIcon` al `Header`
3. Reemplazar botón "Comprar Ahora" en PDP por `AddToCartButton`

### Paso 5: Tests
1. Tests de `CartContext` (acciones, persistencia, derivados)
2. Tests de `AddToCartButton` (click, toast, actualización de carrito)
3. Tests de `CartIcon` (badge con número de items)

---

## 6. Criterios de Aceptación

- [ ] El carrito persiste al recargar la página
- [ ] Se pueden añadir múltiples prendas con tallas diferentes
- [ ] Se puede actualizar la cantidad de cada item
- [ ] Se puede eliminar items individuales
- [ ] El icono del carrito muestra el número total de items
- [ ] Al añadir un item, aparece un toast de confirmación que desaparece solo
- [ ] El botón "Comprar Ahora" ya no existe en la PDP
- [ ] El carrito es accesible desde todas las páginas
- [ ] Tests pasando con cobertura >80%

---

## 7. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|:---|:---|
| Precios desactualizados en el carrito | Mostrar nota "Precio sujeto a cambios en checkout" |
| localStorage llenado | Límite de 50 items, mensaje de error si se excede |
| Race conditions en mutaciones | `useReducer` garantiza actualizaciones atómicas |

---

## 8. Dependencias

- **Tarea 2.2** (Cart Drawer): Consumirá el contexto creado aquí
- **Tarea 2.3** (Checkout Multilínea): Usará los items del carrito para el payload

---

## 9. Estimación

- **Desarrollo**: 2-3 horas
- **Tests**: 1 hora
- **Total**: 3-4 horas

---

*Documento creado en modo plan. Pendiente de aprobación para pasar a modo ejecución.*
