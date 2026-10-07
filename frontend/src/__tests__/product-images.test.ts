import { describe, it, expect } from "vitest";
import { getProductImages, imageAlt } from "@/lib/product-images";

/**
 * R1 y R2 de specs/gallery-responsive: la ruta de una imagen se deduce de la
 * referencia del producto y el manifiesto se lee sin hacer ningún `fetch`.
 */
describe("getProductImages", () => {
    it("R1 — devuelve las 3 rutas de una referencia real", () => {
        const images = getProductImages("0432/021");

        expect(images).toHaveLength(3);
        expect(images[0]).toBe("/products/0432-021-1.webp");
        expect(images[2]).toBe("/products/0432-021-3.webp");
        expect(images.every((src) => src.startsWith("/products/"))).toBe(true);
    });

    it("R1 — normaliza la referencia: la '/' no puede ir en un nombre de fichero", () => {
        const images = getProductImages("0611/018");

        expect(images[0]).toBe("/products/0611-018-1.webp");
        // Segmento intermedio de la ruta: no queda ningún "0611/018"
        expect(images[0].split("/")).not.toContain("0611/018");
        expect(images[0]).not.toContain("0611/018");
    });

    it("R2 — referencia desconocida devuelve [] y no lanza", () => {
        expect(getProductImages("9999/999")).toEqual([]);
        expect(getProductImages("")).toEqual([]);
        expect(getProductImages("0000/000")).toEqual([]);
    });

    it("R2 — cubre las 4 referencias sembradas en el catálogo", () => {
        for (const reference of ["0432/021", "0611/018", "0815/004", "1240/007"]) {
            expect(getProductImages(reference)).toHaveLength(3);
        }
    });
});

describe("imageAlt (R8)", () => {
    it("la vista 1 es la imagen principal: con el nombre basta", () => {
        expect(imageAlt("Blazer Cruzada Estructura", 0)).toBe(
            "Blazer Cruzada Estructura"
        );
    });

    it("las vistas siguientes se numeran porque aportan información nueva", () => {
        expect(imageAlt("Blazer Cruzada Estructura", 1)).toBe(
            "Blazer Cruzada Estructura — detalle 2"
        );
        expect(imageAlt("Blazer Cruzada Estructura", 2)).toBe(
            "Blazer Cruzada Estructura — detalle 3"
        );
    });
});
