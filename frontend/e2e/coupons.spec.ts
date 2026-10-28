// V5 cupones (spec specs/coupons/, §3 E2E) — flujo completo contra backend real.
//
// Nada se mockea: el cupón se CREA en el panel por API con el admin de la
// semilla, se aplica en el carrito por la interfaz, y el pedido resultante se
// verifica también por API. Es la única forma de probar la cadena
// `CouponInput → validate → CartContext → checkout → redeemCoupon → orden`.
//
// Estilo (R5): localizadores por rol y label, esperas condicionales y cero
// `waitForTimeout` con espera fija. `smoke.spec.ts` queda intacto (R2): los
// helpers de navegación se duplican aquí a propósito, como ya hace
// `a11y.spec.ts`.

import { expect, test, type Page } from "@playwright/test";
import { call, callOk } from "./helpers/api";
import { E2E_USER, PRODUCT } from "./helpers/config";

/** Semilla `V13` (README): la única cuenta con rol ADMIN. */
const ADMIN = { email: "admin@nexus.dev", password: "Admin1234!" };

/** Código único por corrida para que las pasadas acumuladas no interfieran. */
let couponCode = "";
let couponId: number | null = null;
let adminToken = "";

interface AuthResponse {
    token: string;
}

interface CuponCreado {
    id: number;
    code: string;
}

test.beforeAll(async () => {
    const auth = await callOk<AuthResponse>("/api/v1/auth/login", {
        method: "POST",
        json: ADMIN,
    });
    adminToken = auth.token;

    couponCode = `E2E-${Date.now().toString(36).toUpperCase()}`;
    // `validFrom` exige ser ≥ al instante de creación (@FutureOrPresent,
    // medida en los tests del controller): se crea con margen y después se
    // espera a que venace con una condición de estado del propio backend.
    const creado = await callOk<CuponCreado>("/api/v1/admin/coupons", {
        method: "POST",
        token: adminToken,
        json: {
            code: couponCode,
            type: "FIXED",
            value: 5,
            validFrom: new Date(Date.now() + 5_000).toISOString(),
            validUntil: new Date(Date.now() + 86_400_000).toISOString(),
            usageLimit: 10,
        },
    });
    couponId = creado.id;
});

test.afterAll(async () => {
    if (!couponId) return;
    // Tiene usos tras el flujo → el DELETE responde 409 y toca desactivarlo.
    const borrado = await call(`/api/v1/admin/coupons/${couponId}`, {
        method: "DELETE",
        token: adminToken,
    });
    if (!borrado.ok) {
        await call(`/api/v1/admin/coupons/${couponId}`, {
            method: "PUT",
            token: adminToken,
            json: { active: false },
        });
    }
});

/** Inicia sesión por la interfaz: el JWT lo pone el backend. */
async function login(page: Page): Promise<void> {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_USER.email);
    await page.getByLabel("Contraseña").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("link", { name: "PEDIDOS" })).toBeVisible();
}

/** Catálogo → ficha → talla M → añadir (espejo de `smoke.spec.ts`, sin importarlo). */
async function addBlazerToBag(page: Page): Promise<void> {
    await page.goto("/catalog");
    await page
        .getByRole("article")
        .filter({ hasText: PRODUCT.name })
        .getByRole("link", { name: "Ver Detalle" })
        .click();
    await page.waitForURL(/\/products\//);
    await expect(page.getByRole("button", { name: "Añadir a la bolsa" })).toBeVisible();
    await page.getByRole("button", { name: PRODUCT.size, exact: true }).click();
    await page.getByRole("button", { name: "Añadir a la bolsa" }).click();
}

/**
 * Importe junto a una etiqueta del resumen, medida contra el `innerText` real.
 *
 * Trampa medida en la primera corrida: el bloque del resumen tiene
 * `text-transform: uppercase`, y el `innerText()` de Playwright **respeta** el
 * CSS — el texto sale «SUBTOTAL 89.95 EUR», así que un regex
 * `/subtotal/i` no matchea y uno `/total/i` matchea dentro de «SUBTOTAL».
 * Se compara la **línea de la etiqueta** exacta y se lee el importe de esa
 * misma línea o de la siguiente (flex lo puede partir en dos).
 */
function importeDe(texto: string, etiqueta: string): number {
    const lineas = texto
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const i = lineas.findIndex((l) => l.toLowerCase() === etiqueta.toLowerCase());
    if (i === -1) return Number.NaN;
    const mismaLinea = lineas[i].slice(etiqueta.length);
    const candidato = mismaLinea || lineas[i + 1] || "";
    const m = /([\d]+(?:\.[\d]+)?)\s*[A-Z]{3}/i.exec(candidato);
    return m ? Number(m[1]) : Number.NaN;
}

/**
 * Espera a que el cupón esté vigente **mirando el backend**, no el reloj.
 *
 * `POST /coupons/validate` es la misma llamada que hará el carrito: cuando
 * devuelva `valid: true`, el `validFrom` con margen ya venció. Una espera
 * fija aquí sería exactly lo que R5 prohíbe.
 */
async function esperarVigencia(): Promise<void> {
    await expect
        .poll(
            async () => {
                const res = await call("/api/v1/coupons/validate", {
                    method: "POST",
                    token: adminToken,
                    json: { code: couponCode, subtotal: 100 },
                });
                const body = (await res.json()) as { valid: boolean };
                return body.valid;
            },
            { timeout: 20_000, intervals: [500] }
        )
        .toBe(true);
}

test.describe("V5 cupones · flujo completo", () => {
    test("el usuario aplica el cupón, ve el descuento y compra con él", async ({ page }) => {
        // GIVEN el cupón vigente y una sesión de comprador
        await esperarVigencia();
        await login(page);
        await addBlazerToBag(page);
        await expect(page.getByRole("button", { name: /Carrito con 1 artículos/ })).toBeVisible();

        // WHEN aplica el código en el carrito (debounce de 500 ms incluido)
        await page.goto("/cart");
        await page.getByLabel("Código de cupón").fill(couponCode);
        await expect(page.getByRole("status")).toHaveText(/Cupón aplicado/, { timeout: 10_000 });

        // THEN el resumen muestra el descuento y el total resta (§2.6A)
        const main = page.getByRole("main");
        await expect(main.getByText(/^Descuento$/)).toBeVisible();
        await expect(main.getByText("−5.00 EUR")).toBeVisible();

        const texto = await main.innerText();
        const subtotal = importeDe(texto, "Subtotal");
        const total = importeDe(texto, "Total");
        expect(subtotal).toBeGreaterThan(0);
        expect(total).toBeCloseTo(subtotal - 5, 2);

        // WHEN tramita el pedido
        await page.getByRole("button", { name: "Tramitar pedido" }).click();
        await page.waitForURL(/\/orders\/ORD-/);
        const orderNumber = decodeURIComponent(
            new URL(page.url()).pathname.split("/").pop() ?? ""
        );

        // THEN la ficha del pedido informa del descuento aplicado
        await expect(page.getByRole("heading", { name: "Gracias por tu compra" })).toBeVisible();
        await expect(page.getByText("Descuento de cupón (ya aplicado)")).toBeVisible();
        await expect(page.getByText("−5.00 EUR")).toBeVisible();

        // AND la API persistió el descuento y el total descontado (§3)
        const token = (
            await callOk<AuthResponse>("/api/v1/auth/login", {
                method: "POST",
                json: E2E_USER,
            })
        ).token;
        const pedido = (await call(`/api/v1/users/me/orders/${orderNumber}`, {
            token,
        }).then((r) => r.json())) as {
            discountAmount: number | null;
            totalAmount: number;
        };
        expect(pedido.discountAmount).not.toBeNull();
        expect(pedido.discountAmount).toBeCloseTo(5, 2);
        expect(pedido.totalAmount).toBeCloseTo(subtotal - 5, 2);
    });

    test("un código inexistente muestra el error y NO aplica ningún descuento", async ({
        page,
    }) => {
        // GIVEN una sesión con artículo en la bolsa
        await login(page);
        await addBlazerToBag(page);
        await page.goto("/cart");

        // WHEN introduce un código que no existe
        await page.getByLabel("Código de cupón").fill("NO-EXISTE-99");

        // THEN el servidor responde con su mensaje…
        await expect(page.getByRole("status")).toHaveText("Cupón no válido", {
            timeout: 10_000,
        });

        // …y no queda ni descuento ni cupón que quitar (§2.4: un intento
        // inválido nunca llega al checkout)
        const main = page.getByRole("main");
        await expect(main.getByText(/^Descuento$/)).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Quitar cupón" })).toHaveCount(0);
    });
});
