import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: "./src/test/setup.ts",
        // Tarea 4.2 (R1): **`include` explícito**. Sin él Vitest usa su patrón
        // por defecto (`**/*.spec.ts`) y se comería `e2e/smoke.spec.ts` de
        // Playwright — los unitarios empezarían a lanzar navegadores. Sólo hay
        // tests de unitarios en `src/__tests__/`, así que restringir ahí no
        // pierde nada.
        include: ["src/__tests__/**/*.{test,spec}.{ts,tsx}"],
        // Tarea 4.1 (R2): medida de cobertura. El `include` explícito es lo
        // importante: sin él sólo se miden los ficheros que algún test importa,
        // que es justo lo contrario de lo que queremos vigilar. (En Vitest 5 la
        // opción `all` ya no existe — se sustantuye con `include` — y de hecho
        // no compilaba con TypeScript.)
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/__tests__/**", "src/test/**", "src/**/*.d.ts"],
            // Tarea 4.1 (D4): umbral **medido, no impuesto**. La cifra real
            // tras escribir los tests nuevos es 78.01 / 76.32 / 74.72 / 79.85
            // (statements / branches / functions / lines), estable en varias
            // corridas. Se congela un punto por debajo de cada métrica: el
            // contrato es «esta cobertura no baja», no «llega al 90 %».
            // Verificación negativa: subir cualquier umbral a 100 hace fallar
            // `npm run test:coverage`, así que no son decorativos.
            thresholds: {
                statements: 77,
                branches: 76,
                functions: 74,
                lines: 79,
                // Tarea 6.3b (D5): umbral **por fichero**, medido y congelado
                // con el mismo criterio que los globales — un punto por debajo
                // de la medida real el 2026-10-09: **100 / 100 / 100 / 100**
                // (77 stmts · 27 branches · 29 funcs · 73 líneas). `api.ts` es
                // la única puerta a la API y era el fichero con peor cobertura
                // del proyecto (20,77 %): cualquier regreso hacia ese valle
                // queda fuera del umbral. Las comprobaciones negativas están
                // anotadas en `specs/tech-debt/tasks.md` (R4.5).
                "src/lib/api.ts": {
                    statements: 99,
                    branches: 99,
                    functions: 99,
                    lines: 99,
                },
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
