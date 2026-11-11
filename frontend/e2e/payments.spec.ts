// Fase 9 (R11) — pagos con Stripe de punta a punta, contra **Stripe real en test mode**.
//
// Se salta **entera** salvo que se pida: necesita claves de Stripe en
// `backend/.env`, `stripe listen` reenviando los webhooks al backend y
// `E2E_STRIPE=1`. Sin claves el backend corre en «modo sin pasarela» y el resto
// de la suite (smoke, axe, coupons…) no cambia — por eso CI no la ejecuta:
//
//   stripe listen --events payment_intent.succeeded,payment_intent.payment_failed,charge.refunded \
//       --forward-to localhost:8080/api/v1/webhooks/stripe
//   E2E_STRIPE=1 PORT=3001 npx playwright test e2e/payments.spec.ts --project=chromium
//
// Si `E2E_STRIPE=1` pero el backend NO está en modo STRIPE, el `beforeAll`
// **falla** (no se salta en silencio): pedir la prueba y no poder hacerla es un error.
//
// **Por qué no se teclea la tarjeta en el Payment Element**: Stripe lanza un
// desafío hCaptcha a los navegadores automatizados y bloquea el «Pagar» (medido:
// los campos se rellenan bien, el botón se pulsa y la confirmación nunca llega).
// Stripe desaconseja automatizar sus formularios; lo documentado es **confirmar
// el PaymentIntent por API con métodos de prueba** (`pm_card_visa`…). Así el
// test sigue ejerciendo lo que es nuestro — checkout → pantalla de pago (con
// axe) → **webhook real** → ficha con sondeo → panel — y la parte del navegador
// (tarjeta, 3D Secure, rechazo) se valida a mano y con los tests de `PayPage`.
//
// Estilo (R5 de la 4.2): localizadores por rol y label, esperas condicionales y
// cero `waitForTimeout`. Los helpers de UI se repiten aquí a propósito: no se
// toca `smoke.spec.ts`.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { callOk } from "./helpers/api";
import { E2E_USER, PRODUCT } from "./helpers/config";

/** Semilla `V13` (README): la única cuenta con rol ADMIN. */
const ADMIN = { email: "admin@nexus.dev", password: "Admin1234!" };

/** Métodos de pago de prueba de Stripe (https://docs.stripe.com/testing#cards). */
const PM = { ok: "pm_card_visa", insufficientFunds: "pm_card_chargeDeclinedInsufficientFunds" } as const;

/** La confirmación llega por webhook (asíncrona): margen holgado sobre el sondeo de 30 s. */
const CONFIRMATION_TIMEOUT = 45_000;

test.skip(process.env.E2E_STRIPE !== "1", "Requiere claves de Stripe, `stripe listen` y E2E_STRIPE=1");
test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Los iframes de Stripe se validan sólo en Chromium"
);

test.beforeAll(async () => {
    const config = await callOk<{ paymentMode: string }>("/api/v1/payments/config");
    if (config.paymentMode !== "STRIPE") {
        throw new Error(
            `E2E_STRIPE=1 pero el backend está en modo ${config.paymentMode}: ` +
                "pon STRIPE_SECRET_KEY (sk_test_…) en backend/.env y reinícialo."
        );
    }
});

async function login(page: Page, user: { email: string; password: string }): Promise<void> {
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("link", { name: "PEDIDOS" })).toBeVisible();
}

/** Catálogo → ficha → talla M (la L no tiene stock) → añadir. Mismo recorrido que el humo. */
async function addBlazerToBag(page: Page): Promise<void> {
    await page.goto("/catalog");
    await page
        .getByRole("article")
        .filter({ hasText: PRODUCT.name })
        .getByRole("link", { name: "Ver Detalle" })
        .click();
    await page.waitForURL(/\/products\//);
    await expect(page.getByRole("heading", { name: PRODUCT.name })).toBeVisible();
    await page.getByRole("button", { name: PRODUCT.size, exact: true }).click();
    await page.getByRole("button", { name: "Añadir a la bolsa" }).click();
}

/** Tramita el pedido y devuelve su número, ya en la pantalla de pago. */
async function checkoutToPayPage(page: Page): Promise<string> {
    await addBlazerToBag(page);
    await page.goto("/cart");
    await expect(page.getByText(/Pagarás con tarjeta o Apple Pay/)).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0); // ya no hay selector de método
    await page.getByRole("button", { name: "Tramitar pedido" }).click();
    await page.waitForURL(/\/orders\/ORD-[^/]+\/pay/);
    return decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);
}

/** El Payment Element vive en un iframe de Stripe; los placeholders son iguales en es/en. */
function paymentFrame(page: Page) {
    return page.frameLocator('iframe[src*="elements-inner-payment"]').first();
}

/**
 * Clave secreta de TEST: `STRIPE_SECRET_KEY` del entorno o la de `backend/.env`.
 * Nunca se imprime ni se guarda; sólo viaja a `api.stripe.com`.
 */
function stripeSecretKey(): string {
    const fromEnv = process.env.STRIPE_SECRET_KEY;
    if (fromEnv) return fromEnv;
    const env = readFileSync(resolve(__dirname, "../../backend/.env"), "utf8");
    const key = env.match(/^STRIPE_SECRET_KEY=(.+)$/m)?.[1]?.trim();
    if (!key?.startsWith("sk_test_")) throw new Error("Hace falta una STRIPE_SECRET_KEY de test (sk_test_…).");
    return key;
}

async function userToken(): Promise<string> {
    const { token } = await callOk<{ token: string }>("/api/v1/auth/login", {
        method: "POST",
        json: { email: E2E_USER.email, password: E2E_USER.password },
    });
    return token;
}

/** Id del PaymentIntent de un pedido: el `clientSecret` es `<pi_id>_secret_<…>`. */
async function paymentIntentId(orderNumber: string): Promise<string> {
    const { clientSecret } = await callOk<{ clientSecret: string }>(
        `/api/v1/orders/${orderNumber}/payment`,
        { token: await userToken() }
    );
    return clientSecret.split("_secret_")[0];
}

/** Confirma el PaymentIntent como lo haría el navegador, pero por API (sin hCaptcha). */
async function confirmWithStripe(orderNumber: string, paymentMethod: string): Promise<Response> {
    const id = await paymentIntentId(orderNumber);
    return fetch(`https://api.stripe.com/v1/payment_intents/${id}/confirm`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${stripeSecretKey()}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ payment_method: paymentMethod }),
    });
}

const payButton = (page: Page) => page.getByRole("button", { name: /^Pagar / });

/** Tras pagar: la ficha sondea hasta que el webhook confirma (spec D14). */
async function expectPaidAndConfirmed(page: Page, orderNumber: string): Promise<void> {
    // Como la redirección de Stripe tras pagar: la ficha sondea hasta que llega el webhook
    await page.goto(`/orders/${orderNumber}?redirect_status=succeeded`);
    await expect(page.getByTestId("payment-status")).toContainText("Pagado", {
        timeout: CONFIRMATION_TIMEOUT,
    });
    // La insignia de estado (el banner de «gracias» sólo sale la primera vez que se abre la ficha)
    await expect(page.getByText("Confirmado", { exact: true }).first()).toBeVisible();
}

async function adminToken(): Promise<string> {
    const { token } = await callOk<{ token: string }>("/api/v1/auth/login", { method: "POST", json: ADMIN });
    return token;
}

test.describe("Pagos con Stripe", () => {
    test("compra: pantalla de pago accesible → el webhook confirma → Pedido confirmado y Pagado", async ({ page }) => {
        await login(page, E2E_USER);
        const orderNumber = await checkoutToPayPage(page);

        // La pantalla de pago carga el Payment Element y es accesible
        // (axe: sólo critical/serious tumban, igual que la 4.3)
        await expect(paymentFrame(page).getByPlaceholder("1234 1234 1234 1234")).toBeVisible({ timeout: 20_000 });
        await expect(payButton(page)).toBeEnabled();
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(
            violations.filter((v) => !v.impact || ["critical", "serious"].includes(v.impact)).map((v) => v.id),
            "violaciones bloqueantes en /orders/[n]/pay"
        ).toEqual([]);

        const res = await confirmWithStripe(orderNumber, PM.ok);
        expect(res.status).toBe(200);

        await expectPaidAndConfirmed(page, orderNumber);
    });

    test("pago rechazado: el pedido sigue pendiente y un reintento válido lo confirma", async ({ page }) => {
        await login(page, E2E_USER);
        const orderNumber = await checkoutToPayPage(page);

        // WHEN Stripe rechaza el pago (fondos insuficientes)
        const declined = await confirmWithStripe(orderNumber, PM.insufficientFunds);
        expect(declined.status).toBe(402);

        // THEN el pedido sigue pendiente de pago y se ofrece completarlo
        await page.goto(`/orders/${orderNumber}`);
        await expect(page.getByTestId("payment-status")).toContainText("Pendiente de pago");
        await expect(page.getByRole("link", { name: "Completar pago" })).toBeVisible();

        // AND el reintento sobre el MISMO PaymentIntent lo confirma
        const ok = await confirmWithStripe(orderNumber, PM.ok);
        expect(ok.status).toBe(200);
        await expectPaidAndConfirmed(page, orderNumber);
    });

    test("pedido sin pagar: la ficha ofrece «Completar pago»; al cancelarlo desde el panel ya no se puede pagar", async ({ page }) => {
        await login(page, E2E_USER);
        const orderNumber = await checkoutToPayPage(page);

        // GIVEN un pedido pendiente: la ficha ofrece completar el pago
        await page.goto(`/orders/${orderNumber}`);
        await expect(page.getByTestId("payment-status")).toContainText("Pendiente de pago");
        await expect(page.getByRole("link", { name: "Completar pago" })).toHaveAttribute(
            "href",
            `/orders/${orderNumber}/pay`
        );

        // WHEN el admin lo cancela (anula también el PaymentIntent y libera stock y cupón)
        const token = await adminToken();
        await callOk(`/api/v1/admin/orders/${orderNumber}/status`, {
            method: "PUT",
            token,
            json: { status: "CANCELLED" },
        });

        // THEN la página de pago ya no sirve: redirige a la ficha, que dice que caducó
        await page.goto(`/orders/${orderNumber}/pay`);
        await page.waitForURL(new RegExp(`/orders/${orderNumber}$`));
        await expect(page.getByTestId("payment-status")).toContainText("Caducado");
        await expect(page.getByRole("link", { name: "Completar pago" })).toHaveCount(0);
    });

    test("el admin reembolsa un pedido pagado (parcial y el resto) desde el panel", async ({ page }) => {
        // GIVEN un pedido pagado por el cliente
        await login(page, E2E_USER);
        const orderNumber = await checkoutToPayPage(page);
        expect((await confirmWithStripe(orderNumber, PM.ok)).status).toBe(200);
        await expectPaidAndConfirmed(page, orderNumber);

        // WHEN el admin abre el pedido
        await page.evaluate(() => localStorage.clear());
        await login(page, ADMIN);
        page.on("dialog", (dialog) => void dialog.accept());
        await page.goto(`/admin/orders/${orderNumber}`);
        await expect(page.getByRole("heading", { name: /Cobro · Pagado/ })).toBeVisible();

        // AND cancelar un pedido pagado está bloqueado hasta reembolsar
        await page.getByRole("button", { name: "Cancelar pedido" }).click();
        await expect(page.getByRole("alert").first()).toContainText(/reembolsa el pedido antes de cancelarlo/i);

        // AND reembolsa una parte
        await page.getByLabel(/Importe/).fill("30,5");
        await page.getByRole("button", { name: "Reembolsar" }).click();
        await expect(page.getByRole("heading", { name: /Cobro · Reembolsado parcialmente/ })).toBeVisible();
        await expect(page.getByText(/Reembolsado 30\.50 EUR/)).toBeVisible();

        // AND después, con el importe vacío, el resto
        await page.getByRole("button", { name: "Reembolsar" }).click();
        await expect(page.getByRole("heading", { name: /Cobro · Reembolsado$/ })).toBeVisible();
        await expect(page.getByRole("button", { name: "Reembolsar" })).toHaveCount(0);

        // THEN el cliente ve el reembolso en su ficha (lo fijó el webhook charge.refunded o la respuesta)
        await page.evaluate(() => localStorage.clear());
        await login(page, E2E_USER);
        await page.goto(`/orders/${orderNumber}`);
        await expect(page.getByTestId("payment-status")).toContainText("Reembolsado");
    });
});
