import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
    discoverReferences,
    buildManifest,
    fileNameFor,
    normalizeReference,
    discoverProducts,
    buildPrompt,
    readGeminiKey,
    readCloudflareCredentials,
    resolvePhotoMode,
    fetchImageBase64,
    fetchFluxImage,
    renderPhoto,
    generate,
    IMAGES_PER_PRODUCT,
    PhotoProviderError,
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

// ── Fotos IA: cadena Gemini → FLUX (spec `product-photos`) ────────────────

/** PNG mínimo para que `renderPhoto` y los clientes tengan algo que convertir. */
async function tinyPngBase64(width = 96, height = 128): Promise<string> {
    const buffer = await sharp({
        create: { width, height, channels: 3, background: "#d5cfc5" },
    })
        .png()
        .toBuffer();
    return buffer.toString("base64");
}

describe("discoverProducts (R2)", () => {
    it("lee nombre, descripción y familia de los formatos V1 y V12", () => {
        const products = discoverProducts(MIGRATIONS_DIR);

        expect(products.get("0611/018")).toMatchObject({
            name: "Abrigo Lana Oversize",
            family: "OUTERWEAR",
        });
        expect(products.get("0432/021")).toMatchObject({
            name: "Blazer Cruzada Estructura",
            family: "OUTERWEAR",
        });
        expect(products.get("1240/007")?.name).toBe("Zapatilla Piel Minimal");
        expect(products.size).toBeGreaterThanOrEqual(SEEDED.length);
    });

    it("asocia color por referencia+barras (V12) y por product_id dentro de rango (V1, D3b)", () => {
        const products = discoverProducts(MIGRATIONS_DIR);

        expect(products.get("0611/018")?.color).toBe("Camel");
        // V1 guarda el color por product_id → D3b lo asocia por posición
        // dentro del fichero (ampliación aprobada 2026-10-19; antes: null)
        expect(products.get("0432/021")?.color).toBe("Marino");
    });

    it("una fila de SKU sin referencia no crea un producto", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "nexus-products-"));
        try {
            writeFileSync(
                path.join(dir, "V99__fixture.sql"),
                [
                    "INSERT INTO products (reference_code, name, description, family) VALUES",
                    "    ('0777/111', 'Abrigo de Prueba', 'Abrigo corto de prueba.', 'OUTERWEAR');",
                    // product_id fuera del rango insertado (1 producto) → la guarda D3b lo ignora
                    "INSERT INTO skus (product_id, barcode, color, size) VALUES (5, '843321900101', 'Marino', 'M');",
                    "INSERT INTO audit (created_at) VALUES ('2026-10-05');",
                ].join("\n"),
                "utf8"
            );

            const products = discoverProducts(dir);
            expect(products.size).toBe(1);
            expect(products.get("0777/111")).toEqual({
                name: "Abrigo de Prueba",
                description: "Abrigo corto de prueba.",
                family: "OUTERWEAR",
                color: null,
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("D3b: asocia por posición dentro del rango e ignora ids fuera de él", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "nexus-d3b-"));
        try {
            writeFileSync(
                path.join(dir, "V99__fixture.sql"),
                [
                    "INSERT INTO products (reference_code, name, description, family) VALUES",
                    "    ('0777/111', 'Abrigo de Prueba', 'Abrigo corto de prueba.', 'OUTERWEAR'),",
                    "    ('0888/222', 'Jersey de Prueba', 'Jersey de prueba.', 'KNITWEAR');",
                    "INSERT INTO skus (product_id, barcode, color, size) VALUES",
                    "    (2, '843321900301', 'Crudo', 'L'),", // posición 2 → id 2
                    "    (7, '843321900901', 'Rojo', 'M');", // fuera de rango → se ignora
                ].join("\n"),
                "utf8"
            );

            const products = discoverProducts(dir);
            expect(products.size).toBe(2); // la fila fuera de rango no crea productos
            expect(products.get("0777/111")?.color).toBeNull(); // sólo la posición 2 recibe color
            expect(products.get("0888/222")?.color).toBe("Crudo");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("buildPrompt (R3)", () => {
    const ABRIGO = {
        name: "Abrigo Lana Oversize",
        description: "Abrigo de lana con cuello alto.",
        family: "OUTERWEAR",
        color: "Camel",
    };

    it("las 3 vistas se distinguen y todas llevan la referencia y el 3:4", () => {
        const views = [1, 2, 3].map((index) => buildPrompt("0611/018", ABRIGO, index));

        expect(new Set(views).size).toBe(3);
        for (const prompt of views) {
            expect(prompt).toContain('"0611/018"');
            expect(prompt).toContain("3:4");
        }
        expect(views[0]).toContain("frontal");
        expect(views[1]).toContain("trasera");
        expect(views[2]).toContain("detalle");
    });

    it("incluye nombre, descripción y color cuando existen", () => {
        const prompt = buildPrompt("0611/018", ABRIGO, 1);

        expect(prompt).toContain("Abrigo Lana Oversize");
        expect(prompt).toContain("Abrigo de lana con cuello alto.");
        expect(prompt).toContain("color Camel");
    });

    it("sin color no aparece la cláusula de color (limitación D3)", () => {
        const prompt = buildPrompt("0432/021", { ...ABRIGO, color: null }, 1);

        expect(prompt).not.toContain("color ");
    });

    it("sin datos de producto el sujeto es la propia referencia", () => {
        const prompt = buildPrompt("9999/999", undefined, 1);

        expect(prompt).toContain("la prenda de la referencia 9999/999");
    });
});

describe("readGeminiKey, readCloudflareCredentials y resolvePhotoMode (A.3)", () => {
    it("lee la key de process.env primero y la recorta", () => {
        expect(
            readGeminiKey({ GEMINI_API_KEY: "  env-key  " }, "/no/existe.env")
        ).toBe("env-key");
    });

    it("si no está en env, la lee del .env raíz con comillas opcionales", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "nexus-env-"));
        try {
            const envPath = path.join(dir, ".env");
            writeFileSync(
                envPath,
                ['# comentario', 'OPENAI_API_KEY="otra"', 'GEMINI_API_KEY="file-key"'].join("\n"),
                "utf8"
            );

            expect(readGeminiKey({}, envPath)).toBe("file-key");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("sin env y sin .env → null (modo póster)", () => {
        expect(readGeminiKey({}, path.join(tmpdir(), "nexus-sin-env", ".env"))).toBeNull();
    });

    it("las credenciales Cloudflare salen de env con las dos claves o ninguna", () => {
        expect(
            readCloudflareCredentials(
                { CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: " tok " },
                "/no/existe.env"
            )
        ).toEqual({ accountId: "acc", apiToken: "tok" });
        // Con una sola no hay proveedor, pero tampoco es un error.
        expect(
            readCloudflareCredentials({ CLOUDFLARE_ACCOUNT_ID: "acc" }, "/no/existe.env")
        ).toBeNull();
    });

    it("y si faltan en env, también del .env raíz", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "nexus-env-cf-"));
        try {
            const envPath = path.join(dir, ".env");
            writeFileSync(
                envPath,
                ['CLOUDFLARE_ACCOUNT_ID="cf-acc"', 'CLOUDFLARE_API_TOKEN="cf-tok"'].join("\n"),
                "utf8"
            );

            expect(readCloudflareCredentials({}, envPath)).toEqual({
                accountId: "cf-acc",
                apiToken: "cf-tok",
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("el modo es AI sólo con key, FREE con sólo Cloudflare y PLACEHOLDER sin nada", () => {
        const credentials = { accountId: "a", apiToken: "t" };
        expect(resolvePhotoMode({ apiKey: "k" })).toBe("AI");
        expect(resolvePhotoMode({ apiKey: "k", credentials, noPhotos: true })).toBe("PLACEHOLDER");
        expect(resolvePhotoMode({ apiKey: null })).toBe("PLACEHOLDER");
        expect(resolvePhotoMode({ apiKey: null, credentials })).toBe("FREE");
    });
});

describe("fetchImageBase64 (R4)", () => {
    it("POST con aspect_ratio 3:4, image_size 2K y la cabecera de key", async () => {
        const base64 = await tinyPngBase64();
        const calls: { url: string; init: RequestInit }[] = [];
        const fetchImpl = (async (url: unknown, init: unknown) => {
            calls.push({ url: String(url), init: init as RequestInit });
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    id: "i1",
                    status: "completed",
                    steps: [{ content: [{ type: "image", data: base64, mime_type: "image/png" }] }],
                }),
            };
        }) as unknown as typeof fetch;

        const result = await fetchImageBase64({
            prompt: "hola",
            apiKey: "secret",
            fetchImpl,
            sleep: async () => {},
        });

        expect(result.base64).toBe(base64);
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toContain("/v1beta/interactions");
        expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret");
        const body = JSON.parse(String(calls[0].init.body));
        expect(body.response_format).toEqual({
            type: "image",
            aspect_ratio: "3:4",
            image_size: "2K",
        });
        expect(body.model).toBe("gemini-3.1-flash-image");
    });

    it("si el estado llega en curso, hace polling hasta completarse", async () => {
        const base64 = await tinyPngBase64();
        let calls = 0;
        const fetchImpl = (async () => {
            calls += 1;
            if (calls === 1) {
                return { ok: true, status: 200, json: async () => ({ id: "i1", status: "in_progress" }) };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    id: "i1",
                    status: "completed",
                    steps: [{ content: [{ type: "image", data: base64, mime_type: "image/png" }] }],
                }),
            };
        }) as unknown as typeof fetch;
        const sleep = vi.fn(async () => {});

        const result = await fetchImageBase64({
            prompt: "hola",
            apiKey: "k",
            fetchImpl,
            sleep,
            pollAttempts: 3,
            pollDelayMs: 1,
        });

        expect(result.base64).toBe(base64);
        expect(calls).toBe(2);
        expect(sleep).toHaveBeenCalledTimes(1);
    });

    it("un error HTTP lanza (el respaldo lo decide generate)", async () => {
        const fetchImpl = (async () => ({
            ok: false,
            status: 500,
            json: async () => ({}),
        })) as unknown as typeof fetch;

        await expect(
            fetchImageBase64({ prompt: "x", apiKey: "k", fetchImpl })
        ).rejects.toThrow("500");
    });

    it("estado failed lanza sin reintentar para siempre", async () => {
        const fetchImpl = (async () => ({
            ok: true,
            status: 200,
            json: async () => ({ id: "i1", status: "failed" }),
        })) as unknown as typeof fetch;

        await expect(
            fetchImageBase64({ prompt: "x", apiKey: "k", fetchImpl, sleep: async () => {} })
        ).rejects.toThrow("failed");
    });

    it("un 403 lanza PhotoProviderError marcado como permanente (D11)", async () => {
        const fetchImpl = (async () => ({
            ok: false,
            status: 403,
            json: async () => ({}),
        })) as unknown as typeof fetch;

        const error = await fetchImageBase64({
            prompt: "x",
            apiKey: "k",
            fetchImpl,
        }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(PhotoProviderError);
        expect((error as PhotoProviderError).permanente).toBe(true);
        expect((error as PhotoProviderError).status).toBe(403);
    });
});

describe("fetchFluxImage (R4b)", () => {
    it("POST a Cloudflare con Bearer, prompt y 4 pasos", async () => {
        const base64 = await tinyPngBase64();
        const calls: { url: string; init: RequestInit }[] = [];
        const fetchImpl = (async (url: unknown, init: unknown) => {
            calls.push({ url: String(url), init: init as RequestInit });
            return {
                ok: true,
                status: 200,
                headers: { get: () => "application/json" },
                json: async () => ({ success: true, result: { image: base64 } }),
            };
        }) as unknown as typeof fetch;

        const result = await fetchFluxImage({
            prompt: "hola",
            credentials: { accountId: "ACC123", apiToken: "secret" },
            fetchImpl,
        });

        expect(result.base64).toBe(base64);
        expect(calls[0].url).toBe(
            "https://api.cloudflare.com/client/v4/accounts/ACC123/ai/run/@cf/black-forest-labs/flux-1-schnell"
        );
        expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
            "Bearer secret"
        );
        expect(JSON.parse(String(calls[0].init.body))).toEqual({ prompt: "hola", steps: 4 });
    });

    it("success:false lanza con el mensaje de Cloudflare", async () => {
        const fetchImpl = (async () => ({
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ success: false, errors: [{ message: "neurons exhausted" }] }),
        })) as unknown as typeof fetch;

        await expect(
            fetchFluxImage({
                prompt: "x",
                credentials: { accountId: "a", apiToken: "t" },
                fetchImpl,
            })
        ).rejects.toThrow("neurons exhausted");
    });

    it("un 429 lanza un error marcado como permanente", async () => {
        const fetchImpl = (async () => ({
            ok: false,
            status: 429,
            headers: { get: () => "application/json" },
            json: async () => ({ errors: [{ message: "quota" }] }),
        })) as unknown as typeof fetch;

        const error = await fetchFluxImage({
            prompt: "x",
            credentials: { accountId: "a", apiToken: "t" },
            fetchImpl,
        }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(PhotoProviderError);
        expect((error as PhotoProviderError).permanente).toBe(true);
        expect((error as Error).message).toContain("quota");
    });

    it("acepta también respuesta binaria image/*", async () => {
        const png = Buffer.from(await tinyPngBase64(), "base64");
        const fetchImpl = (async () => ({
            ok: true,
            status: 200,
            headers: { get: () => "image/jpeg" },
            arrayBuffer: async () => new Uint8Array(png).buffer,
        })) as unknown as typeof fetch;

        const result = await fetchFluxImage({
            prompt: "x",
            credentials: { accountId: "a", apiToken: "t" },
            fetchImpl,
        });

        expect(result.buffer).toBeInstanceOf(Buffer);
    });
});

describe("renderPhoto (R5)", () => {
    it("normaliza a webp 1200×1600 con la receta de siempre (q85)", async () => {
        const png = await tinyPngBase64(120, 160);

        const { buffer, desviado } = await renderPhoto(png);
        const metadata = await sharp(buffer).metadata();

        expect(metadata.format).toBe("webp");
        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(1600);
        expect(desviado).toBe(false);
    });

    it("un ratio ajeno a 3:4 queda recortado en centro y marcado como desviado", async () => {
        const png = await tinyPngBase64(424, 719);

        const { buffer, desviado } = await renderPhoto(png);
        const metadata = await sharp(buffer).metadata();

        expect(desviado).toBe(true);
        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(1600);
    });

    it("acepta también un buffer binario (respuesta FLUX)", async () => {
        const png = await sharp({
            create: { width: 96, height: 128, channels: 3, background: "#d5cfc5" },
        })
            .png()
            .toBuffer();

        const { buffer, desviado } = await renderPhoto(png);
        const metadata = await sharp(buffer).metadata();

        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(1600);
        expect(desviado).toBe(false);
    });
});

describe("generate() (R1/R4/R4b/R6)", () => {
    let dir: string;
    let outputDir: string;
    let manifestPath: string;
    /** Path inexistente: la key real del `.env` raíz jamás entra en los tests. */
    let envPath: string;

    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), "nexus-images-"));
        outputDir = path.join(dir, "products");
        manifestPath = path.join(dir, "manifest.json");
        envPath = path.join(dir, ".env.vacio");
        mkdirSync(outputDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it("R1 — los 3 ficheros existentes quedan intactos y la API no se llama ni una vez", async () => {
        for (const index of [1, 2, 3]) {
            writeFileSync(path.join(outputDir, `9999-999-${index}.webp`), `centinela-${index}`);
        }
        const fetchImpl = vi.fn();

        const result = await generate({
            references: ["9999/999"],
            outputDir,
            manifestPath,
            env: { GEMINI_API_KEY: "key" },
            envPath,
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleep: async () => {},
            log: () => {},
        });

        expect(readFileSync(path.join(outputDir, "9999-999-2.webp"), "utf8")).toBe(
            "centinela-2"
        );
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(result.stats).toEqual({ ia: 0, free: 0, poster: 0, intacta: 3, fallos: 0 });
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        expect(manifest["9999/999"]).toEqual([
            "9999-999-1.webp",
            "9999-999-2.webp",
            "9999-999-3.webp",
        ]);
    });

    it("R4/R6 — sin ficheros y con key genera 3 fotos IA de 1200×1600", async () => {
        const base64 = await tinyPngBase64();
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                status: "completed",
                steps: [{ content: [{ type: "image", data: base64, mime_type: "image/png" }] }],
            }),
        }));

        const result = await generate({
            references: ["8888/888"],
            outputDir,
            manifestPath,
            env: { GEMINI_API_KEY: "k" },
            envPath,
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleep: async () => {},
            log: () => {},
        });

        expect(result.mode).toBe("AI");
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(result.stats).toEqual({ ia: 3, free: 0, poster: 0, intacta: 0, fallos: 0 });
        const metadata = await sharp(
            readFileSync(path.join(outputDir, "8888-888-1.webp"))
        ).metadata();
        expect(metadata.format).toBe("webp");
        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(1600);
    });

    it("R4 — si la API falla: aviso, póster de respaldo y sigue con la siguiente", async () => {
        const logs: string[] = [];
        const fetchImpl = vi.fn(async () => {
            throw new Error("red caída");
        });

        const result = await generate({
            references: ["7777/777"],
            outputDir,
            manifestPath,
            env: { GEMINI_API_KEY: "k" },
            envPath,
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleep: async () => {},
            log: (message: string) => logs.push(message),
        });

        expect(result.stats).toEqual({ ia: 0, free: 0, poster: 3, intacta: 0, fallos: 3 });
        expect(logs).toHaveLength(3);
        expect(logs[0]).toContain("gemini");
        expect(logs[0]).toContain("siguiente proveedor");
        for (const index of [1, 2, 3]) {
            expect(existsSync(path.join(outputDir, `7777-777-${index}.webp`))).toBe(true);
        }
    });

    it("R4b/D11 — un 429 de Gemini desactiva al proveedor y FLUX genera las 3", async () => {
        const base64 = await tinyPngBase64();
        let geminiCalls = 0;
        let fluxCalls = 0;
        const fetchImpl = (async (url: unknown) => {
            const target = String(url);
            if (target.includes("generativelanguage")) {
                geminiCalls += 1;
                return { ok: false, status: 429, json: async () => ({}) };
            }
            fluxCalls += 1;
            return {
                ok: true,
                status: 200,
                headers: { get: () => "application/json" },
                json: async () => ({ success: true, result: { image: base64 } }),
            };
        }) as unknown as typeof fetch;
        const logs: string[] = [];

        const result = await generate({
            references: ["3333/333"],
            outputDir,
            manifestPath,
            env: {
                GEMINI_API_KEY: "k",
                CLOUDFLARE_ACCOUNT_ID: "acc",
                CLOUDFLARE_API_TOKEN: "tok",
            },
            envPath,
            fetchImpl,
            sleep: async () => {},
            log: (message: string) => logs.push(message),
        });

        // El 429 es permanente: sólo un intento de Gemini para toda la corrida.
        expect(geminiCalls).toBe(1);
        expect(fluxCalls).toBe(3);
        expect(result.stats).toEqual({ ia: 0, free: 3, poster: 0, intacta: 0, fallos: 1 });
        expect(logs.some((l) => l.includes("se omite «gemini»"))).toBe(true);
        const metadata = await sharp(
            readFileSync(path.join(outputDir, "3333-333-1.webp"))
        ).metadata();
        expect(metadata.format).toBe("webp");
        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(1600);
    });

    it("R4b — modo FREE: sin key de Gemini sólo FLUX genera", async () => {
        const base64 = await tinyPngBase64();
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ success: true, result: { image: base64 } }),
        }));

        const result = await generate({
            references: ["2222/222"],
            outputDir,
            manifestPath,
            env: { CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "tok" },
            envPath,
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleep: async () => {},
            log: () => {},
        });

        expect(result.mode).toBe("FREE");
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(result.stats).toEqual({ ia: 0, free: 3, poster: 0, intacta: 0, fallos: 0 });
    });

    it("R4b — si todo falla: pósters de respaldo y la corrida resuelve sin excepción", async () => {
        const fetchImpl = (async (url: unknown) => {
            const target = String(url);
            if (target.includes("generativelanguage")) {
                return { ok: false, status: 429, json: async () => ({}) };
            }
            return {
                ok: false,
                status: 503,
                headers: { get: () => "application/json" },
                json: async () => ({ errors: [{ message: "caído" }] }),
            };
        }) as unknown as typeof fetch;

        const result = await generate({
            references: ["1111/111"],
            outputDir,
            manifestPath,
            env: {
                GEMINI_API_KEY: "k",
                CLOUDFLARE_ACCOUNT_ID: "acc",
                CLOUDFLARE_API_TOKEN: "tok",
            },
            envPath,
            fetchImpl,
            sleep: async () => {},
            log: () => {},
        });

        // Gemini 429 → 1 intento (desactivado); FLUX 503 → 1 por fichero.
        expect(result.stats).toEqual({ ia: 0, free: 0, poster: 3, intacta: 0, fallos: 4 });
        for (const index of [1, 2, 3]) {
            expect(existsSync(path.join(outputDir, `1111-111-${index}.webp`))).toBe(true);
        }
    });

    it("R7 — sin credenciales el modo es PLACEHOLDER y sale todo de póster sin red", async () => {
        const fetchImpl = vi.fn();

        const result = await generate({
            references: ["6666/666"],
            outputDir,
            manifestPath,
            env: {},
            envPath,
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleep: async () => {},
            log: () => {},
        });

        expect(result.mode).toBe("PLACEHOLDER");
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(result.stats).toEqual({ ia: 0, free: 0, poster: 3, intacta: 0, fallos: 0 });
    });

    it("--force regenera los pósters pisando lo que haya", async () => {
        writeFileSync(path.join(outputDir, "5555-555-1.webp"), "centinela");
        const fetchImpl = vi.fn();

        const result = await generate({
            references: ["5555/555"],
            outputDir,
            manifestPath,
            force: true,
            noPhotos: true,
            env: { GEMINI_API_KEY: "k" },
            envPath,
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleep: async () => {},
            log: () => {},
        });

        expect(
            readFileSync(path.join(outputDir, "5555-555-1.webp"), "utf8")
        ).not.toBe("centinela");
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(result.stats).toEqual({ ia: 0, free: 0, poster: 3, intacta: 0, fallos: 0 });
    });

    it("--no-photos nunca llama a la API aunque haya key", async () => {
        const fetchImpl = vi.fn();

        const result = await generate({
            references: ["4444/444"],
            outputDir,
            manifestPath,
            noPhotos: true,
            env: { GEMINI_API_KEY: "k" },
            envPath,
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleep: async () => {},
            log: () => {},
        });

        expect(result.mode).toBe("PLACEHOLDER");
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(result.stats.poster).toBe(3);
    });
});
