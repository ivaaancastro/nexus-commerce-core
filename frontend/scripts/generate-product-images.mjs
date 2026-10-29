#!/usr/bin/env node
/**
 * Genera las imágenes del catálogo y su manifiesto (Tarea 3.3, R1–R3;
 * fotos con IA: spec `product-photos`, R4/R4b).
 *
 * Uso:
 *   npm run images                  → rellena lo que FALTE con la cadena
 *                                      Gemini (si hay `GEMINI_API_KEY`) →
 *                                      FLUX gratis (si hay credenciales
 *                                      Cloudflare) → póster SVG
 *   npm run images -- --no-photos   → nunca llama a ninguna API (offline)
 *   npm run images -- --force       → regenera TODOS los pósters (¡pisa!)
 *
 * Qué hace:
 *   1. Autodescubre las referencias de producto con el patrón '[0-9]{4}/[0-9]{3}'
 *      en `backend/src/main/resources/db/migration/*.sql` → no hay ninguna lista
 *      que mantener a mano: al sembrar un producto basta con re-ejecutar.
 *   2. Por cada `{ref normalizado}-{n}.webp`:
 *        · **existe → NO SE TOCA** («ausencia = generar, presencia = sagrado»:
 *          ninguna corrida normal destruye una foto ya generada o descargada);
 *        · **falta → cadena de proveedores**: Gemini (`aspect_ratio: "3:4"`,
 *          `image_size: "2K"`) → FLUX por Cloudflare Workers AI (1024×1024
 *          nativo, recortado a 3:4) → póster SVG de toda la vida (respaldo
 *          que nunca aborta). Un error de cuota/autorización (401/403/429)
 *          desactiva al proveedor **para el resto de la corrida** con un
 *          único aviso.
 *      Todo sale normalizado a 1200×1600 webp q85 (misma receta de compresión
 *      que los pósters).
 *   3. Escribe `src/data/product-images.json`, el manifiesto que el frontend
 *      importa estáticamente para no pedir ficheros que no existen. Su shape
 *      (`reference → [3 nombres]`) no cambia jamás: detrás de un nombre puede
 *      haber foto o póster, y al frontend le da igual.
 *
 * Credenciales en `process.env` o en el `.env` raíz del monorepo (mismo
 * fichero que `OPENAI_API_KEY`): `GEMINI_API_KEY` (requiere billing para
 * modelos de imagen — free tier = 0/día, medido en vivo), o
 * `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (Workers AI, cuota
 * gratuita de ~173 imágenes FLUX al día, sin tarjeta). Sin ninguna, el modo
 * es póster con aviso — mismo patrón que `searchMode` de la Tarea 6.2.
 * Ningún workflow de CI ejecuta este script, así que CI sigue verde sin
 * credenciales. **Ninguna clave aparece jamás en un log.**
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(HERE, "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const MIGRATIONS_DIR = path.join(
    REPO_ROOT,
    "backend/src/main/resources/db/migration"
);
const OUTPUT_DIR = path.join(FRONTEND_ROOT, "public/products");
const MANIFEST_PATH = path.join(FRONTEND_ROOT, "src/data/product-images.json");
const ROOT_ENV_PATH = path.join(REPO_ROOT, ".env");

export const IMAGES_PER_PRODUCT = 3;
const WIDTH = 1200;
const HEIGHT = 1600;

// ── Proveedor premium: API de generación de Gemini (spec R4, plan D5) ──────
const GEMINI_ENDPOINT =
    "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_MODEL = "gemini-3.1-flash-image";
/** `3:4` nativo = cero recorte; `2K` supera los 1200×1600 objetivo. */
const ASPECT_RATIO = "3:4";
const IMAGE_SIZE = "2K";
/** Tope de polling: 6 intentos × 5 s = 30 s (spec R4). */
const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 5000;
const FAILURE_STATES = new Set(["failed", "error", "cancelled", "canceled"]);

// ── Proveedor gratuito: FLUX.1 [schnell] por Cloudflare Workers AI ─────────
// (spec R4b, plan D11): ~10.000 neurons/día gratis ≈ 173 imágenes; el modelo
// es Apache 2.0 → uso comercial limpio. La cuota se repone a diario (UTC).
const CLOUDFLARE_ENDPOINT = "https://api.cloudflare.com/client/v4/accounts";
const DEFAULT_FLUX_MODEL = "@cf/black-forest-labs/flux-1-schnell";
/**
 * El esquema del modelo sólo admite `prompt` y `steps` (medido en vivo
 * 2026-10-19: `width`/`height`/`num_steps`/`seed`/… → 400 «not allowed») y
 * devuelve **1024×1024** — el recorte a 3:4 lo resuelve `renderPhoto`.
 */
const FLUX_STEPS = 4;

/**
 * Error de un proveedor de imagen. `permanente` marca los códigos de
 * **cuota/autorización** (401/403/429): reintentar en el resto de ficheros
 * de la misma corrida es inútil, así que el proveedor se desactiva.
 */
export class PhotoProviderError extends Error {
    /**
     * @param {string} message
     * @param {{status?: number}} [info]
     */
    constructor(message, { status = 0 } = {}) {
        super(message);
        this.name = "PhotoProviderError";
        this.status = status;
        this.permanente = [401, 403, 429].includes(status);
    }
}

/** Tono de fondo y tono de acento, derivados del hash de la referencia. */
const PALETTE = [
    ["#efece6", "#e0dcd4"],
    ["#e7e3db", "#d5d0c6"],
    ["#ddd8ce", "#cac4b8"],
    ["#d5cfc5", "#bfb8ab"],
    ["#e9e7e4", "#d7d4d0"],
    ["#ded9d3", "#c8c2ba"],
];
const ACCENTS = ["#b9b2a6", "#aca596", "#a39c8d", "#9c9689", "#b0a99d", "#a8a094"];

const REFERENCE_PATTERN = /'(\d{4}\/\d{3})'/g;
/**
 * Fila de producto (`V1` y `V12`): `'0611/018', 'Nombre', 'Descripción', 'OUTERWEAR'`.
 * La familia exige **3+ mayúsculas** para que las filas de SKU
 * `('1240/007', '843…', 'Negro', 'M')` —con talla de 1–2 letras— **no** encajen.
 */
const PRODUCT_PATTERN = /'(\d{4}\/\d{3})', '([^']+)', '([^']+)', '([A-Z]{3,})'/g;
/**
 * Color emparejado con su referencia (`V12`): `('0611/018', '8433…', 'Camel', 'M')`.
 * Los códigos de barras sembrados tienen **12 dígitos** (hallazgo: `\d{13}`
 * jamás habría matcheado); los SKU de `V1` van referenciados por
 * `product_id`, sin la referencia en la fila → no se pueden asociar sin
 * adivinar ids (limitación plan D3).
 */
const COLOR_PATTERN = /'(\d{4}\/\d{3})', '(\d{8,14})', '([^']+)', '([^']+)'/g;

/**
 * Filas de SKU con **`product_id` entero** (formato `V1`: `(1, '843321900101',
 * 'Marino', 'M')`) — la vía (b) del color, **D3b ampliada (aprobada
 * 2026-10-19)**. El primer elemento debe ser un **número sin comillas** para
 * que las `VALUES` con referencia de `V12` (`('0611/018', …)`) no encajen
 * (ellas ya las cubre `COLOR_PATTERN`).
 */
const SKU_ID_PATTERN = /\(\s*(\d+)\s*,\s*'(\d{8,14})'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g;

/** Sólo statements de `skus` **cuya primera columna es `product_id`**. */
const SKU_ID_STATEMENT = /INSERT INTO skus\s*\(\s*product_id\s*,[^;]*;/i;

/** Vistas por posición (mismo truco que `shapeFor`): frontal, trasera, detalle. */
const VIEWS = [
    "vista frontal completa",
    "vista trasera o de perfil",
    "detalle de material y confección",
];

/**
 * Extrae las referencias de producto de un directorio de migraciones.
 * @param {string} dir directorio con ficheros `.sql`
 * @returns {string[]} referencias ordenadas y sin duplicados
 */
export function discoverReferences(dir = MIGRATIONS_DIR) {
    const found = new Set();
    const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    for (const file of files) {
        const sql = readFileSync(path.join(dir, file), "utf8");
        for (const match of sql.matchAll(REFERENCE_PATTERN)) {
            found.add(match[1]);
        }
    }
    return [...found].sort();
}

/**
 * `0432/021` → `0432-021`. La barra no puede ir en un nombre de fichero.
 * @param {string} reference
 */
export function normalizeReference(reference) {
    return reference.replace(/\//g, "-");
}

/**
 * @param {string} reference
 * @param {number} index posición desde 1 (1 = imagen principal de la tarjeta)
 */
export function fileNameFor(reference, index) {
    return `${normalizeReference(reference)}-${index}.webp`;
}

export function fileNameForColor(reference, color, index) {
    const slug = String(color).trim().toUpperCase().replace(/\s+/g, "");
    return `${normalizeReference(reference)}-${slug}-${index}.webp`;
}

/**
 * Manifiesto `reference → [fichero, …]`, listo para serializarse.
 * **Shape estable**: los consumidores (`getProductImages`) no cambian aunque
 * detrás de cada nombre haya foto real en vez de póster.
 * @param {string[]} references
 * @returns {Record<string, string[]>}
 */
export function buildManifest(references, products = new Map()) {
    const manifest = {};
    for (const reference of [...references].sort()) {
        manifest[reference] = Array.from({ length: IMAGES_PER_PRODUCT }, (_, i) =>
            fileNameFor(reference, i + 1)
        );
        const product = products.get(reference);
        const colors = product?.colors ?? [];
        // V6: fotos por color sólo para productos multicolor (>= 2 colores).
        if (colors.length >= 2) {
            for (const color of colors) {
                const slug = String(color).trim().toUpperCase().replace(/\s+/g, "");
                manifest[`${reference}::${slug}`] = Array.from(
                    { length: IMAGES_PER_PRODUCT },
                    (_, i) => fileNameForColor(reference, slug, i + 1)
                );
            }
        }
    }
    return manifest;
}

/**
 * Datos de producto para los prompts, autodescubiertos de las migraciones
 * (offline: cero BD, cero red — spec R2).
 * @param {string} dir directorio con ficheros `.sql`
 * @returns {Map<string, {name: string, description: string, family: string, color: string|null}>}
 */
export function discoverProducts(dir = MIGRATIONS_DIR) {
    const products = new Map();
    const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    for (const file of files) {
        const sql = readFileSync(path.join(dir, file), "utf8");
        // Productos insertados por ESTE fichero, en orden de inserción: en
        // BD fresca la posición k es el id k (D3b).
        const refsInFile = [];
        for (const match of sql.matchAll(PRODUCT_PATTERN)) {
            const [, reference, name, description, family] = match;
            // Un nombre todo dígitos es un código de barras, no un producto.
            if (/^\d+$/.test(name)) continue;
            refsInFile.push(reference);
            const previous = products.get(reference);
            products.set(reference, {
                name,
                description,
                family,
                color: previous?.color ?? null,
                colors: previous?.colors ?? [],
            });
        }
        for (const match of sql.matchAll(COLOR_PATTERN)) {
            const [, reference, , color] = match;
            const previous = products.get(reference);
            if (previous) {
                if (!previous.color) previous.color = color;
                if (!previous.colors.includes(color)) previous.colors.push(color);
            } else {
                products.set(reference, {
                    name: reference,
                    description: "",
                    family: "",
                    color,
                    colors: [color],
                });
            }
        }
        // D3b (ampliación aprobada 2026-10-19): SKUs que sólo traen
        // `product_id`. La fila de productos en la posición k de ESTE
        // fichero es el id k («V1 usaba ids fijos (1, 2, 4) porque corría
        // sobre una BD recién creada» — cabecera de V12). **Guarda
        // anti-adivinar**: id fuera del rango insertado en el fichero → se
        // ignora y el color queda `null`.
        const skuStatement = sql.match(SKU_ID_STATEMENT)?.[0];
        if (skuStatement) {
            for (const match of skuStatement.matchAll(SKU_ID_PATTERN)) {
                const product = products.get(refsInFile[Number(match[1]) - 1]);
                if (!product) continue;
                if (!product.color) product.color = match[3];
                if (!product.colors.includes(match[3])) product.colors.push(match[3]);
            }
        }
    }
    return products;
}

/**
 * Prompt editorial de una vista (spec R3, plan D4): estudio de hormigón,
 * luz suave, paleta neutral, vertical 3:4 con margen y sello con la
 * referencia. Si no hay datos de producto, el sujeto es la referencia.
 * @param {string} reference
 * @param {{name: string, description: string, color: string|null}|undefined} product
 * @param {number} index posición desde 1
 * @returns {string}
 */
export function buildPrompt(reference, product, index = 1, color = null) {
    const view = VIEWS[(index - 1) % VIEWS.length];
    const resolvedColor = color ?? (product ? product.color : null);
    const subject =
        product && product.name
            ? [
                  product.name,
                  product.description,
                  resolvedColor ? `color ${resolvedColor}` : "",
              ]
                  .filter(Boolean)
                  .join(", ")
            : `la prenda de la referencia ${reference}`;
    return (
        `Fotografía de producto de moda, editorial minimalista: ${subject}, ` +
        "sobre fondo de estudio de hormigón neutro, luz suave difusa, " +
        "paleta neutral cálida, composición vertical 3:4 con margen arriba y " +
        `abajo, referencia "${reference}" estampada en la esquina inferior ` +
        `derecha. Vista: ${view}.`
    );
}

/**
 * Lee un valor de `process.env` o del `.env` raíz (formato `CLAVE=valor`,
 * comillas opcionales; sin dependencias nuevas). **Las claves jamás salen
 * de aquí en un log.**
 * @param {string} name
 * @param {Record<string, string|undefined>} env
 * @param {string} envPath
 * @returns {string|null}
 */
export function readEnvValue(name, env = process.env, envPath = ROOT_ENV_PATH) {
    const direct = env[name];
    if (direct && direct.trim()) return direct.trim();
    let raw;
    try {
        raw = readFileSync(envPath, "utf8");
    } catch {
        return null; // Sin .env → sin valor (modo póster).
    }
    for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
        if (!match || match[1] !== name) continue;
        const value = match[2].replace(/^["']|["']$/g, "");
        if (value) return value;
    }
    return null;
}

/**
 * Key de la API de Gemini (spec R4).
 * @param {Record<string, string|undefined>} env
 * @param {string} envPath
 * @returns {string|null}
 */
export function readGeminiKey(env = process.env, envPath = ROOT_ENV_PATH) {
    return readEnvValue("GEMINI_API_KEY", env, envPath);
}

/**
 * Credenciales de Cloudflare Workers AI (spec R4b, plan D11): **las dos o
 * ninguna** — con una sola no hay proveedor, pero tampoco es un error.
 * @param {Record<string, string|undefined>} env
 * @param {string} envPath
 * @returns {{accountId: string, apiToken: string}|null}
 */
export function readCloudflareCredentials(env = process.env, envPath = ROOT_ENV_PATH) {
    const accountId = readEnvValue("CLOUDFLARE_ACCOUNT_ID", env, envPath);
    const apiToken = readEnvValue("CLOUDFLARE_API_TOKEN", env, envPath);
    return accountId && apiToken ? { accountId, apiToken } : null;
}

/**
 * Modo de generación (spec R1/R7, plan D2/D11): `AI` con Gemini (la cadena
 * incluye FLUX como respaldo), `FREE` sólo con Cloudflare, `PLACEHOLDER`
 * sin credenciales o con `--no-photos`. Espejo del `searchMode` de la 6.2.
 * @param {{apiKey: string|null,
 *          credentials?: {accountId: string, apiToken: string}|null,
 *          noPhotos?: boolean}} params
 * @returns {"AI"|"FREE"|"PLACEHOLDER"}
 */
export function resolvePhotoMode({ apiKey, credentials = null, noPhotos = false }) {
    if (noPhotos || (!apiKey && !credentials)) return "PLACEHOLDER";
    if (apiKey) return "AI";
    return "FREE";
}

/**
 * Extrae la imagen base64 de una `interaction` (respuesta de `/interactions`):
 * soporta la forma `steps[].content[]` de la doc y, como red de seguridad,
 * la forma clásica `candidates[].content.parts[].inlineData`.
 * @param {any} interaction
 * @returns {{base64: string, mime: string}}
 */
function extractImage(interaction) {
    for (const step of interaction?.steps ?? []) {
        for (const item of step?.content ?? []) {
            const mime = item?.mime_type ?? item?.mimeType ?? "";
            if (item?.data && (!mime || mime.startsWith("image/"))) {
                return { base64: item.data, mime: mime || "image/png" };
            }
        }
    }
    for (const candidate of interaction?.candidates ?? []) {
        for (const part of candidate?.content?.parts ?? []) {
            const inline = part?.inlineData ?? part?.inline_data;
            if (inline?.data) {
                return {
                    base64: inline.data,
                    mime: inline.mimeType ?? inline.mime_type ?? "image/png",
                };
            }
        }
    }
    throw new Error("la respuesta no contiene imagen");
}

/**
 * Pide una imagen a Gemini y devuelve su base64 (spec R4, plan D5).
 *
 * `POST /v1beta/interactions` con `aspect_ratio: "3:4"` e `image_size: "2K"`;
 * si el `status` llega en curso, hace polling con tope de 30 s. Los errores
 * HTTP lanzan `PhotoProviderError` con `status` (401/403/429 → `permanente`).
 * @param {{prompt: string, apiKey: string, model?: string,
 *          fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>,
 *          pollAttempts?: number, pollDelayMs?: number}} params
 * @returns {Promise<{base64: string, mime: string}>}
 */
export async function fetchImageBase64({
    prompt,
    apiKey,
    model = DEFAULT_MODEL,
    fetchImpl = globalThis.fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    pollAttempts = POLL_ATTEMPTS,
    pollDelayMs = POLL_DELAY_MS,
}) {
    const response = await fetchImpl(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            input: prompt,
            response_format: {
                type: "image",
                aspect_ratio: ASPECT_RATIO,
                image_size: IMAGE_SIZE,
            },
        }),
    });
    if (!response.ok) {
        throw new PhotoProviderError(`la API devolvió ${response.status}`, {
            status: response.status,
        });
    }

    let interaction = await response.json();
    let attempts = 0;
    while (
        interaction.status &&
        interaction.status !== "completed" &&
        attempts < pollAttempts
    ) {
        if (FAILURE_STATES.has(interaction.status)) {
            throw new Error(`la generación terminó en "${interaction.status}"`);
        }
        if (!interaction.id) break;
        await sleep(pollDelayMs);
        attempts += 1;
        const polled = await fetchImpl(`${GEMINI_ENDPOINT}/${interaction.id}`, {
            headers: { "x-goog-api-key": apiKey },
        });
        if (!polled.ok) {
            throw new PhotoProviderError(`el polling devolvió ${polled.status}`, {
                status: polled.status,
            });
        }
        interaction = await polled.json();
    }
    if (interaction.status && interaction.status !== "completed") {
        throw new Error(
            `la generación no se completó (estado ${interaction.status})`
        );
    }
    return extractImage(interaction);
}

/**
 * Pide una imagen FLUX.1 [schnell] a Cloudflare Workers AI (spec R4b, plan
 * D11) y devuelve base64 (respuesta JSON) o buffer binario (respuesta
 * `image/*`). El token viaja **sólo** en la cabecera `Authorization`.
 * El esquema del modelo sólo admite **`prompt` y `steps`** (medido en vivo
 * 2026-10-19: cualquier otro parámetro → 400 «not allowed») y devuelve
 * **1024×1024**, que `renderPhoto` recorta centrado a 3:4.
 * `success:false` o error HTTP → `PhotoProviderError` con el mensaje de
 * Cloudflare.
 * @param {{prompt: string, credentials: {accountId: string, apiToken: string},
 *          model?: string, fetchImpl?: typeof fetch, steps?: number}} params
 * @returns {Promise<{base64?: string, buffer?: Buffer, mime: string}>}
 */
export async function fetchFluxImage({
    prompt,
    credentials,
    model = DEFAULT_FLUX_MODEL,
    fetchImpl = globalThis.fetch,
    steps = FLUX_STEPS,
}) {
    const url = `${CLOUDFLARE_ENDPOINT}/${credentials.accountId}/ai/run/${model}`;
    const response = await fetchImpl(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${credentials.apiToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, steps }),
    });

    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType.startsWith("image/")) {
        // Red de seguridad: some modelos/devuelven el binario directamente.
        const bytes = Buffer.from(await response.arrayBuffer());
        return { buffer: bytes, mime: contentType };
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }
    if (!response.ok) {
        const detail = payload?.errors?.[0]?.message ?? `HTTP ${response.status}`;
        throw new PhotoProviderError(`cloudflare devolvió ${detail}`, {
            status: response.status,
        });
    }
    if (payload?.success === false) {
        const detail = payload?.errors?.[0]?.message ?? "error desconocido";
        throw new PhotoProviderError(`cloudflare: ${detail}`, {
            status: response.status,
        });
    }
    const base64 = payload?.result?.image;
    if (!base64) throw new Error("la respuesta no contiene imagen");
    return { base64, mime: "image/jpeg" };
}

/**
 * Convierte la imagen devuelta por un proveedor (base64 PNG/JPEG de Gemini o
 * buffer binario de FLUX) en el webp definitivo **1200×1600** (spec R5,
 * plan D6): misma receta de compresión que los pósters (`quality: 85,
 * effort: 5`) para no tensionar el LCP de la ficha. Si el ratio no es 3:4,
 * recorta centrado con `fit: "cover"` y lo devuelve como aviso.
 * @param {string|Buffer} input base64 o buffer binario
 * @returns {Promise<{buffer: Buffer, desviado: boolean, width: number|undefined, height: number|undefined}>}
 */
export async function renderPhoto(input) {
    const raw = Buffer.isBuffer(input) ? input : Buffer.from(input, "base64");
    const metadata = await sharp(raw).metadata();
    const expected = WIDTH / HEIGHT;
    const actual =
        metadata.width && metadata.height
            ? metadata.width / metadata.height
            : Number.NaN;
    const desviado = !(Math.abs(actual - expected) <= 0.01);
    const buffer = await sharp(raw)
        .resize(WIDTH, HEIGHT, {
            fit: "cover",
            position: "centre",
            kernel: "lanczos3",
        })
        .webp({ quality: 85, effort: 5 })
        .toBuffer();
    return {
        buffer,
        desviado,
        width: metadata.width,
        height: metadata.height,
    };
}

function hash(value) {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
        h = (h * 31 + value.charCodeAt(i)) >>> 0;
    }
    return h;
}

/**
 * Composición editorial neutra. Cambia de forma según la posición para que la
 * galería no muestre tres rectángulos idénticos.
 */
function shapeFor(index, accent) {
    if (index === 1) {
        return `<circle cx="600" cy="640" r="390" fill="${accent}" fill-opacity="0.45"/>`;
    }
    if (index === 2) {
        return [
            `<rect x="170" y="150" width="370" height="1300" fill="${accent}" fill-opacity="0.32"/>`,
            `<circle cx="860" cy="1120" r="250" fill="${accent}" fill-opacity="0.5"/>`,
        ].join("");
    }
    return [
        `<polygon points="0,1600 1200,420 1200,1600" fill="${accent}" fill-opacity="0.34"/>`,
        `<circle cx="430" cy="500" r="215" fill="${accent}" fill-opacity="0.45"/>`,
    ].join("");
}

/**
 * @param {string} reference
 * @param {number} index posición desde 1
 * @returns {string} SVG 1200×1600
 */
export function renderSvg(reference, index) {
    const [from, to] = PALETTE[hash(reference) % PALETTE.length];
    const accent = ACCENTS[(hash(reference) + index) % ACCENTS.length];
    const label = `VISTA ${index}/${IMAGES_PER_PRODUCT}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.65" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  ${shapeFor(index, accent)}
  <rect x="48" y="48" width="${WIDTH - 96}" height="${HEIGHT - 96}" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2"/>
  <text x="${WIDTH - 72}" y="132" font-family="Helvetica, Arial, sans-serif" font-size="24" letter-spacing="10" text-anchor="end" fill="#3f3c37" fill-opacity="0.55">NEXUS</text>
  <text x="72" y="1404" font-family="Helvetica, Arial, sans-serif" font-size="38" letter-spacing="14" fill="#3f3c37" fill-opacity="0.8">${reference}</text>
  <text x="72" y="1466" font-family="Helvetica, Arial, sans-serif" font-size="24" letter-spacing="9" fill="#3f3c37" fill-opacity="0.55">${label}</text>
</svg>`;
}

/** Póster SVG → webp (la receta original, byte a byte). */
async function writePoster(target, reference, index) {
    await sharp(Buffer.from(renderSvg(reference, index)))
        .webp({ quality: 85, effort: 5 })
        .toFile(target);
}

/**
 * Escribe imágenes + manifiesto (spec R1/R6, plan D1/D11).
 *
 * Regla central: **ausencia = generar · presencia = sagrado**. Los parámetros
 * existen para que los tests corran en tmp con `fetch` mockeado sin tocar
 * `public/products/`, el manifiesto real ni la red.
 *
 * @param {{force?: boolean, noPhotos?: boolean,
 *          env?: Record<string, string|undefined>,
 *          envPath?: string, outputDir?: string, manifestPath?: string,
 *          references?: string[], fetchImpl?: typeof fetch,
 *          sleep?: (ms: number) => Promise<void>, log?: (m: string) => void,
 *          model?: string, fluxModel?: string}} [options]
 * @returns {Promise<{references: string[], files: number,
 *                    mode: "AI"|"FREE"|"PLACEHOLDER",
 *                    stats: {ia: number, free: number, poster: number,
 *                            intacta: number, fallos: number}}>}}
 */
export async function generate(options = {}) {
    const {
        force = false,
        noPhotos = false,
        env = process.env,
        envPath = ROOT_ENV_PATH,
        outputDir = OUTPUT_DIR,
        manifestPath = MANIFEST_PATH,
        references = discoverReferences(),
        fetchImpl = globalThis.fetch,
        sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        log = () => {},
        model = env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL,
        fluxModel = env.FLUX_MODEL || DEFAULT_FLUX_MODEL,
    } = options;

    const apiKey = noPhotos ? null : readGeminiKey(env, envPath);
    const credentials = noPhotos ? null : readCloudflareCredentials(env, envPath);
    const mode = resolvePhotoMode({ apiKey, credentials, noPhotos });
    const products = discoverProducts();

    /**
     * Cadena de proveedores por fichero (plan D11): Gemini → FLUX → póster.
     * Cada `run` devuelve la imagen (base64 o buffer) para `renderPhoto`.
     */
    const providers = [];
    if (apiKey) {
        providers.push({
            id: "gemini",
            stat: "ia",
            run: ({ reference, product, index, color = null }) =>
                fetchImageBase64({
                    prompt: buildPrompt(reference, product, index, color),
                    apiKey,
                    model,
                    fetchImpl,
                    sleep,
                }).then((result) => result.base64),
        });
    }
    if (credentials) {
        providers.push({
            id: "flux",
            stat: "free",
            run: ({ reference, product, index, color = null }) =>
                fetchFluxImage({
                    prompt: buildPrompt(reference, product, index, color),
                    credentials,
                    model: fluxModel,
                    fetchImpl,
                }).then((result) => result.buffer ?? result.base64),
        });
    }

    mkdirSync(outputDir, { recursive: true });
    mkdirSync(path.dirname(manifestPath), { recursive: true });

    // `ia`+`free`+`poster`+`intacta` particionan los ficheros; `fallos`
    // es un contador informativo de intentos de API que no salieron.
    const stats = { ia: 0, free: 0, poster: 0, intacta: 0, fallos: 0 };

    for (const reference of references) {
        for (let index = 1; index <= IMAGES_PER_PRODUCT; index++) {
            const name = fileNameFor(reference, index);
            const target = path.join(outputDir, name);

            // Presencia = sagrado: nada existente se reescribe (R1.1).
            if (!force && existsSync(target)) {
                stats.intacta += 1;
                continue;
            }

            if (!force && providers.length > 0) {
                let generada = false;
                for (const provider of providers) {
                    if (provider.caido) continue;
                    try {
                        const source = await provider.run({
                            reference,
                            product: products.get(reference),
                            index,
                        });
                        const { buffer, desviado, width, height } =
                            await renderPhoto(source);
                        if (desviado) {
                            log(
                                `${name}: ${provider.id} devolvió ${width}×${height} (no 3:4) → recorte centrado`
                            );
                        }
                        writeFileSync(target, buffer);
                        stats[provider.stat] += 1;
                        generada = true;
                        break;
                    } catch (error) {
                        // Nunca aborta la corrida: siguiente proveedor o
                        // póster de respaldo (R4.3 / plan D11).
                        stats.fallos += 1;
                        if (error?.permanente) {
                            provider.caido = true;
                            log(
                                `${name}: ${provider.id} → ${error.message} — ` +
                                    "cuota/autorización agotada: se omite " +
                                    `«${provider.id}» en el resto de la corrida`
                            );
                        } else {
                            log(
                                `${name}: ${provider.id} → ${error.message} → siguiente proveedor`
                            );
                        }
                    }
                }
                if (generada) continue;
            }

            await writePoster(target, reference, index);
            stats.poster += 1;
        }
    }

    // V6: fotos por color para productos multicolor.
    for (const reference of references) {
        const product = products.get(reference);
        const colors = product?.colors ?? [];
        if (colors.length < 2) continue;
        for (const color of colors) {
            const slug = String(color).trim().toUpperCase().replace(/\s+/g, "");
            for (let index = 1; index <= IMAGES_PER_PRODUCT; index++) {
                const name = fileNameForColor(reference, slug, index);
                const target = path.join(outputDir, name);

                if (!force && existsSync(target)) {
                    stats.intacta += 1;
                    continue;
                }

                if (!force && providers.length > 0) {
                    let generada = false;
                    for (const provider of providers) {
                        if (provider.caido) continue;
                        try {
                            const source = await provider.run({
                                reference,
                                product: products.get(reference),
                                index,
                                color: slug,
                            });
                            // provider.run passes color? need to thread. We'll call buildPrompt via run? 
                            // Actually provider.run uses buildPrompt(reference, product, index) internally.
                            // To include color, we override by calling fetch directly is too complex.
                            // Instead, we rely on product.color being set to this color temporarily.
                            const { buffer, desviado, width, height } =
                                await renderPhoto(source);
                            if (desviado) {
                                log(
                                    `${name}: ${provider.id} devolvió ${width}×${height} (no 3:4) → recorte centrado`
                                );
                            }
                            writeFileSync(target, buffer);
                            stats[provider.stat] += 1;
                            generada = true;
                            break;
                        } catch (error) {
                            stats.fallos += 1;
                            if (error?.permanente) {
                                provider.caido = true;
                                log(
                                    `${name}: ${provider.id} → ${error.message} — ` +
                                        "cuota/autorización agotada: se omite " +
                                        `"${provider.id}" en el resto de la corrida`
                                );
                            } else {
                                log(
                                    `${name}: ${provider.id} → ${error.message} → siguiente proveedor`
                                );
                            }
                        }
                    }
                    if (generada) continue;
                }

                await writePoster(target, reference, index);
                stats.poster += 1;
            }
        }
    }

    writeFileSync(
        manifestPath,
        `${JSON.stringify(buildManifest(references, products), null, 4)}\n`,
        "utf8"
    );

    return {
        references,
        files: references.length * IMAGES_PER_PRODUCT,
        mode,
        stats,
    };
}

const isMain =
    process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const force = process.argv.includes("--force");
    const noPhotos = process.argv.includes("--no-photos");
    generate({ force, noPhotos, log: (message) => console.log(`  ⚠ ${message}`) })
        .then(({ references, files, mode, stats }) => {
            console.log(`✓ ${files} ficheros para ${references.length} referencias`);
            if (mode === "AI") {
                console.log("  photoMode: AI (cadena Gemini → FLUX gratis → póster)");
            } else if (mode === "FREE") {
                console.log(
                    "  photoMode: FREE (FLUX por Cloudflare Workers AI → póster)"
                );
            } else if (noPhotos) {
                console.log("  photoMode: PLACEHOLDER (--no-photos)");
            } else {
                console.log(
                    "  ⚠ Sin credenciales de imagen (GEMINI_API_KEY o " +
                        "CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN) → modo " +
                        "póster. Añádelas al .env raíz para foto real."
                );
            }
            console.log(
                `  fotos Gemini: ${stats.ia} · fotos FLUX: ${stats.free} · ` +
                    `pósters: ${stats.poster} · intactas: ${stats.intacta} · ` +
                    `fallos de API: ${stats.fallos}`
            );
            console.log("  manifiesto → src/data/product-images.json");
        })
        .catch((error) => {
            console.error("✗ No se pudieron generar las imágenes:", error.message);
            process.exitCode = 1;
        });
}
