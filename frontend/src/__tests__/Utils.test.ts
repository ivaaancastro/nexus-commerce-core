import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

/**
 * Tarea 4.1, R1 — `cn()`, el combinador de clases del frontend.
 *
 * Es una línea de código y está en la base de casi todo el estilo: si `twMerge`
 * dejara de resolver conflictos, aparecerían clases contradictorias
 * (`px-2 px-4`) que se resolverían por orden de aparición en el CSS, es decir,
 * de forma imprevisible.
 */
describe("cn", () => {
    it("une las clases que se le pasan", () => {
        expect(cn("text-sm", "uppercase")).toBe("text-sm uppercase");
    });

    it("resuelve los conflictos de Tailwind quedándose con la última", () => {
        expect(cn("px-2", "px-4")).toBe("px-4");
        expect(cn("text-sm", "px-2", "px-4")).toBe("text-sm px-4");
    });

    it("conserva las clases que no entran en conflicto", () => {
        expect(cn("p-4", "m-2")).toBe("p-4 m-2");
    });

    it("descarta los valores falsy", () => {
        expect(cn("a", false && "b", undefined, null, "")).toBe("a");
    });

    it("sin argumentos devuelve cadena vacía", () => {
        expect(cn()).toBe("");
    });
});
