// Tarea 4.2 (R3 + R4 + R5) — suite de humo contra backend real.
//
// Aquí **no se mockea nada**: cada petición sale del navegador, pasa por el
// rewrite de Next y llega a Spring y a PostgreSQL. Es lo único que valida la
// cadena completa, que es justo lo que los 270 tests de Vitest no cubren.
//
// Estilo (R5): localizadores por rol y label, esperas condicionales y cero
// `waitForTimeout` con espera fija — Playwright ya espera por nosotros.

import { expect, test, type Page } from "@playwright/test";
import { E2E_USER, PRODUCT } from "./helpers/config";

/** Botón del carrito: su `aria-label` es literal (plural siempre). */
const cartButton = (count: number) => ({
    name: `Carrito con ${count} artículos`,
});

/** Inicia sesión por la interfaz: el JWT lo pone el backend, no nosotros. */
async function login(page: Page): Promise<void> {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_USER.email);
    await page.getByLabel("Contraseña").fill(E2E_USER.password);
    // `exact` para no confundir «Entrar» con «Entrando...».
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("link", { name: "PEDIDOS" })).toBeVisible();
}

/**
 * Recorre catálogo → ficha → talla → añadir.
 *
 * Se entra por el enlace «Ver Detalle» de la tarjeta en vez de construir la
 * URL: además de más real, evita el `%2F` de la referencia `0432/021`.
 * La talla es **M** por una razón de datos, no estética: la L no tiene stock.
 */
async function addBlazerToBag(page: Page): Promise<void> {
    await page.goto("/catalog");
    await page
        .getByRole("article")
        .filter({ hasText: PRODUCT.name })
        .getByRole("link", { name: "Ver Detalle" })
        .click();

    // Esperar a la navegación **antes** de mirar contenido. Sin esto hay una
    // carrera: la tarjeta del catálogo tiene un `<h3>` con el mismo nombre, la
    // aserción se satisface en la página anterior y el clic de la talla cae en
    // el *filtro* de talla del catálogo en vez del selector de la ficha.
    await page.waitForURL(/\/products\//);
    await expect(page.getByRole("heading", { name: PRODUCT.name })).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir a la bolsa" })).toBeVisible();
    await page.getByRole("button", { name: PRODUCT.size, exact: true }).click();
    await page.getByRole("button", { name: "Añadir a la bolsa" }).click();
}

/**
 * Total real de pedidos de la cuenta.
 *
 * Se lee el `totalElements` del encabezado y **no** se cuentan las tarjetas:
 * la lista pagina con `PAGE_SIZE = 20`, así que un recuento de enlaces sólo
 * vería la página actual y fallaría por razones de paginación, no de negocio.
 *
 * La espera es sobre `role="status"` («Cargando pedidos...»), que sólo existe
 * mientras `loading === true` — es decir, se espera a que la petición termine
 * de verdad en vez de leer un contador que aún no se ha rellenado.
 * El `^...$` del regex evita confundirlo con el `h1` «Mis pedidos».
 */
async function ordersTotal(page: Page): Promise<number> {
    await expect(page.getByRole("status")).toHaveCount(0);
    const label = await page.getByText(/^\d+ pedidos?$/).innerText();
    return Number(label.split(" ")[0]);
}

test.describe("Compra completa", () => {
    test("el usuario compra un blazer de punta a punta", async ({ page }) => {
        // GIVEN una sesión activa
        await login(page);

        // AND un recuento previo de pedidos, para demostrar que sólo se crea uno
        await page.goto("/orders");
        const ordersBefore = await ordersTotal(page);

        // WHEN añade el producto a la bolsa y tramita el pedido
        await addBlazerToBag(page);
        await expect(page.getByRole("button", cartButton(1))).toBeVisible();

        await page.goto("/cart");
        await expect(page.getByRole("button", { name: "Tramitar pedido" })).toBeEnabled();
        await page.getByRole("button", { name: "Tramitar pedido" }).click();

        // THEN se llega a la ficha del pedido recién creado
        await page.waitForURL(/\/orders\/ORD-/);
        const orderNumber = decodeURIComponent(new URL(page.url()).pathname.split("/").pop() ?? "");
        expect(orderNumber).toMatch(/^ORD-/);
        await expect(page.getByRole("heading", { name: "Gracias por tu compra" })).toBeVisible();

        // AND la bolsa ha quedado vacía
        await expect(page.getByRole("button", cartButton(0))).toBeVisible();

        // AND el pedido sobrevive a una recarga
        await page.reload();
        await expect(page.getByText(orderNumber).first()).toBeVisible();

        // AND sólo se ha creado UN pedido: el `Idempotency-Key` no ha duplicado
        await page.goto("/orders");
        const after = ordersBefore + 1;
        await expect(page.getByText(/^\d+ pedidos?$/)).toHaveText(
            `${after} ${after === 1 ? "pedido" : "pedidos"}`
        );
    });
});

test.describe("Bolsa", () => {
    test("la bolsa persiste tras recargar la página", async ({ page }) => {
        // GIVEN un artículo en la bolsa
        await addBlazerToBag(page);
        await expect(page.getByRole("button", cartButton(1))).toBeVisible();

        // WHEN se recarga la página
        await page.reload();

        // THEN el artículo sigue ahí — `useSyncExternalStore` lee
        // `localStorage` ya en el primer render
        await expect(page.getByRole("button", cartButton(1))).toBeVisible();
        await page.goto("/cart");
        // El nombre aparece dos veces (fondo y cajón lateral), así que se acota
        // al `main`: la afirmación es sobre la página, no sobre el cajón.
        await expect(page.getByRole("main").getByText(PRODUCT.name)).toBeVisible();
    });
});

test.describe("Sesión", () => {
    test("una ruta protegida sin sesión redirige a /login", async ({ page }) => {
        // GIVEN un navegador sin sesión
        // WHEN visita una ruta protegida
        await page.goto("/orders");

        // THEN es redirigido al inicio de sesión
        await page.waitForURL("**/login");
        await expect(page.getByRole("heading", { name: "INICIAR SESIÓN" })).toBeVisible();
    });

    test("iniciar sesión muestra PEDIDOS y CUENTA, y cerrar vuelve a INICIAR SESIÓN", async ({ page }) => {
        // GIVEN la página de login
        await page.goto("/login");
        await expect(page.getByRole("link", { name: "INICIAR SESIÓN" })).toBeVisible();

        // WHEN introduce credenciales válidas
        await page.getByLabel("Email").fill(E2E_USER.email);
        await page.getByLabel("Contraseña").fill(E2E_USER.password);
        await page.getByRole("button", { name: "Entrar", exact: true }).click();

        // THEN la cabecera refleja la sesión autenticada
        await expect(page.getByRole("link", { name: "PEDIDOS" })).toBeVisible();
        await expect(page.getByRole("link", { name: "CUENTA" })).toBeVisible();

        // AND al cerrar sesión se vuelve al estado inicial
        await page.getByRole("button", { name: "Cerrar sesión" }).click();
        await expect(page.getByRole("link", { name: "INICIAR SESIÓN" })).toBeVisible();
        await expect(page.getByRole("link", { name: "PEDIDOS" })).toHaveCount(0);
    });
});

test.describe("Ficha de producto", () => {
    test("la confirmación de añadido desaparece sola", async ({ page }) => {
        // GIVEN la ficha con una talla elegida
        await addBlazerToBag(page);
        const confirmation = page.getByText(/Añadido a la bolsa/);

        // THEN la confirmación aparece…
        await expect(confirmation).toBeVisible();

        // …y se retira sola pasados 2500 ms, con reloj real
        await expect(confirmation).toBeHidden({ timeout: 6_000 });
    });
});
