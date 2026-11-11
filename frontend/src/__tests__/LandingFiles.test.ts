import { describe, it, expect } from "vitest";
import { landingShotExists } from "@/lib/landing-files";

describe("Fase 10 · landingShotExists (R10)", () => {
    it("lee public/landing/ relativo al proyecto: un fichero inventado no existe", () => {
        expect(landingShotExists("no-existe-jamas.webp")).toBe(false);
    });
});
