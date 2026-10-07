#!/usr/bin/env node
/**
 * Genera las imágenes del catálogo y su manifiesto (Tarea 3.3, R1–R3).
 *
 * Uso:  npm run images
 *
 * Qué hace:
 *   1. Autodescubre las referencias de producto con el patrón '[0-9]{4}/[0-9]{3}'
 *      en `backend/src/main/resources/db/migration/*.sql` → no hay ninguna lista
 *      que mantener a mano: al sembrar un producto basta con re-ejecutar.
 *   2. Escribe 3 imágenes WebP 1200×1600 por producto en `public/products/`,
 *      con nombre `{ref normalizado}-{n}.webp` (la '/' no puede ir en un fichero).
 *   3. Escribe `src/data/product-images.json`, el manifiesto que el frontend
 *      importa estáticamente para no pedir ficheros que no existen.
 *
 * Es idempotente: dos ejecuciones producen el mismo árbol y el mismo manifiesto.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

export const IMAGES_PER_PRODUCT = 3;
const WIDTH = 1200;
const HEIGHT = 1600;

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

/**
 * Manifiesto `reference → [fichero, …]`, listo para serializarse.
 * @param {string[]} references
 * @returns {Record<string, string[]>}
 */
export function buildManifest(references) {
    const manifest = {};
    for (const reference of [...references].sort()) {
        manifest[reference] = Array.from({ length: IMAGES_PER_PRODUCT }, (_, i) =>
            fileNameFor(reference, i + 1)
        );
    }
    return manifest;
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

/**
 * Escribe imágenes + manifiesto.
 * @returns {Promise<{references: string[], files: string[]}>}
 */
export async function generate() {
    const references = discoverReferences();
    mkdirSync(OUTPUT_DIR, { recursive: true });
    mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });

    const files = [];
    for (const reference of references) {
        for (let index = 1; index <= IMAGES_PER_PRODUCT; index++) {
            const target = path.join(OUTPUT_DIR, fileNameFor(reference, index));
            await sharp(Buffer.from(renderSvg(reference, index)))
                .webp({ quality: 85, effort: 5 })
                .toFile(target);
            files.push(fileNameFor(reference, index));
        }
    }

    writeFileSync(
        MANIFEST_PATH,
        `${JSON.stringify(buildManifest(references), null, 4)}\n`,
        "utf8"
    );

    return { references, files };
}

const isMain =
    process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    generate()
        .then(({ references, files }) => {
            console.log(`✓ ${files.length} imágenes en public/products/`);
            console.log(`  ${references.length} referencias: ${references.join(", ")}`);
            console.log("  manifiesto → src/data/product-images.json");
        })
        .catch((error) => {
            console.error("✗ No se pudieron generar las imágenes:", error.message);
            process.exitCode = 1;
        });
}
