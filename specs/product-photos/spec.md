# Spec — Fotos de producto automáticas (Gemini + FLUX gratis)

> **Fase 7 (paralela) · Asset pipeline** · requisitos (R1–R9) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D11) · checklist en `tasks.md`.
> **Estado**: ✅ APROBADA 2026-10-16 · **R4b/R6b (cadena FLUX) aprobadas
> 2026-10-16** (ampliación de alcance, regla 3).

---

## Resumen

`npm run images` pasa a **generar fotos reales con IA** para los ficheros que
falten (3:4 nativo, 1200×1600, webp q85) usando la cadena **Gemini → FLUX
gratuito (Cloudflare) → póster de respaldo**, con **modo póster** cuando no
hay credenciales — «automático al meter productos», sin pisar nada existente.

- **Regla central**: *ausencia = generar · presencia = sagrado* — la
  trampa actual de «reescribe siempre» desaparece (plan D1).
- **`photoMode`: AI (con Gemini) · FREE (sólo FLUX) · PLACEHOLDER** —
  espejo del `searchMode` de la 6.2 (plan D2/D11).
- **Cadena por fichero con desactivación por error permanente** (401/403/429
  desactivan al proveedor en la corrida) — plan D11.
- Prompt deducido de las **migraciones** (nombre, descripción, familia,
  color cuando la migración lo empareja en V12 o por posición de
  `product_id` en V1 — D3b) con **3 vistas por posición** (plan D3/D4).
- Gemini: `POST /v1beta/interactions` + `aspect_ratio: "3:4"` +
  `image_size: "2K"` (plan D5) · FLUX: Cloudflare Workers AI,
  `@cf/black-forest-labs/flux-1-schnell`, JSON `{prompt, steps: 4}` (plan D11).
- **Frontend y manifiesto intocados** — mismo shape, mismos nombres (D7).
- Sin ADR, sin migraciones, CI intocado (D9/D10).

---

## R1 — Guarda «no pisar» y modos de ejecución

**Criterio**: ninguna ejecución normal destruye un fichero existente.

- `npm run images` → para **cada `{ref}-{n}.webp`**:
  - **Inexistente** → se genera (cadena de foto IA si hay credenciales,
    póster si no).
  - **Existente** → **intocado** (byte a byte).
- **Idempotencia real**: dos corridas consecutivas sin cambios producen el
  mismo árbol **y no reescriben ningún fichero** (test: contenido intacto y
  `fetch` **jamás llamado**).
- `--force` → regenera **todos** los pósters **pisando** (destructivo;
  documentado en el help/AGENTS; nunca llama a ninguna API).
  `--no-photos` → nunca llama a ninguna API (Gemini ni FLUX).
- El manifiesto se reescribe siempre (es barato y es el que manda).
- Resumen final de la corrida: `fotos Gemini · fotos FLUX · pósters ·
  intactas · fallos de API` (las cuatro primeras **particionan** los
  ficheros; `fallos` es informativo).

---

## R2 — Parser de migraciones (datos del prompt)

- **Producto** para toda referencia `\d{4}/\d{3}`: `name`, `description`,
  `family` con un único regex compatible con los formatos **V1 y V12**
  (`('0611/018', 'Abrigo Lana Oversize', 'Abrigo de lana…', 'OUTERWEAR')`),
  familia `[A-Z]{3,}` para que las filas de SKU con talla no encajen.
- **Color** por dos vías (plan D3, segunda vía **aprobada 2026-10-19**):
  (a) la migración empareja referencia + código de barras explícitamente
  (formato V12 `('0611/018', '843…', 'Camel', 'M')`, barras de 12 dígitos) →
  primer color de la referencia; (b) **filas de SKU de `V1` con sólo
  `product_id`** → se asocian al producto que ocupa esa **posición** en el
  `INSERT INTO products` **del mismo fichero** (ids secuenciales desde 1 en
  BD fresca — intención documentada en la cabecera de `V12`), con **guarda
  anti-adivinar**: id fuera del rango insertado en ese fichero → se ignora →
  `color: null`. Así `0432/021` recibe **color Marino**.
- Sin confundir códigos de barras ni fechas con referencias (misma disciplina
  que los tests existentes del script; testeado sobre migraciones reales y
  fixture).
- **Offline**: cero acceso a BD o red para obtener datos.

---

## R3 — Prompt: plantilla editorial + 3 vistas

- Plantilla (plan D4): descripción del producto + color + estudio de hormigón
  neutro + luz suave + paleta neutral + vertical **3:4** con margen +
  **sello de la referencia** abajo-derecha.
- **Vistas por índice**: `1` frontal/cuerpo completo · `2` trasera o perfil ·
  `3` detalle de material y confección — redactadas para prenda **y**
  calzado.
- El prompt construido es **testeable** (función pura: datos + índice →
  string) y contiene siempre la referencia normalizada; sin datos de
  producto el sujeto es la propia referencia.

---

## R4 — Cliente de la API Gemini

- `POST https://generativelanguage.googleapis.com/v1beta/interactions`,
  cabecera `x-goog-api-key`, body:
  `model` (`gemini-3.1-flash-image` por defecto; override
  `GEMINI_IMAGE_MODEL`), `input` = prompt,
  `response_format: { type: "image", aspect_ratio: "3:4", image_size: "2K" }`.
- **`status: completed`** → extrae la imagen base64 (`steps[].content[]`,
  `mime_type` PNG; red de seguridad: forma `candidates/parts/inlineData`);
  **en curso** → polling con **tope de 30 s**; después → error.
- **Errores HTTP → `PhotoProviderError` con `status`**; los códigos
  **401/403/429 marcan `permanente`** (plan D11: desactivan al proveedor en
  la corrida). El `fetch` y el `sleep` son **inyectables**: los tests usan
  mocks; **sin red real nunca**.
- La key **no aparece jamás en logs** (sólo «detectada: sí/no»).

---

## R4b — Cliente FLUX (Cloudflare Workers AI, gratuito)

*(requisito añadido el 2026-10-16 — plan D11/D2.6)*

- `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
  cabecera `Authorization: Bearer {CLOUDFLARE_API_TOKEN}`, **body JSON
  `{ prompt, steps: 4 }`** — el esquema del modelo **sólo admite esas dos
  claves** (medido en vivo 2026-10-19: cualquier otro parámetro → 400
  «not allowed») y devuelve **1024×1024**, que `renderPhoto` recorta
  centrado a 3:4 (recorte esperado de este proveedor). Modelo por defecto
  con override env `FLUX_MODEL`.
- Respuesta: JSON `{ success, errors, result: { image: base64 } }`; también
  se soporta **binario `image/*`** (`arrayBuffer`) como red de seguridad.
- **`success: false` o `!response.ok` → `PhotoProviderError`** con el mensaje
  de `errors[0]` (401/403/429 → `permanente`).
- Credenciales `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` leídas como
  la key Gemini (env → `.env` raíz); **las dos o ninguna** (con una sola →
  proveedor no disponible, no error). **El token jamás aparece en logs.**

---

## R5 — Post-proceso: salida exactamente 1200×1600 webp

- Entrada **polimórfica**: base64 (Gemini) o buffer binario (FLUX).
- Ratio comprobado: **3:4 ±1 %**; si no coincide → **recorte centrado +
  aviso** (red de seguridad).
- `resize` a **1200×1600** (`lanczos3`) → **`.webp({ quality: 85, effort:
  5 })`** (misma receta que los pósters, plan D6).
- Escritura **sólo si todo el proceso completa** — jamás ficheros a medias.
- Verificación post-condiciones: fichero final con `metadata()` →
  `format: webp`, `1200×1600`, ratio exacto.

---

## R6 — Integración en `generate()`, cadena y consumidor intacto

- `generate()` orquesta por fichero: **ausente → cadena Gemini → FLUX →
  póster** · **presente → skip** · `--force` → póster directo pisando.
- **Desactivación por corrida**: un `PhotoProviderError` permanente
  (401/403/429) deja al proveedor caído para el resto con **un único aviso**
  — una key sin cuota no gasta un intento por fichero.
- Resumen distingue `fotos Gemini / fotos FLUX / pósters / intactas /
  fallos de API`; la corrida **siempre resuelve** (`exit 0`) — comprobado en
  vivo con los 12×429 de Gemini (pósters byte-idénticos, manifiesto intacto).
- **Manifiesto con el mismo shape** (`reference → [3 nombres]`) — los tests
  que lo consumen (`product-images.test.ts`) **no cambian aserción**.
- **Cero diff** en `getProductImages()`, `ProductImage`, `ProductCard`,
  `ProductGallery`, constantes `sizes` y sus tests — la foto entra sólo por
  el nombre de fichero (plan D7).

---

## R7 — Secretos y CI

- `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN`
  leídas de `process.env` o del **`.env` raíz** (parser propio
  `CLAVE=valor`, sin dependencias nuevas); el `.env` ya está en
  `.gitignore`. **Ninguna clave en logs.**
- Sin credenciales → `photoMode=PLACEHOLDER` + aviso explícito.
- **Ningún workflow de CI ejecuta `npm run images`** (verificado) → **CI
  verde sin cambios** (plan D9).
- Documentación: dónde obtener cada credencial (AI Studio con billing ·
  Cloudflare gratis sin tarjeta) y coste (0 € con FLUX).

---

## R8 — Tests

### R8.1 — Nuevos (mockeados, sin red)

- **Guarda**: con los 3 ficheros precargados en tmp, `generate()` los deja
  **idénticos** y la API **no se llama ni una vez**.
- **Modos**: key presente/ausente → `AI`/`FREE`/`PLACEHOLDER`;
  `--no-photos` y `--force` (el único que pisa).
- **Parser**: formato V1 y V12 (nombre/desc/familia), color emparejado V12
  y **color de `0432/021` → `Marino` por `product_id` dentro de rango (D3b,
  ampliación 2026-10-19; antes asentaba `sin color`)** — id fuera de rango →
  `null` —, anti-falsos positivos (barras/fechas).
- **Prompt**: 3 vistas distintas, contiene referencia normalizada y color
  cuando existe; sujeto de respaldo sin datos.
- **Cliente Gemini**: `completed` → imagen; polling hasta `completed`;
  `500` → lanza; `failed` → lanza; aserción de body (`3:4`/`2K`) y cabecera.
- **Cliente FLUX**: aserción de URL/`Bearer`/body (`{prompt, steps: 4}`);
  `success:false` → lanza con el mensaje; `429` → `PhotoProviderError`
  permanente; binario `image/*` → buffer.
- **Cadena**: Gemini 429 → se omite (**1 solo intento**) y FLUX genera las
  3 · sólo FLUX → modo `FREE` · todo falla → 3 pósters y resolución sin
  excepción.
- **Post-proceso**: receta 1200×1600 webp q85 desde un PNG de prueba, con y
  sin desviación de ratio.
- **Integración**: corrida completa con cliente mock → 3 fotos creadas +
  manifiesto shape correcto.

### R8.2 — Preexistentes (R8 del proyecto)

- **Ningún test cambia aserción**: los 5 de `generate-product-images.test.ts`
  (helpers), `product-images.test.ts` (manifiesto), `ProductImage.test.tsx`
  y `ProductGallery.test.tsx` quedan tal cual.
- Gate final: `npm run test:coverage` **EXIT 0**, `tsc` 0, ESLint **0/0**,
  `npm run build`.

---

## R9 — Adopción real y verificación

1. **Borrar los 12 pósters** (los del catálogo) → ejecutar
   `npm run images` **con credenciales** → **12 fotos** con nombres idénticos
   (`{ref}-{n}.webp`), 3:4, 1200×1600, y manifiesto con shape intacto.
   **Vía FLUX gratis** (D11); la vía Gemini queda disponible el día que haya
   billing (mismo comando, cadena ya implementada).
2. **Verificación visual** con stack levantado: ficha de las 4 referencias
   (galería 3 fotos, primera `eager`), portada/catálogo (tarjetas), y
   buscador — **sin placeholders** (ninguna caja gris), colores coherentes
   con el SKU en las **4** referencias (`0432/021` **marino** — vía D3b
   aprobada 2026-10-19 —, `0611/018` camel, `0815/004` crudo, `1240/007`
   negro).
3. **Comprobación negativa del modo fallback**: corrida en tmp sin
   credenciales → pósters con aviso · corrida real con Gemini sin cuota →
   12×429 absorbidos con pósters byte-idénticos y `exit 0` **(medido en
   vivo 2026-10-16)**.
4. **CI de la PR en verde** (Backend · Frontend · E2E · Lighthouse — éste
   último es el que vigila el peso de las fotos en el LCP, plan §6).
5. **CHANGELOG** entrada nueva · **AGENTS.md §6.7** con la receta
   actualizada (cadena y credenciales) · bloque «ESTADO ACTUAL» refrescado
   **dentro de la feature PR** (convención D11).
6. **`/spec-check product-photos`** en verde · **sin ADR** y **sin PR de
   documentación de cierre** (plan D10).
