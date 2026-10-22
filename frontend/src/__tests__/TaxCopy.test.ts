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

    it("R8 — el copy neutral vive en un único módulo y lo usan todas las superficies", () => {
        // GIVEN — desde `final-price-display` la nota se escribe una sola vez
        const copy = readFileSync(join(SRC, "lib/taxes.ts"), "utf8");
        expect(copy).toContain("Impuestos incluidos");

        // WHEN / THEN — PDP, carrito, drawer y ficha del pedido la importan.
        // El drawer va en el carrito vía `useCart`, y la factura (`/receipt`)
        // conserva su desglose con la etiqueta literal, comprobada abajo.
        const surfaces = [
            join(SRC, "app/products/[reference]/page.tsx"),
            join(SRC, "app/cart/page.tsx"),
            join(SRC, "components/CartDrawer.tsx"),
            join(SRC, "app/orders/[orderNumber]/page.tsx"),
        ];
        for (const file of surfaces) {
            expect(readFileSync(file, "utf8")).toContain('from "@/lib/taxes"');
        }

        // La factura sigue desglosando con la misma etiqueta neutra
        expect(
            readFileSync(join(SRC, "app/receipt/[orderNumber]/page.tsx"), "utf8")
        ).toContain("Impuestos");
    });
});
