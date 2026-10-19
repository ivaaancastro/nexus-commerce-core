# Plan — Fotos de producto automáticas (Gemini + FLUX gratis)

> **Fase 7 (paralela) · Asset pipeline** · decisiones de diseño (D1–D11).
> Requisitos en `spec.md` · checklist en `tasks.md` (tras la aprobación).
> **Estado**: ✅ APROBADA 2026-10-16 · **D11 (cadena con FLUX gratis)
> aprobada 2026-10-16** tras la adopción bloqueada por cuota de Gemini.

---

## 1. Objetivo

Que **`npm run images` pase a generar fotos reales de producto con IA** cuando
falten, con un solo comando «al meter productos» — manteniendo el modo póster
actual cuando no haya credenciales. La regla central: **ausencia = generar ·
presencia = sagrado** (hoy el script **pisa**, lo que convertía cada ejecución
en una trampa para cualquier foto real).

Resultado: el catálogo deja de ser 12 pósters abstractos (círculo +
«VISTA 1/3») y pasa a fotografía de producto real, con **3:4 nativo** (lo que
pide el `aspect-[3/4]` del frontend) y **1200×1600** (lo que ya usan los
pósters).

---

## 2. Estado real — auditoría previa (2026-10-16)

### 2.1 El script escribe **siempre** — y eso es una trampa hoy

- `scripts/generate-product-images.mjs` (`generate()`, líneas 164–172) hace
  `sharp(…).toFile(target)` **sin comprobar existencia**: cada ejecución
  reescribe los 12 `{ref}-{n}.webp` como póster SVG.
- **AGENTS.md §6.7 manda ejecutar `npm run images` «tras añadir o quitar
  ficheros»** → siguiendo la instrucción con fotos reales puestas, **las
  borra**. (No está en ningún workflow de CI — verificado —, así que el
  daño sería sólo local, pero de igual.)
- Los 5 tests del script (`generate-product-images.test.ts`) cubren **helpers
  puros** (descubrimiento, idempotencia, normalización, manifiesto) —
  `generate()` (la ruta de escritura) **no está testeada**; cambiarla no
  rompe ningún test existente.

### 2.2 Catálogo y fotos actuales

| Ref | Producto | Color (SKU) | Foto real |
|:--|:--|:--|:--|
| `0432/021` | Blazer Cruzada Estructura | Marino (V1) | ❌ póster |
| `0611/018` | Abrigo Lana Oversize | Camel (V12) | ❌ póster (jpg sueltos borrados) |
| `0815/004` | Jersey Punto Lana | Crudo (V12) | ❌ póster |
| `1240/007` | Zapatilla Piel Minimal | Negro (V12) | ❌ póster |

- Los 4 jpg sueltos (`0611-018_1/2/3.jpg` + `_collage.jpg`) **no entraban en
  el pipeline**: nombre con `_` y extensión `.jpg` (el manifiesto sólo
  conoce `0611-018-1.webp`…), `424×719` = ratio **0,59** (el `object-cover`
  del `aspect-[3/4]` recortaría **21 %** → cabeza y pies en la frontal) y
  `424px` de ancho frente a los **~1242px** que llega a pedir el `sizes` de
  la galería (móvil DPR 2) → pixelado. El `_collage.jpg` (1376×768
  apaisado) es la hoja de prompt, no una vista. **Decisión del usuario:
  borrados (2026-10-16).**
- **El estilo de esa muestra es exactamente el objetivo**: estudio de
  hormigón, luz suave, paleta neutral, sello con la referencia abajo-derecha
  — la plantilla de prompt (D4) lo replica.

### 2.3 El frontend **no necesita ningún cambio**

- `ProductImage` pinta lo que traiga el manifiesto en `{ref}-{n}.webp` con
  `aspect-[3/4]` + `object-cover` + `sizes` medido; `getProductImages()`
  importa el JSON estáticamente. Con nombre correcto y 3:4 exacto **entra sin
  tocar componentes ni tests de componentes**.
- Tests que consumen el manifiesto (`product-images.test.ts`) sólo afirman
  **el shape** (`reference → [3 ficheros]`) y las 4 referencias — ninguno
  lee ficheros de disco fuera del propio script.

### 2.4 API de Gemini verificada (docs `ai.google.dev`, 2026-10-16)

- `POST https://generativelanguage.googleapis.com/v1beta/interactions`,
  cabecera `x-goog-api-key: $GEMINI_API_KEY`.
- `response_format: { type: "image", aspect_ratio: "3:4", image_size: "2K" }`
  → **3:4 exacto = cero recorte**, y 2K supera con holgura los 1200×1600
  (el 1K se quedaría corto de ancho).
- Modelos: `gemini-3.1-flash-image` (default, 1K/2K/4K) y
  `gemini-3-pro-image-preview` (máxima calidad, configurable).
- Respuesta `interaction` → `steps[].content[]` con imagen **base64 PNG**;
  `status` puede llegar `completed` o en curso → polling corto.
- ⚠️ **En vivo (2026-10-16, con la key del usuario): 429 «limit: 0 requests
  per day on Free Tier»** en `gemini-3.1-flash-image` y en
  `gemini-2.5-flash-image` → **la API de Gemini de pago es la única vía**
  (billing + $5 prepaid). Hecho y comprobado que el fallback del pipeline
  absorbe el 429 sin romper nada (12 pósters byte-idénticos, exit 0).

### 2.5 Panorama gratuito de generación de imágenes (octubre 2026)

Verificado con búsqueda web (3 fuentes cruzadas) y en vivo con la key del
usuario:

| Vía | Gratis | Decisión |
|:--|:--|:--|
| Gemini API | ❌ 0 imágenes/día en free (todos los modelos de imagen) | Cadena, si hay billing |
| OpenAI `gpt-image` | ❌ Sin free tier | Descartado |
| Hugging Face | ❌ Sin crédito en plan gratis | Descartado |
| **Cloudflare Workers AI** | ✅ 10.000 neurons/día ≈ **173 imágenes FLUX.1 [schnell]**/día, **sin tarjeta** | **Elegido (D11)** |
| Pollinations (anónimo) | ⚠️ Sin cuenta, pero marca de agua, ~1 img/40 s, servicio comunitario inestable | Descartado para catálogo |
| ModelScope | ⚠️ ~250/día pero verificación real-name y **solo no comercial** | Descartado (producto vendible) |

- **FLUX.1 [schnell] es Apache 2.0 → uso comercial limpio** (importante para
  un producto vendible; FLUX *Dev* es no-comercial y queda descartado).
- La cuota se repone a diario (00:00 UTC); 12 fotos caben con holgura en un
  solo día.

### 2.6 API de Cloudflare Workers AI — **medida en vivo (2026-10-19)**

- `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`
  con `Authorization: Bearer $CLOUDFLARE_API_TOKEN` y **body JSON**.
- **El esquema real sólo admite `prompt` y `steps`** (sonda con todos los
  candidatos: `width`, `height`, `num_steps`, `seed`, `guidance`,
  `negative_prompt`, `aspect_ratio`, `image_size` → **400 «Additional or
  unevaluated properties … not allowed»**; `steps` no aparece en la lista de
  rechazos → permitido). **Devuelve 1024×1024** (la doc histórica con
  `width/height` ya no aplica).
- Respuesta JSON `{ success, errors, result: { image: <base64 JPEG>, usage } }`
  (también se soporta respuesta binaria `image/*` por red de seguridad).
- El `1024×1024` nativo **no es 3:4** → `renderPhoto` lo recorta centrado
  (recorte **esperado** de este proveedor, no la red de seguridad) y sube a
  1200×1600 con `lanczos3`, el mismo flujo ya testeado.
- Auth real verificada con las credenciales del usuario (imagen de 901 KB
  b64 en la sonda). El catálogo `GET /ai/models/{id}` devuelve `404
  «Unable to authenticate»` con el token «Workers AI» (permiso distinto) —
  irrelevante para el pipeline.
- **Una petición rechazada por validación no consume cuota** (medido) — las
  sondas de diagnóstico salen gratis.

### 2.7 Precedentes que ya resuelven los patrones

- **6.2 (`searchMode`)**: key opcional con **modo fallback** explícito y nota
  en docs — `photoMode` es el mismo patrón (aquí con tres valores).
- **`.env` raíz** importado por el backend (`spring.config.import`) →
  `GEMINI_API_KEY` y las credenciales Cloudflare viven en el mismo sitio.
- **3.3**: convención `{ref}-{n}.webp` + manifiesto — se conserva íntegra.

---

## 3. Decisiones de diseño

### D1 — Un solo comando; **«ausencia = generar, presencia = sagrado»**

- `npm run images` pasa a hacer, **por cada fichero `{ref}-{n}.webp`**:
  - **No existe** → generar (foto IA si hay credenciales — D2/D11; si no,
    póster SVG como hoy).
  - **Existe** → **no se toca** jamás (protege fotos generadas y descargas
    manuales). La idempotencia pasa a ser *real*: dos corridas = mismo árbol
    **sin pisar nada**.
- Flags: `--force` → regenera **todos** los pósters **pisando lo que haya**
  (destructivo, documentado — sirve para cambiar paleta/estilo);
  `--no-photos` → salta **todas** las APIs aunque haya credenciales (modo
  100 % offline).
- Consecuencia deseada: **al meter un producto nuevo** (migración + reinicio
  para Flyway) basta `npm run images`: sólo se generan sus 3 ficheros.

### D2 — `photoMode`: **AI si `GEMINI_API_KEY`, FREE si sólo credenciales
Cloudflare, PLACEHOLDER si no hay nada**

- Lectura de credenciales: `process.env` → si falta, parseo del **`.env`
  raíz** (mismo fichero, formato `CLAVE=valor`) — sin dependencias nuevas
  (`dotenv` no hace falta). Un único parser sirve para todas las claves.
- Sin credenciales o con `--no-photos` → póster, **con aviso explícito**.
  Espejo del `searchMode` de la 6.2.
- Las claves **jamás aparecen en logs** (sólo «detectada: sí/no»).

### D3 — Datos del prompt desde las migraciones (offline, sin BD)

- **Producto** (nombre, descripción, familia): patrón
  `'(\d{4}/\d{3})', '([^']+)', '([^']+)', '([A-Z]{3,})'` — cubre el formato
  V1 y el V12 con un solo regex; familia con **3+ mayúsculas** para que las
  filas de SKU con talla (`'M'`, `'L'`) no encajen, más guarda anti-nombre-
  todo-dígitos.
- **Color**, dos vías (**D3b ampliada, aprobada 2026-10-19**): (a) cuando la
  migración **empareja referencia + código de barras** de forma explícita
  (formato V12: `('0611/018', '843…', 'Camel', 'M')`, barras de **12
  dígitos** — hallazgo: un `\d{13}` jamás habría matcheado) → cláusula
  «color Camel»; (b) **SKU de `V1` referenciados por `product_id`** (`(1,
  '843321900101', 'Marino', 'M')`): la fila de productos en la **posición
  k** del `INSERT INTO products` **de ese mismo fichero** es el id k —
  determinista en el despliegue real (BD fresca con Flyway desde cero; la
  cabecera de `V12:21` documenta «V1 usaba ids fijos (1, 2, 4) porque corría
  sobre una BD recién creada»). **Guarda anti-adivinar**: sólo si el
  `product_id` cae dentro del rango insertado en ese fichero; fuera de rango
  o statement sin productos → `color: null`. Resultado: `0432/021` →
  «color Marino»; si la foto sale con otro color, se borra el fichero y se
  regenera.
- **3 vistas por posición** (mismo truco que `shapeFor`): `1` frontal/cuerpo
  completo · `2` trasera o perfil · `3` detalle de material y confección.

### D4 — Plantilla editorial (replica la muestra del usuario)

> Fotografía de producto de moda, editorial minimalista: *[nombre]* —
> *[descripción]*, color *[color]*, sobre fondo de estudio de hormigón
> neutro, luz suave difusa, paleta neutral cálida, composición vertical **3:4**
> con margen arriba y abajo, referencia *`0432/021`* estampada en la esquina
> inferior derecha. *Vista: frontal completa / trasera o perfil / detalle.*

- El **sello de referencia** se pide así (la muestra de Gemini lo renderiza
  bien); es decorativo — si alguna vez sale mal, nada funcional depende de él.

### D5 — Cliente Gemini: robusto y **nunca rompe el comando**

- `POST /v1beta/interactions` con `aspect_ratio: "3:4"` e
  `image_size: "2K"`, modelo `gemini-3.1-flash-image` (override por env
  `GEMINI_IMAGE_MODEL`).
- `status: completed` → extrae la imagen de `steps`; en curso → **polling
  con tope de 30 s**; error HTTP → **`PhotoProviderError` con `status`**
  (401/403/429 marcan `permanente`, ver D11).
- El `fetch` y el `sleep` se **inyectan** para que los tests corran con
  mocks (sin red real jamás, regla de testing).

### D6 — Post-proceso con `sharp`: salida **exactamente 1200×1600**

- Entrada **polimórfica**: base64 (Gemini) o buffer binario (FLUX) →
  comprobación de ratio (si no es 3:4 ±1 % → **recorte centrado + aviso**)
  → `resize` a **1200×1600** con `lanczos3` → `.webp({ quality: 85, effort:
  5 })` — **idéntica receta de compresión a la actual**.
- Escritura sólo si todo el proceso termina bien (nunca ficheros a medias).

### D7 — Manifiesto y consumidor **intocados**

- `product-images.json` sigue con el **mismo shape** (`reference → [3
  nombres]`): la única diferencia es que detrás hay foto en vez de póster.
- **Cero diff** en `getProductImages()`, `ProductImage`, `ProductCard`,
  `ProductGallery`, constantes `sizes` y sus tests.

### D8 — Adopción de las 4 referencias existentes

- Borrar los 12 pósters → `npm run images` con credenciales → **12 fotos**
  (3:4, 1200×1600) sustituyéndolos con nombres idénticos.
- Los **4 jpg sueltos de Gemini**: **borrados a decisión del usuario
  (2026-10-16)** — fuera del pipeline.

### D9 — Secretos, coste y CI

- `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` en el
  **`.env` raíz** (ya en `.gitignore`) — dónde obtenerlas: AI Studio
  (Gemini, requiere billing para imagen) y cloudflare.com → Account ID +
  API Token con permiso Workers AI (**cuenta gratis sin tarjeta**).
- **Coste: 0 € con FLUX gratis** (cuota diaria gratuita); Gemini sólo si el
  usuario activa billing. **Sólo local y sólo por lo que falta**;
  **CI intocado**.

### D10 — Sin ADR, sin migraciones, sin E2E/a11y nuevos, sin PR de docs de cierre

- Script de desarrollo, no cambia arquitectura ni runtime (precedente 3.3).
- **CHANGELOG** + receta de **AGENTS.md §6.7** actualizada + bloque «ESTADO
  ACTUAL» refrescado dentro de la feature PR (convención D11 del proyecto).

### D11 — **Cadena de proveedores: Gemini → FLUX (Cloudflare, gratis) → póster**
*(ampliación aprobada 2026-10-16 tras el bloqueo de la adopción)*

- Motivo: la adopción real devolvió **429 con «0 requests/day on Free
  Tier»** en Gemini y el usuario no quiere activar billing → se añade el
  proveedor gratuito **FLUX.1 [schnell] vía Cloudflare Workers AI**
  (§2.5/§2.6: ~173 imágenes/día gratis, Apache 2.0, sin tarjeta).
- **Cadena por fichero**: se intenta Gemini (si hay key) → si falla, FLUX
  (si hay credenciales) → si falla, **póster de respaldo**. La corrida
  **nunca aborta** (exit 0 siempre), como ya probó el fallback real de los
  429.
- **Errores permanentes (401/403/429) desactivan al proveedor para el resto
  de la corrida** con un único aviso — sin esto, una key sin cuota gastaría
  un intento inútil por fichero (medido: 12×429 en la adopción real).
  Otros errores (5xx, red, JSON raro) sólo saltan al siguiente proveedor de
  ese fichero.
- **Modelo FLUX: `@cf/black-forest-labs/flux-1-schnell`** (override env
  `FLUX_MODEL`), **sólo `prompt` + `steps: 4`** (esquema cerrado medido en
  vivo 2026-10-19 — cualquier otro parámetro → 400) y salida **1024×1024**
  recortada a 3:4 en `renderPhoto`.
- `photoMode` gana el valor **`FREE`** (hay FLUX sin Gemini); `AI` significa
  «cadena completa». Estadísticas: `fotos Gemini · fotos FLUX · pósters ·
  intactas · fallos de API` — las cuatro primeras particionan los ficheros.
- Adopción real **vía FLUX gratis**; la vía Gemini queda «preparada» para el
  día que el usuario active billing (un solo comando, sin cambios).

---

## 4. Fuera de alcance

1. **Subida de imágenes desde el panel** — la 7.2 D5 dejó la galería en sólo
   lectura deliberadamente.
2. **Regeneración en CI/CD** — sólo local; CI nunca paga APIs.
3. **Foto por SKU/variante de color** — las imágenes siguen siendo **por
   referencia** (decisión 3.3).
4. **Edición sobre fotos existentes** (Gemini *edit* / img2img, FLUX
   img2img) y **varias candidatas con selección**: hoy 1 intento por vista;
   si no gusta, borrar y regenerar.
5. **Config de prompts por producto** (overrides manuales) — el prompt se
   deduce de la migración.
6. **Marca invisible SynthID/C2PA** de las imágenes generadas: sin efecto
   visual ni funcional, no se trata aquí.
7. **Otros proveedores gratuitos** (Pollinations con marca de agua,
   ModelScope no-comercial, etc.) — descartados con dato en §2.5; si
   Cloudflare retira la cuota, se re-evalúa (la cadena ya degrada a póster).

---

## 5. Estimación y orden de implementación

| # | Bloque | Contenido |
|:-:|:---|:---|
| 1 | **Guarda + modos** | no-pisar en `generate()` · `--force`/`--no-photos` · `photoMode` (env/`.env`) · tests |
| 2 | **Parser de migraciones** | productos (V1/V12) + color emparejado (V12) · tests |
| 3 | **Prompt** | plantilla editorial + 3 vistas · tests |
| 4 | **Cliente Gemini** | `fetch` inyectado, 3:4/2K, polling, `PhotoProviderError` · tests con mock |
| 4b | **Cliente FLUX (D11)** | Cloudflare Workers AI, JSON `{prompt, steps}`, `success:false`/binario · tests con mock |
| 5 | **Post-proceso** | entrada polimórfica → ratio check → resize 1200×1600 → webp q85 · tests |
| 6 | **Integración** | cadena Gemini→FLUX→póster + desactivación por error permanente + resumen · tests de conjunto |
| 7 | **Docs** | CHANGELOG · AGENTS §6.7 (receta + credenciales) |
| 8 | **Adopción + verificación** | borrar 12 pósters → run con credenciales → 12 fotos FLUX · verificación visual (ficha, catálogo, buscador) · gate + CI |

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| **Gemini sin billing** (0 gratis, medido en vivo) | Cadena D11: FLUX gratis respalda; Gemini queda preparado para cuando haya cuota |
| **Cuota FLUX agotada / Cloudflare caído** | Póster de respaldo + exit 0 (D5/D11); la cuota se repone a diario (00:00 UTC) — reintentar mañana |
| **Calidad de FLUX schnell menor que Gemini** | Prompt editorial denso (D4) + sello; si no gusta, borrar el fichero → regenerar |
| **Color por `product_id`** (D3b, asunción BD fresca) | Guarda anti-adivinar (sólo ids dentro del rango insertado en el fichero); no matchea → `color: null` → borrar → regenerar |
| **Calidad floja de un intento** | Borrar el fichero → regenera (la guarda no-pisar permite elegir cuándo) |
| **LCP de la ficha** con foto real (más pesada que un póster de 10 KB) | Misma normalización 1200×1600 + q85 + `sizes` medido + lazy; el gate real es el job `cwv-audit` de la PR; si aprieta → bajar calidad |
| **Texto del sello** mal renderizado | Decorativo; nada funcional depende de él |
| **Secretos Cloudflare en logs** | Mismo disciplina que la key Gemini: claves sólo en cabecera `Authorization`, jamás en mensajes |
| R8: rotar tests existentes | Los 5 tests del script y los de manifiesto/componentes **no cambian aserción** (shape y helpers intactos) |
