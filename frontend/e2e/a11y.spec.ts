// Tarea 4.3 (R2) — accesibilidad **ejecutada**, no leída.
//
// Las 14 rutas del App Router se abren en un navegador real y se les pasa axe.
// Esto es lo que complementa a la 4.1: ESLint comprueba que el JSX esté
// *bien escrito*, y aquí se comprueba que la página *funcione* para quien usa
// teclado o lector de pantalla.
//
// Estilo heredado de la 4.2 (R5): localizadores por rol y label, esperas
// condicionales y **cero `waitForTimeout` con espera fija**.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER, PRODUCT } from "./helpers/config";
import { ensureOrderNumber } from "./helpers/orders";

/**
 * D5 — **sólo Chromium**.
 *
 * Las reglas de axe inspeccionan el **DOM renderizado**, y ese DOM es el mismo
 * en los tres motores. Correrlo en Firefox y WebKit multiplicaría ×3 el coste
 * de la suite con **cero señal nueva**; la variación real entre motores ya la
 * cubre la 4.2 con los flujos de compra, sesión y bolsa.
 *
 * Se salta con `test.skip` en vez de filtrar el `testDir`: así las 14 pruebas
 * siguen existiendo en los tres proyectos y el motivo queda visible en el
 * informe, no escondido en la config.
 */
test.skip(
    ({ browserName }) => browserName !== "chromium",
    "D5: axe inspecciona el DOM, y el DOM es idéntico en los tres motores"
);

/** `critical` y `serious` tumban el gate (D7). El resto se informa abajo. */
const BLOCKING = new Set(["critical", "serious"]);

/**
 * Ejecuta axe sobre la página y falla sólo por violaciones bloqueantes.
 *
 * Las `moderate` y `minor` **no se silencian**: se imprimen para que se puedan
 * congelar más adelante sin tener que rehacer la auditoría (D7).
 */
async function audit(page: Page, route: string): Promise<void> {
    const { violations } = await new AxeBuilder({ page }).analyze();

    // `impact === null` significa «severidad desconocida»: no se puede probar
    // que sea inofensiva, así que entra en las bloqueantes (mismo criterio que
    // las `critical`/`serious`).
    const blocking = violations.filter((v) => !v.impact || BLOCKING.has(v.impact));
    const reported = violations.filter((v) => v.impact && !BLOCKING.has(v.impact));

    for (const v of reported) {
        console.log(
            `  [a11y] ${route} · ${v.impact} · ${v.id} (${v.nodes.length} nodos): ${v.help}`
        );
    }

    expect(
        blocking.map(
            (v) =>
                `${v.impact ?? "sin impacto"} · ${v.id}: ${v.help}\n` +
                v.nodes
                    .map((n) => `    - ${n.target.join(" ")} → ${n.html.slice(0, 160)}`)
                    .join("\n")
        ),
        `violaciones bloqueantes en ${route}`
    ).toEqual([]);
}

/**
 * Abre la ruta y **espera a que termine de cargar sus datos**.
 *
 * Auditar el esqueleto de carga daría el resultado de una página que el usuario
 * nunca llega a ver: axe vería un `<h2>Cargando...</h2>` en vez del contenido.
 * `networkidle` es una espera condicional (no hay websockets ni polling en el
 * proyecto), no un `waitForTimeout`.
 */
async function open(page: Page, route: string): Promise<void> {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
}

/**
 * Inicia sesión por la interfaz.
 *
 * Espejo del helper de `smoke.spec.ts` — **no se importa de ahí** porque la R2
 * exige que ese fichero quede intacto. El JWT lo pone el backend.
 */
async function login(page: Page): Promise<void> {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_USER.email);
    await page.getByLabel("Contraseña").fill(E2E_USER.password);
    // `exact` para no confundir «Entrar» con «Entrando...».
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("link", { name: "PEDIDOS" })).toBeVisible();
    await page.waitForLoadState("networkidle");
}

const PUBLIC_ROUTES = [
    "/",
    "/catalog",
    "/search",
    "/cart",
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
];

test.describe("Accesibilidad · páginas públicas", () => {
    for (const route of PUBLIC_ROUTES) {
        test(`la ruta ${route} no tiene violaciones bloqueantes`, async ({ page }) => {
            await open(page, route);
            await audit(page, route);
        });
    }
});

test.describe("Accesibilidad · ficha de producto", () => {
    // La referencia lleva una `/`: se codifica igual que hace `ProductCard`.
    const route = `/products/${encodeURIComponent(PRODUCT.reference)}`;

    test(`la ruta ${route} no tiene violaciones bloqueantes`, async ({ page }) => {
        await open(page, route);
        await audit(page, route);
    });
});

test.describe("Accesibilidad · sesión iniciada", () => {
    for (const route of ["/orders", "/profile", "/addresses"]) {
        test(`la ruta ${route} no tiene violaciones bloqueantes`, async ({ page }) => {
            await login(page);
            await open(page, route);
            await audit(page, route);
        });
    }
});

test.describe("Accesibilidad · pedidos concretos", () => {
    for (const build of [
        (n: string) => `/orders/${n}`,
        (n: string) => `/receipt/${n}`,
    ]) {
        const route = build("{orderNumber}");

        test(`la ruta ${route} no tiene violaciones bloqueantes`, async ({ page }) => {
            const orderNumber = await ensureOrderNumber();
            await login(page);
            await open(page, build(orderNumber));
            await audit(page, route);
        });
    }
});
