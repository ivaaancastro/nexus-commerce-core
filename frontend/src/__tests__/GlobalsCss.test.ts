import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// vitest se ejecuta con cwd en frontend/ (ver AGENTS.md: `cd frontend && npx vitest`)
const globalsCss = resolve(process.cwd(), "src/app/globals.css");

/** Lee el CSS sin comentarios, para que no confundan las aserciones. */
function readCss(): string {
    return readFileSync(globalsCss, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * La app es editorial y clara por diseño: los fondos están hardcodeados en
 * neutral-50 / white en cada página.
 *
 * Si se reintroduce un bloque `prefers-color-scheme: dark`, --foreground pasa
 * a #ededed y TODO elemento sin color propio queda invisible sobre esos fondos
 * claros (logo del header, enlaces sin clase de color...). Este test es el
 * guardia que lo impide.
 */
describe("globals.css", () => {
    it("no debe declarar modo oscuro: la paleta clara es fija", () => {
        // GIVEN
        const css = readCss();

        // WHEN / THEN
        expect(css).not.toMatch(/prefers-color-scheme\s*:\s*dark/);
    });

    it("debe definir un foreground oscuro", () => {
        // GIVEN
        const css = readCss();

        // WHEN
        const match = css.match(/--foreground:\s*(#[0-9a-fA-F]{3,6})/);

        // THEN
        expect(match).not.toBeNull();

        const hex = match![1].slice(1);
        const rgb = hex.length === 3
            ? hex.split("").map((c) => parseInt(c + c, 16))
            : [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
        const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

        expect(luminance).toBeLessThan(80);
    });
});
