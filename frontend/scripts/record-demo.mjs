#!/usr/bin/env node
/**
 * Grabación del vídeo de demo (Fase 13, R2).
 *
 * Uso:
 *   npm run record-demo
 *
 * Recorre la tienda desplegada como lo haría un visitante: login → catálogo →
 * ficha → bolsa → pago → pedido confirmado → panel admin → dashboard. Graba un
 * `.webm` (Playwright) que luego se recodifica con ffmpeg (ver spec fase13).
 *
 * Variables:
 *   DEMO_BASE_URL     tienda (por defecto la de producción)
 *   DEMO_OUT_DIR      carpeta de salida del .webm (por defecto ./demo-video)
 *   STRIPE_SECRET_KEY clave **de test** (sk_test_…) o la de `backend/.env`
 *
 * **Sobre el pago**: Stripe lanza hCaptcha a los navegadores automatizados y
 * bloquea el «Pagar» tecleado. El script teclea la tarjeta de prueba en el
 * Payment Element (para que se vea) y la confirmación **real** del PaymentIntent
 * se hace por API con `pm_card_visa`, igual que `e2e/payments.spec.ts`. El
 * webhook firmado de Stripe confirma el pedido, como en un pago normal.
 * La clave nunca se imprime ni se guarda; sólo viaja a `api.stripe.com`.
 *
 * Las pausas (`beat`) son ritmo de grabación, no sincronización: toda espera
 * de estado usa condiciones de Playwright.
 */
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.DEMO_BASE_URL ?? "https://nexus-commerce-core.vercel.app").replace(/\/+$/, "");
const OUT = path.resolve(process.env.DEMO_OUT_DIR ?? path.join(ROOT, "demo-video"));
const USER = { email: "demo@nexus.dev", password: "Demo1234!" };
const ADMIN = { email: "admin@nexus.dev", password: "Admin1234!" };
const WAKE_TIMEOUT = 120_000; // el backend gratuito tarda ~50 s en despertar
const CONFIRM_TIMEOUT = 60_000;

const beat = (page, ms = 900) => page.waitForTimeout(ms);

function stripeSecretKey() {
    let key = process.env.STRIPE_SECRET_KEY;
    const envFile = path.resolve(ROOT, "../backend/.env");
    if (!key && existsSync(envFile)) key = readFileSync(envFile, "utf8").match(/^STRIPE_SECRET_KEY=(.+)$/m)?.[1]?.trim();
    if (!key?.startsWith("sk_test_")) throw new Error("Hace falta una STRIPE_SECRET_KEY de test (sk_test_…).");
    return key;
}

/** Punto que sigue al ratón: el vídeo de Playwright no dibuja el cursor. */
const CURSOR_SCRIPT = `
(() => {
  const dot = document.createElement("div");
  Object.assign(dot.style, {
    position: "fixed", zIndex: 2147483647, width: "18px", height: "18px", borderRadius: "50%",
    background: "rgba(23,23,23,.45)", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.4)",
    pointerEvents: "none", transform: "translate(-50%,-50%)", transition: "left .25s ease, top .25s ease",
    left: "-50px", top: "-50px",
  });
  addEventListener("DOMContentLoaded", () => document.documentElement.appendChild(dot));
  addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; }, true);
})();`;

async function api(page, route, init) {
    return page.evaluate(
        async ([url, opts]) => (await fetch(url, opts)).json(),
        [`${BASE}/api/v1${route}`, init]
    );
}

async function login(page, { email, password }) {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").pressSequentially(email, { delay: 45 });
    await page.getByLabel("Contraseña").pressSequentially(password, { delay: 45 });
    await beat(page, 500);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("link", { name: "PEDIDOS" })).toBeVisible({ timeout: WAKE_TIMEOUT });
}

async function confirmWithStripe(orderNumber, token, secret) {
    const res = await fetch(`${BASE}/api/v1/orders/${orderNumber}/payment`, { headers: { Authorization: `Bearer ${token}` } });
    const { clientSecret } = await res.json();
    const id = clientSecret.split("_secret_")[0];
    const r = await fetch(`https://api.stripe.com/v1/payment_intents/${id}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ payment_method: "pm_card_visa" }),
    });
    if (!r.ok) throw new Error(`Stripe respondió ${r.status} al confirmar el PaymentIntent`);
}

async function main() {
    const secret = stripeSecretKey();
    mkdirSync(OUT, { recursive: true });

    // Despierta el backend ANTES de grabar: el vídeo no enseña esperas de 50 s.
    console.log("Despertando el backend…");
    const deadline = Date.now() + WAKE_TIMEOUT;
    for (;;) {
        const ok = await fetch(`${BASE}/api/v1/markets`, { signal: AbortSignal.timeout(30_000) }).then((r) => r.ok, () => false);
        if (ok) break;
        if (Date.now() > deadline) throw new Error("El backend no despertó a tiempo");
    }

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
        locale: "es-ES",
    });
    await context.addInitScript(CURSOR_SCRIPT);
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    try {
        // 1 · Landing y login
        await page.goto(`${BASE}/proyecto`);
        await page.waitForLoadState("networkidle");
        await beat(page, 1800);
        await login(page, USER);
        await beat(page);

        // 2 · Catálogo → ficha (talla M: la L no tiene stock)
        await page.goto(`${BASE}/catalog`);
        await page.waitForLoadState("networkidle");
        await beat(page, 1500);
        await page.mouse.wheel(0, 500);
        await beat(page, 900);
        await page.getByRole("article").filter({ hasText: "Blazer" }).first().getByRole("link", { name: "Ver Detalle" }).click();
        await page.waitForURL(/\/products\//);
        await page.waitForLoadState("networkidle");
        await beat(page, 1500);
        await page.getByRole("button", { name: "M", exact: true }).click();
        await beat(page, 600);
        await page.getByRole("button", { name: "Añadir a la bolsa" }).click();
        await beat(page, 1200);

        // 3 · Bolsa → pedido → pantalla de pago
        await page.goto(`${BASE}/cart`);
        await page.waitForLoadState("networkidle");
        await beat(page, 1500);
        await page.getByRole("button", { name: "Tramitar pedido" }).click();
        await page.waitForURL(/\/orders\/ORD-[^/]+\/pay/);
        const orderNumber = decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);

        // 4 · Tarjeta de prueba en el Payment Element (visual) + confirmación por API
        const frame = page.frameLocator('iframe[src*="elements-inner-payment"]').first();
        const cardNumber = frame.getByPlaceholder(/1234 1234 1234 1234/);
        await cardNumber.waitFor({ timeout: 30_000 });
        await cardNumber.pressSequentially("4242424242424242", { delay: 70 });
        await frame.getByPlaceholder(/MM\s*\/\s*AA|MM\s*\/\s*YY/).pressSequentially("1234", { delay: 70 });
        await frame.getByPlaceholder(/CVC|CVV/).pressSequentially("123", { delay: 70 });
        await beat(page, 1200);
        const token = await page.evaluate(() => localStorage.getItem("token") ?? JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
        const jwt = token.startsWith("{") ? Object.values(JSON.parse(token)).find((v) => typeof v === "string" && v.split(".").length === 3) : token;
        await confirmWithStripe(orderNumber, jwt, secret);

        // 5 · El webhook confirma el pedido y la ficha lo refleja
        // El «Pagar» real redirige a la ficha con `redirect_status`; aquí la confirmación
        // fue por API, así que se hace la misma navegación a mano.
        await page.goto(`${BASE}/orders/${encodeURIComponent(orderNumber)}?redirect_status=succeeded`);
        await expect(page.getByText("Confirmado").first()).toBeVisible({ timeout: CONFIRM_TIMEOUT });
        await beat(page, 2200);

        // 6 · Panel de administración
        await page.evaluate(() => localStorage.clear());
        await login(page, ADMIN);
        await page.goto(`${BASE}/admin/orders`);
        await page.waitForLoadState("networkidle");
        await beat(page, 1800);
        await page.goto(`${BASE}/admin`);
        await page.waitForLoadState("networkidle");
        await beat(page, 2800);
        await page.mouse.wheel(0, 400);
        await beat(page, 1800);
        console.log(`Pedido grabado: ${orderNumber}`);
    } finally {
        const video = page.video();
        await context.close();
        await browser.close();
        console.log(`Vídeo: ${await video.path()}`);
    }
}

main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
});
