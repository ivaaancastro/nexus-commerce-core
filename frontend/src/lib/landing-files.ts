import { existsSync } from "node:fs";
import path from "node:path";

/**
 * ¿Existe la captura en `public/landing/`? Solo en servidor (la página es
 * estática: se evalúa en el build). Aislado en su módulo para poder simularlo
 * en los tests sin tocar `node:fs`.
 */
export function landingShotExists(file: string): boolean {
    return existsSync(path.join(process.cwd(), "public", "landing", file));
}
