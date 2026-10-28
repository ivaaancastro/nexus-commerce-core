# Checklist — V6: Fotos por color (`photos-per-color`)

## 1. Backend
- [ ] **V22__multicolor_demo.sql** — añade SKUs de 2 colores al producto demo (ON CONFLICT DO NOTHING).

## 2. Frontend
- [ ] **`product-images.ts`** — `getProductImages(reference, color?)` con fallback.
- [ ] **`ProductGallery.tsx`** — prop `color?`.
- [ ] **PDP** — pasar color activo a `ProductGallery`.
- [ ] **`generate-product-images.mjs`** — categorizar por color, regenerar manifiesto.

## 3. Datos
- [ ] Elegir producto demo y generar sus fotos por color (`npm run images`).
- [ ] Verificar en navegador: cambiar de color cambia la galería.

## 4. Gates
- [ ] `tsc` 0, `lint` 0, `build` 0, tests verdes.
- [ ] axe sin regresión.