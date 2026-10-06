import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

// vitest se ejecuta con cwd en frontend/ (ver AGENTS.md: `cd frontend && npx vitest`)
const SRC = resolve(process.cwd(), "src");

/** Todos los ficheros de origen, excluyendo tests y utilidades de test. */
function sourceFiles(): string[] {
    return readdirSync(SRC, { recursive: true })
        .map(String)
        .filter((file) => /\.tsx?$/.test(file))
        .filter((file) => !file.includes("__tests__") && !file.startsWith("test/"))
        .map((file) => join(SRC, file));
}

/**
 * Tarea 3.2, R8 — la etiqueta impositiva es neutral.
 *
 * «IVA» es solo el nombre del impuesto en España y Suiza. En Reino Unido es
 * VAT y en Estados Unidos no hay IVA sino *sales tax*, así que la UI habla de
 * «Impuestos» y deja el porcentaje y el mercado (que sí son correctos) para
 * dar toda la información.
 *
 * Este test es el guardia: si alguien reintroduce «IVA» en el copy, la spec R8
 * queda incumplida aunque las pruebas de componentes sigan en verde.
 */
describe("copy impositivo", () => {
    it("R8 — ninguna cadena de src/ debe contener «IVA»", () => {
        // GIVEN
        const offenders = sourceFiles().filter((file) =>
            readFileSync(file, "utf8").includes("IVA")
        );

        // WHEN / THEN
        expect(offenders).toEqual([]);
    });

    it("R8b — ninguna cadena de src/ fija un importe con «€» hardcodeado", () => {
        // GIVEN — el símbolo fijo sobreviviría al cambio de mercado y dejaría
        // un «50€» debajo de un precio en GBP.
        const offenders = sourceFiles().filter((file) =>
            readFileSync(file, "utf8").includes("€")
        );

        // WHEN / THEN
        expect(offenders).toEqual([]);
    });

    it("R8 — el copy usa «Impuestos» como etiqueta neutra", () => {
        // GIVEN — los tres puntos que muestran el desglose al usuario
        const pages = [
            join(SRC, "app/products/[reference]/page.tsx"),
            join(SRC, "app/receipt/[orderNumber]/page.tsx"),
            join(SRC, "app/cart/page.tsx"),
        ];

        // WHEN / THEN
        for (const page of pages) {
            expect(readFileSync(page, "utf8")).toContain("Impuestos");
        }
    });
});
