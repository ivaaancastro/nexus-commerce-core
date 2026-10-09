// Tarea 6.1 (R1.4, D2) — regresión de desbordes horizontales en móvil.
//
// jsdom no calcula layout: un `scrollWidth` en jsdom no mide nada. Este test
// fija un viewport de 390 px y afirma que la página **no** se ensancha más allá
// del viewport, que es exactamente lo que le pasaba al `Header` antes del fix:
// la fila derecha no podía envolver, Chrome ensanchaba la maqueta a ~690 px y
// el usuario veía zoom-out forzoso con el nav cortado.
//
// La métrica es `documentElement.scrollWidth` frente al **ancho de ventana**,
// no `visualViewport` (ambos equivalen cuando no hay desborde).

import { expect, test, type Page } from "@playwright/test";

/** Rutas públicas con estructura representativa (header en todas). */
const ROUTES = ["/", "/catalog", "/search", "/cart", "/login"];

async function expectNoHorizontalScroll(page: Page, path: string): Promise<void> {
    await page.goto(path);
    // Espera condicional: la página termina de hidratar y de pintar el header.
    await expect(page.locator("header").first()).toBeVisible();

    const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
    }));

    // Un píxel de margen: el scrollbar clásico puede restar 15 px de ancho
    // efectivo, y el desborde real que perseguimos era de **cientos** de px.
    expect(
        overflow.scrollW,
        `${path} desborda horizontalmente: scrollWidth=${overflow.scrollW} > ${overflow.innerW}`
    ).toBeLessThanOrEqual(overflow.innerW + 1);
}

test.describe("Responsive — sin scroll horizontal en móvil (Tarea 6.1)", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
    });

    for (const route of ROUTES) {
        test(`390 px — ${route} no desborda`, async ({ page }) => {
            await expectNoHorizontalScroll(page, route);
        });
    }

    test("390 px — el header envuelve sin cortar ningún enlace", async ({ page }) => {
        await page.goto("/");
        const header = page.locator("header");

        // Todos los enlaces del header siguen en el DOM y visibles (D1: la
        // corrección envuelve, no oculta).
        await expect(header.getByRole("link", { name: /colección/i })).toBeVisible();
        await expect(header.getByRole("link", { name: /búsqueda vectorial/i })).toBeVisible();
        await expect(header.getByRole("link", { name: /iniciar sesión|pedidos/i }).first()).toBeVisible();

        // Y cada enlace cabe dentro del viewport (no hay nada cortado a la derecha).
        const boxes = await header.getByRole("link").all();
        for (const link of boxes) {
            const box = await link.boundingBox();
            if (box) {
                expect(box.x + box.width).toBeLessThanOrEqual(391);
            }
        }
    });
});
