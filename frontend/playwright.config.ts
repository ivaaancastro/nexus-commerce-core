import { defineConfig, devices } from "@playwright/test";

// Tarea 4.2 (R1): configuración de los E2E.
//
// Convención importante: **este fichero y `e2e/` viven en el mismo árbol que
// los tests de Vitest, así que ambos runners llevan `testDir`/`include`
// explícitos**. Sin eso, el patrón por defecto de Vitest
// (`**/*.spec.ts`) se comería `e2e/smoke.spec.ts` y el comando de unitarios
// empezaría a ejecutar navegadores.
const PORT = process.env.PORT ?? "3000";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    // Explícito: sólo los E2E. Los unitarios están en `src/__tests__/`.
    testDir: "./e2e",
    globalSetup: "./e2e/global-setup.ts",

    // D6: un solo worker. Hay **un usuario y una base de datos compartidos**:
    // dos compras en paralelo competirían por el mismo stock y por el mismo
    // token de sesión, y la suite se volvería flaky de forma intermitente.
    // La suite es corta, así que serializar no duele.
    workers: 1,

    // R5: esperas condicionales, nunca `waitForTimeout` fijo.
    expect: { timeout: 10_000 },

    // Las pruebas de compra hacen varios viajes a Spring; WebKit es el más
    // lento de los tres, así que el margen se pone pensando en él.
    timeout: 60_000,

    // En CI un reintento oculta un fallo intermitente en lugar de
    // arreglarlo, pero compensa el ruido de red entre contenedores.
    retries: process.env.CI ? 1 : 0,

    reporter: process.env.CI
        ? [["list"], ["html", { open: "never" }], ["github"]]
        : [["list"], ["html", { open: "never" }]],

    use: {
        baseURL: BASE_URL,
        // Adjuntos que sólo se guardan si la prueba falla: sin ellos, un fallo
        // en CI es una pila de texto sin saber qué veía el navegador.
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off",
    },

    // D6: se prueba contra el **mismo artefacto que sirve producción**.
    // `next dev` tiene HMR, compilación en frío y avisos propios: es otra
    // aplicación, y sólo añade ruido a un test que ya es lento.
    // Fuera de CI se reutiliza un servidor ya levantado para iterar rápido —
    // ojo: en ese caso se estará probando contra `dev` si el que corre es el
    // de desarrollo.
    webServer: {
        command: "npm run build && npm run start",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
    },

    // D4: un mismo directorio de pruebas, tres motores. Añadir un navegador
    // es añadir una línea; ningún test se duplica.
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ],
});
