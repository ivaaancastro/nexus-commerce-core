import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
    discoverReferences,
    buildManifest,
    fileNameFor,
    normalizeReference,
    IMAGES_PER_PRODUCT,
} from "../../scripts/generate-product-images.mjs";

/** Raíz del monorepo (vitest corre con cwd en `frontend/`). */
const REPO_ROOT = path.resolve(process.cwd(), "..");
const MIGRATIONS_DIR = path.join(
    REPO_ROOT,
    "backend/src/main/resources/db/migration"
);

/** Los 4 productos sembrados por `V1` y `V12`. */
const SEEDED = ["0432/021", "0611/018", "0815/004", "1240/007"];

describe("generate-product-images (R3)", () => {
    it("autodescubre las referencias reales de las migraciones", () => {
        const references = discoverReferences(MIGRATIONS_DIR);

        expect(references).toEqual(expect.arrayContaining(SEEDED));
        // Sólo formas de referencia: ni fechas, ni códigos de barras
        for (const reference of references) {
            expect(reference).toMatch(/^\d{4}\/\d{3}$/);
        }
    });

    it("es idempotente: dos descubrimientos seguidos dan lo mismo", () => {
        expect(discoverReferences(MIGRATIONS_DIR)).toEqual(
            discoverReferences(MIGRATIONS_DIR)
        );
        expect(buildManifest(SEEDED)).toEqual(buildManifest(SEEDED));
    });

    it("no confunde códigos de barras ni fechas con referencias", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "nexus-refs-"));
        try {
            writeFileSync(
                path.join(dir, "V1__fixture.sql"),
                [
                    "INSERT INTO skus (barcode, color, created_at) VALUES",
                    "('843321900201', 'Camel', '2026-10-05');",
                    "INSERT INTO products (reference_code) VALUES ('0777/111');",
                ].join("\n"),
                "utf8"
            );

            expect(discoverReferences(dir)).toEqual(["0777/111"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("normaliza la referencia y numerada desde 1", () => {
        expect(normalizeReference("0432/021")).toBe("0432-021");
        expect(fileNameFor("0432/021", 1)).toBe("0432-021-1.webp");
        expect(fileNameFor("0432/021", IMAGES_PER_PRODUCT)).toBe("0432-021-3.webp");
    });

    it("el manifiesto mapea cada referencia a sus 3 ficheros, ordenado", () => {
        const manifest = buildManifest([...SEEDED].reverse());

        expect(Object.keys(manifest)).toEqual(SEEDED);
        for (const reference of SEEDED) {
            expect(manifest[reference]).toHaveLength(IMAGES_PER_PRODUCT);
            expect(manifest[reference][0]).toBe(`${normalizeReference(reference)}-1.webp`);
        }
    });
});
