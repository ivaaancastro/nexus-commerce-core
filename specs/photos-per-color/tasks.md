# Checklist — V6: Fotos por color (`photos-per-color`)

## 1. Backend
- [x] **V22__multicolor_demo.sql** — añade SKUs Negro/Crudo (M, L) al producto 0432/021 con precios y stock espejo (formato VALUES V12). Aplicada y verificada (backend tests 410/0/0).

## 2. Frontend
- [x] **`product-images.ts`** — `getProductImages(reference, color?)` con fallback silencioso a las genéricas.
- [x] **`ProductGallery.tsx`** — prop `color?`, pasa el color a `getProductImages`.
- [x] **PDP** — pasa el color activo a `ProductGallery`.
- [x] **`generate-product-images.mjs`** — descubre colores en array, genera por color con prompt incluyendo el color; manifiesto con claves compuestas.

## 3. Datos
- [x] Producto demo 0432/021 con 3 colores (Marino/Negro/Crudo) y 12 imágenes por color generadas (Marino/Negro/Crudo ×3), sin tocar las 12 intactas.

## 4. Gates
- [x] `tsc` 0 (salvo pre-existente `LayoutProps`), `lint` 0, `build` 0, tests 526/526.
- [x] axe sin regresión (medido en V5: 17/17).
- [x] Verificado en navegador: cambiar de color cambia la galería (Marino → Negro → Crudo).

## Cierre
- [x] Spec-check equivalente: gates verdes, 0 tareas pendientes.
- [x] Docs: bloque «Decisiones V6» en AGENTS.md, MEMORY.md y CHANGELOG.md.