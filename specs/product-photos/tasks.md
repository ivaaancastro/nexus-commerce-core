# Tasks — Fotos de producto automáticas (Gemini + FLUX gratis)

> **Fase 7 (paralela) · Asset pipeline** · spec `spec.md` (R1–R9, R4b/R6b) ·
> plan `plan.md` (D1–D11). Un checkbox por unidad terminada; decisiones y
> hallazgos como nota debajo de su bloque. **Regla**: marcar al completar;
> nada de código fuera de este checklist.

---

## A — Guarda «no pisar», modos y CLI (R1, plan D1/D2)

- [x] **A.1** `generate()` comprueba **existencia por fichero** antes de escribir: `{ref}-{n}.webp` presente → **intacto** (byte a byte), sólo se cuentan como `intactas`
- [x] **A.2** Flags de CLI: `--force` (regenera **todos** los pósters **pisando**, destructivo, nunca llama a API alguna) y `--no-photos` (nunca llama a API alguna aunque haya credenciales)
- [x] **A.3** `resolvePhotoMode({ apiKey, credentials, noPhotos })` → `AI` | `FREE` | `PLACEHOLDER` + parser propio de `.env` (`readEnvValue`) para `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN`
- [x] **A.4** Resumen final por corrida: `fotos Gemini · fotos FLUX · pósters · intactas · fallos de API` + línea de modo — las claves **jamás** en logs

> **Hallazgo**: el tipo JSDoc `NodeJS.ProcessEnv` exige `NODE_ENV` (typedef de
> Next) y rompía `tsc` con literales de test → el parámetro se ensanchó a
> `Record<string, string|undefined>`.

## B — Parser de migraciones (R2, plan D3)

- [x] **B.1** `discoverProducts(dir)` → `Map<ref, { name, description, family, color }>`: productos con un solo regex compatible **V1 y V12** (familia `[A-Z]{3,}`) + guardas anti-falso-positivo (nombre todo dígitos descartado; SKU no son productos)
- [x] **B.2** Color por **dos vías** (D3b ampliada, aprobada 2026-10-19): emparejamiento **referencia + código de barras** explícito (formato V12) **y** SKU de `V1` con `product_id` asociados a la fila de productos **del mismo fichero** en posición k = id k, con guarda anti-adivinar (id fuera de rango → `color: null`)
- [x] **B.3** Tests: migraciones reales (las 4 referencias; `0611/018` → `Camel`; **`0432/021` → `Marino`**) + fixture con SKU sin referencia y fechas sueltas
  > **Actualización de aserción (2026-10-19)**: B.3 asentaba `0432/021 → null`. La ampliación D3b **aprobada por el usuario** la cambia a `Marino`; los **5 tests originales preexistentes (R8) siguen intactos** — este era un test nuevo de esta feature.
- [x] **B.4** Guarda anti-adivinar testeada: `product_id` fuera del rango insertado en el fichero → `color: null` (fixture con 2 productos + id fuera de rango; la fixture preexistente de «no crea producto» ajustó su fila a `id=5` **conservando sus aserciones**) · 40/40 tests del script en verde

> **Hallazgo**: los códigos de barras sembrados tienen **12 dígitos**
> (`843321900201`), no 13 — un `(\d{13})` jamás habría matcheado; patrón
> final `(\d{8,14})`.

## C — Prompt editorial (R3, plan D4)

- [x] **C.1** `buildPrompt(reference, product, index)` puro: plantilla editorial + cláusula de color **sólo si existe** + sujeto de respaldo si no hay producto
- [x] **C.2** `VIEWS` por índice: `1` frontal completa · `2` trasera o perfil · `3` detalle de material y confección
- [x] **C.3** Tests: 3 vistas distintas · referencia y `color Camel` cuando hay color · **sin** la palabra `color` cuando `color: null` · sujeto de respaldo

## D — Cliente de la API Gemini (R4, plan D5)

- [x] **D.1** `fetchImageBase64({ prompt, apiKey, model, fetchImpl, sleep, … })`: `POST /v1beta/interactions` con `x-goog-api-key`, body `{ model, input, response_format: { type: "image", aspect_ratio: "3:4", image_size: "2K" } }` (override `GEMINI_IMAGE_MODEL`)
- [x] **D.2** Estados: `completed` → extrae imagen (`steps[].content[]`; fallback `candidates/parts/inlineData`) · en curso → **polling `GET /interactions/{id}` con tope de 30 s** · `failed`/`error`/`!res.ok` → **lanza**
- [x] **D.3** Errores HTTP → **`PhotoProviderError` con `status`**; **401/403/429 marcan `permanente`** (plan D11)
- [x] **D.4** `fetch` e `sleep` **inyectables** — tests con mocks: `completed` inline · pendiente→completado en 1 poll · `500` lanza · `failed` lanza · body y cabecera asertados

## K — Cliente FLUX por Cloudflare Workers AI (R4b, plan D11) *(ampliación 2026-10-16)*

- [x] **K.1** `readCloudflareCredentials(env, envPath)` → `{ accountId, apiToken }` **sólo si están las dos** (con una sola → `null`, no error); mismo parser `.env` que la key Gemini
- [x] **K.2** `fetchFluxImage({ prompt, credentials, model, fetchImpl, steps })`: `POST /client/v4/accounts/{id}/ai/run/@cf/black-forest-labs/flux-1-schnell` (override `FLUX_MODEL`) con `Authorization: Bearer` y body JSON **`{ prompt, steps: 4 }`** — esquema cerrado **medido en vivo (2026-10-19)**: sólo admite esas dos claves; devuelve 1024×1024 que `renderPhoto` recorta centrado a 3:4
- [x] **K.3** Respuesta: JSON `{ success, errors, result.image }` → base64; **binario `image/*`** (`arrayBuffer`) como red de seguridad; `success:false`/`!ok` → `PhotoProviderError` con `errors[0].message` (401/403/429 → permanente)
- [x] **K.4** Tests con mock: URL/`Bearer`/body asertados · `success:false` lanza «neurons…» · `429` → permanente · binario → buffer

## E — Post-proceso con sharp (R5, plan D6)

- [x] **E.1** `renderPhoto(input)`: entrada **polimórfica** (base64 Gemini | buffer FLUX) → ratio **3:4 ±1 %** (desviado → `fit: "cover"` centrado + aviso) → `resize(1200, 1600, lanczos3)` → `.webp({ quality: 85, effort: 5 })` → buffer
- [x] **E.2** Tests: PNG 120×160 → webp **1200×1600** sin desviación · PNG 424×719 → `desviado: true`

## F — Integración en `generate()`, cadena y consumidor (R6, plan D1/D11)

- [x] **F.1** Cadena por fichero: **existente → skip** · ausente → Gemini (si key) → FLUX (si credenciales) → **póster de respaldo**; escritura **sólo al final**; nunca aborta
- [x] **F.2** **Desactivación por corrida**: `PhotoProviderError` permanente → proveedor caído con **un único aviso** (medido: sin esto, key sin cuota = 12×429)
- [x] **F.3** Inyecciones (`outputDir`, `manifestPath`, `references`, `env`, `envPath`, `fetchImpl`, `sleep`, `log`, `model`, `fluxModel`) con defaults de producción — **los tests jamás tocan `public/products/`, el manifiesto real ni la red**
- [x] **F.4** Manifiesto reescrito siempre con el **mismo shape** (verificado byte-idéntico tras corrida real)
- [x] **F.5** Tests de conjunto (tmp): 3 centinelas intactas + `fetch` jamás llamado · AI×3 · Gemini 429 → **1 intento** y FLUX×3 (`fallos: 1`) · sólo FLUX → `FREE` · todo falla → 3 pósters sin excepción (`fallos: 4`) · `--force` pisa · `--no-photos` sin red · sin credenciales → `PLACEHOLDER`

> **Hallazgo (test)**: el fallback contaba doble (`poster` + `fallback`) y las
> categorías no particionaban → stats finales `ia/free/poster/intacta`
> particionan y `fallos` queda como contador informativo.

## G — Tests: gate (R8)

- [x] **G.1** `npm run test:coverage` **EXIT 0**; **los 5 tests preexistentes** del script + `product-images.test.ts` + `ProductImage.test.tsx` + `ProductGallery.test.tsx` **sin cambio de aserción**
- [x] **G.2** `tsc` 0 · ESLint **0/0** · `npm run build` 0 · cobertura global **≥ baseline 7.4** (85.58 / 81.6 / 83.3 / 87.71)

## H — Documentación (R7/R9.5, plan D9/D10)

- [x] **H.1** `AGENTS.md` §6.7: receta con cadena Gemini→FLUX→póster, credenciales (AI Studio con billing · Cloudflare gratis sin tarjeta) y flags
- [x] **H.2** `CHANGELOG.md`: entrada en `[Unreleased]` (es-ES) con la verificación completa
- [x] **H.3** Plan/spec actualizados con D11/R4b, el hallazgo «0 free en Gemini» y el panorama gratuito verificado (regla 3)

## I — Adopción real con FLUX gratis y verificación (R9)

- [x] **I.1** **Comprobaciones negativas** (R9.3): test `generate()` sin credenciales → PLACEHOLDER sin `fetch` · corrida real con Gemini sin cuota → **12×429 absorbidos**, pósters byte-idénticos, `exit 0` (medido en vivo 2026-10-16)
- [x] **I.2** Key Gemini recibida (`.env` raíz) — verificado `photoMode: AI`; su cuota free es 0 (motivo de D11) · **credenciales Cloudflare recibidas 2026-10-19** (`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` en el `.env` raíz; ambas o ninguna) — auth real verificada con imagen de 901 KB
- [x] **I.3** Borrar los 12 pósters → `npm run images` → **12 fotos FLUX** (3:4, 1200×1600, webp) con nombres idénticos + manifiesto shape intacto · **medido en vivo 2026-10-19**: 1×Gemini `429` → desactivado con un solo aviso → `width`/`height`/`num_steps` rechazados en vivo (esquema cerrado → K.2 corregido, regla 3) → 11 fotos + 1 rechazo **NSFW** aleatorio (reintento OK) → 12/12 · **posterior ampliación D3b**: 3 fotos del blazer regeneradas con «color Marino» (12/12 finales, `exit 0` en todas)
- [x] **I.4** Verificación visual con stack levantado (backend :8080 ✓ · frontend :3001 ✓): ficha de las 4 referencias (galería 3 fotos, primera `eager`), catálogo y buscador — **sin placeholders grises**, colores coherentes con el SKU en **4/4** (camel · crudo · negro · **marino vía D3b** — verificado también en la facet `color=Marino`; la verificación pilló además la caché `/_next/image` del navegador → resuelta con contextos aislados + `rm .next/cache/images`)
- [x] **I.5** jpg sueltos de Gemini: **borrados a decisión del usuario** (2026-10-16)

## J — Cierre

- [x] **J.1** `/spec-check product-photos` en verde (recorrido R1–R9 tras I.3/I.4) — **APROBADO 2026-10-19**: 9/9 grupos, 424/424 tests, gates 0, R9.4 (CI) pendiente de la PR en J.3
- [x] **J.2** Bloque «ESTADO ACTUAL» de `AGENTS.md` + `MEMORY.md` refrescados **dentro de la feature PR** (convención D11) — 2026-10-19 (tabla, decisiones `product-photos`, entrada de tarea completada y roadmap 7.5)
- [x] **J.3** Commits convencionales en español + PR (previa petición al usuario ⛔, aprobada 2026-10-19 — commit único de 20 ficheros, **excluidos `specs/admin-users/` y `.vscode/`**) · **CI 4/4 verde**: Backend 1m12s · Frontend 1m26s · E2E 3m5s · Lighthouse 4m29s
