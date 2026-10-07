import rawManifest from "@/data/product-images.json";

/**
 * `reference_code → [nombre de fichero, …]`.
 *
 * <p>Generado por `npm run images` a partir de las migraciones de Flyway; no se
 * mantiene a mano. Se importa <b>estáticamente</b> para no hacer ningún
 * `fetch`: así nunca se pide un fichero que no existe (R2).</p>
 */
const manifest: Record<string, string[]> = rawManifest;

/**
 * Rutas absolutas de las imágenes de un producto.
 *
 * @param referenceCode referencia tal cual está en BD (`0432/021`)
 * @returns p. ej. `["/products/0432-021-1.webp", …]`. **Vacío** si la
 * referencia no está en el manifiesto — nunca lanza.
 */
export function getProductImages(referenceCode: string): string[] {
    const files = manifest[referenceCode];
    if (!files || files.length === 0) {
        return [];
    }
    return files.map((file) => `/products/${file}`);
}

/**
 * Texto alternativo de una imagen de la galería (R8).
 *
 * <p>La vista 1 es la imagen principal: con el nombre basta. Las demás
 * aportan información nueva, así que se numeran.</p>
 *
 * @param name nombre del producto
 * @param index posición desde 0
 */
export function imageAlt(name: string, index: number): string {
    return index === 0 ? name : `${name} — detalle ${index + 1}`;
}
