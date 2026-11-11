// Fase 10 (RNF6) — humo de la landing `/proyecto`.
//
// La página es estática y no pide nada a la API, pero se abre contra el build
// de producción real (igual que el resto de la suite): comprueba que la ruta
// existe, que sus CTA llevan a la tienda y que no hay errores de consola.

import { expect, test } from "@playwright/test";

test("la landing /proyecto se abre sin errores y su CTA lleva a la tienda", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/proyecto");
    await expect(page.getByRole("heading", { level: 1, name: "Nexus Commerce Core" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Pruébalo" })).toBeVisible();

    await page.getByRole("link", { name: "Probar la demo" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { level: 1, name: "Colección" })).toBeVisible();

    expect(errors).toEqual([]);
});
