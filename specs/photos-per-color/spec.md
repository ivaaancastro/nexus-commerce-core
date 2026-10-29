# Spec — V6: Fotos por color (`photos-per-color`)

> **Feature `photos-per-color`** · especificación funcional y técnica.

---

## 1. Requisitos Funcionales

- **R1 — Galería por color**: en la PDP, al cambiar el color activo, la galería muestra las fotos de ese color si existen; si no, las fotos genéricas del producto. Nunca queda vacía ni muestra 404.
- **R2 — Fallback silencioso**: un color sin fotos propias usa el set genérico; no hay aviso ni hueco.
- **R3 — Demo multicolor**: al menos un producto del catálogo tiene 2+ colores (selector visible) y fotos por color, para que el comportamiento sea observable.
- **R4 — Tarjetas intactas**: `ProductCard` y buscador siguen usando las fotos genéricas (no reciben color).

## 2. Requisitos Técnicos

### 2.1 Manifiesto (`src/data/product-images.json`)

Estructura plana preservada para las fotos genéricas:

```json
{ "0432/021": ["0432-021-1.webp", "0432-021-2.webp", "0432-021-3.webp"] }
```

Y entradas por color con clave compuesta:

```json
{ "0432/021::MARINO": ["0432-021-MARINO-1.webp", "0432-021-MARINO-2.webp"] }
```

### 2.2 Helper (`src/lib/product-images.ts`)

```ts
export function getProductImages(referenceCode: string, color?: string): string[]
```

- Si `color` se pasa, busca la clave `{reference}::{colorUpper}`; si existe y no está vacía, devuelve esas rutas.
- En caso contrario, devuelve `manifest[reference]` (genéricas) o `[]`.
- `color` se normaliza (trim + toUpperCase) antes de buscar.

### 2.3 Componente (`ProductGallery`)

- Nueva prop opcional `color?: string`.
- `const images = getProductImages(referenceCode, color);` (resto igual: placeholder si vacío).

### 2.4 PDP

- La página pasa el color activo del selector a `<ProductGallery color={colorActivo} />`.
- El `colorActivo` ya existe (Tarea `color-and-care`, D1).

### 2.5 Generador (`npm run images`)

- Al escanear `public/products/`, un fichero `{ref}-{COLOR}-{n}.webp` donde `{COLOR}` es uno de los colores del producto (o cualquier token en mayúsculas que no sea numérico) se agrupa bajo la clave compuesta; el resto bajo la clave base.
- Regenera el manifiesto con ambas entradas. Idempotente («ausencia = generar, presencia = sagrado»).

### 2.6 Migración demo (`V22__multicolor_demo.sql`)

- Añade SKUs de 2 colores adicionales al producto demo (referencia a elegir en implementación, idealmente uno ya con fotos) para que el selector de color tenga ≥ 2 opciones y la galería por color sea observable.
- `ON CONFLICT DO NOTHING` para re-ejecución.

### 2.7 Seguridad / fronteras

- `ProductCard` y buscador **no** pasan color → siguen con las fotos genéricas.
- Sin cambios en backend salvo la migración de SKUs.
- Sin ADR, sin PR de docs de cierre.

## 3. Criterios de aceptación

- [ ] `getProductImages(ref, color)` devuelve las fotos del color si existen, si no las genéricas.
- [ ] Cambiar de color en la PDP cambia la galería (medido en navegador).
- [ ] Un color sin fotos propias muestra las genéricas (sin 404).
- [ ] `ProductCard`/buscador siguen con las genéricas.
- [ ] Producto demo con ≥ 2 colores y fotos por color.
- [ ] `tsc` 0, `lint` 0, `build` 0, tests verdes.
- [ ] `npm run images` regenera el manifiesto con entradas por color.