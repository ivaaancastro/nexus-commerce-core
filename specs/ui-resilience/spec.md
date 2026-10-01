# Spec: Fase 1 — Resiliencia UI

> **Estado**: COMPLETADA
> **Fecha**: 2026-09-29

---

## 1. Requisitos

### R1 — Skeleton base reutilizable
Debe existir un componente Skeleton genérico con animación de pulso.

**Criterio**: `Skeleton` acepta `className`, aplica `animate-pulse` y `bg-neutral-200`, y marca `aria-hidden="true"`.

### R2 — Skeleton del grid de catálogo
La home debe mostrar skeletons mientras cargan los productos.

**Criterio**: Se renderizan 6 tarjetas skeleton con la misma estructura visual que `ProductCard`.

### R3 — Skeleton de la ficha de producto
La PDP debe mostrar un skeleton con su layout de doble columna mientras carga.

**Criterio**: `ProductDetailSkeleton` replica la estructura de la PDP (7/5 columnas) para evitar layout shift.

### R4 — Error Boundary
Los errores de renderizado no deben mostrar pantallas en blanco.

**Criterio**: `ErrorBoundary` captura errores y muestra un fallback editorial con botón "Reintentar".

### R5 — Fallback personalizable
El ErrorBoundary debe aceptar un fallback propio.

**Criterio**: Prop `fallback` opcional que reemplaza el fallback por defecto.

### R6 — Integración en páginas
Home y PDP deben usar los skeletons.

**Criterio**: Mientras `loading` es true, se muestran skeletons en lugar de texto de carga.

### R7 — Accesibilidad
Los skeletons no deben anunciarse a lectores de pantalla.

**Criterio**: Cada elemento skeleton tiene `aria-hidden="true"`.

---

## 2. API

Sin cambios de API. Es una feature puramente de UI.

---

## 3. Modelo de Datos

Sin cambios en modelo de datos.

### Componentes

| Archivo | Responsabilidad |
|:---|:---|
| `components/Skeleton.tsx` | Bloque base con pulso |
| `components/ProductCardSkeleton.tsx` | Skeleton de tarjeta de catálogo |
| `components/ProductDetailSkeleton.tsx` | Skeleton de PDP |
| `components/ErrorBoundary.tsx` | Captura de errores de render |
| `lib/utils.ts` | Helper `cn()` (clsx + tailwind-merge) |

---

## 4. Criterios de Aceptación

- [x] No hay parpadeos en blanco durante la carga
- [x] CLS (Cumulative Layout Shift) mínimo
- [x] Los skeletons respetan la estética Zara
- [x] Un error de render no muestra pantalla en blanco
- [x] El botón "Reintentar" funciona
- [x] Los skeletons son invisibles para lectores de pantalla

---

## 5. Casos de Error

| Caso | Comportamiento esperado |
|:---|:---|
| Fetch falla en home | Se muestra mensaje de conexión + reintento |
| Fetch falla en PDP | Se muestra error editorial |
| Error en render | ErrorBoundary muestra fallback |
| Placeholder sin imagen | Skeleton mantiene la altura del bloque |

---

*Spec completada el 2026-09-29.*
