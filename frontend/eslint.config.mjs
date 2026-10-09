import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tarea 6.1 (hallazgo): informe generado por `npm run test:coverage`
    // (gitignored). Sin esta línea, un `npm run lint` local tras medir
    // cobertura informa 2 warnings de los ficheros generados.
    "coverage/**",
  ]),
]);

export default eslintConfig;
