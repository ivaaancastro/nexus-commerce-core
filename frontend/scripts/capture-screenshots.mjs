#!/usr/bin/env node
/**
 * Capturas de la landing `/proyecto` (Fase 10, R11).
 *
 * Uso:
 *   npm run shots                 → genera SOLO las capturas que FALTAN
 *   npm run shots -- --force      → regenera todas (¡pisa!)
 *
 * Mismo contrato que `npm run images`: «ausencia = generar, presencia =
 * sagrado». La lista sale de `LANDING_SHOTS` (src/lib/landing.ts), la misma
 * que pinta la página: no hay dos listas que mantener.
 *
 * Variables:
 *   SHOTS_BASE_URL   URL de la tienda (por defecto http://localhost:$PORT, 3000)
 *   SHOTS_USER_EMAIL / SHOTS_USER_PASSWORD     cliente   (por defecto el demo)
 *   SHOTS_ADMIN_EMAIL / SHOTS_ADMIN_PASSWORD   admin     (por defecto el demo)
 *
 * Salida: `public/landing/<fichero>.webp` a 1600×1000 (viewport 1280×800 a
 * escala 1,25) y `public/landing/og.png` 1200×630 (tarjeta de LinkedIn).
 * Ningún workflow de CI lo ejecuta.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "landing");
const FORCE = process.argv.includes("--force");
const BASE = (process.env.SHOTS_BASE_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`).replace(/\/+$/, "");

const CREDENTIALS = {
    user: {
        email: process.env.SHOTS_USER_EMAIL ?? "demo@nexus.dev",
        password: process.env.SHOTS_USER_PASSWORD ?? "Demo1234!",
    },
    admin: {
        email: process.env.SHOTS_ADMIN_EMAIL ?? "admin@nexus.dev",
        password: process.env.SHOTS_ADMIN_PASSWORD ?? "Admin1234!",
    },
};

/** Lee la lista de capturas de `src/lib/landing.ts` sin compilar TypeScript. */
function readShots() {
    const source = readFileSync(path.join(ROOT, "src", "lib", "landing.ts"), "utf8");
    const block = source.slice(source.indexOf("LANDING_SHOTS"));
    const shots = [];
    const re = /file:\s*"([^"]+)",\s*route:\s*"([^"]+)",\s*session:\s*"([^"]+)"/g;
    for (let m; (m = re.exec(block)); ) shots.push({ file: m[1], route: m[2], session: m[3] });
    if (shots.length === 0) throw new Error("No se encontró LANDING_SHOTS en src/lib/landing.ts");
    return shots;
}

/** Ruido fuera de la captura: los avisos de la demo pública. */
const HIDE_DEMO_CSS = 'aside[aria-label="Demo pública"], [role="status"] { display: none !important; }';

async function settle(page) {
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: HIDE_DEMO_CSS });
}

async function login(page, { email, password }) {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("link", { name: "PEDIDOS" }).waitFor();
}

/** La bolsa vacía no enseña nada: se añade el blazer en talla M (la L no tiene stock). */
async function fillBag(page) {
    await page.goto(`${BASE}/products/0432%2F021`);
    await page.getByRole("button", { name: "M", exact: true }).click();
    await page.getByRole("button", { name: "Añadir a la bolsa" }).click();
    await page.waitForLoadState("networkidle");
}

async function capture(page, shot) {
    const target = path.join(OUT, shot.file);
    if (shot.file === "carrito.webp") await fillBag(page);
    await page.goto(`${BASE}${shot.route}`);
    await settle(page);
    const png = await page.screenshot({ type: "png" });
    await sharp(png).resize({ width: 1600 }).webp({ quality: 85 }).toFile(target);
    console.log(`  ✓ ${shot.file}  ←  ${shot.route}`);
}

async function main() {
    mkdirSync(OUT, { recursive: true });
    const shots = readShots();
    const pending = shots.filter((s) => FORCE || !existsSync(path.join(OUT, s.file)));
    const ogPending = FORCE || !existsSync(path.join(OUT, "og.png"));

    console.log(`Capturas contra ${BASE} · ${pending.length}/${shots.length} pendientes${FORCE ? " (--force)" : ""}`);
    for (const s of shots.filter((x) => !pending.includes(x))) console.log(`  · ${s.file} ya existe: no se toca`);

    const browser = await chromium.launch();
    try {
        for (const session of ["none", "user", "admin"]) {
            const group = pending.filter((s) => s.session === session);
            if (group.length === 0) continue;
            const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.25 });
            const page = await context.newPage();
            if (session !== "none") await login(page, CREDENTIALS[session]);
            for (const shot of group) await capture(page, shot);
            await context.close();
        }

        if (ogPending) {
            const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
            const page = await context.newPage();
            await page.goto(`${BASE}/proyecto`);
            await settle(page);
            // En 1200×630 la fila de cifras quedaría cortada por abajo.
            await page.addStyleTag({ content: "main dl { display: none !important; }" });
            await page.screenshot({ path: path.join(OUT, "og.png"), type: "png" });
            console.log("  ✓ og.png  ←  /proyecto");
            await context.close();
        }
    } finally {
        await browser.close();
    }
}

main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
});
