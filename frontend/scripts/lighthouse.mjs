#!/usr/bin/env node
// Tarea 4.3 (R1 · D3 · D4) — Lighthouse CI contra el navegador de Playwright.
//
// Lighthouse necesita saber qué Chrome usar. En vez de instalar otro navegador
// **o** de fijar una ruta de máquina concreta (que rompería en CI y en el ordenador
// de cualquier otro), se resuelve la que ya gestiona Playwright:
//
//   CHROME_PATH = chromium.executablePath()
//
// Es la misma binaria de Chrome for Testing que usan los E2E, así que la
// auditoría mide con el navegador que ya está instalado (R1: «sin descargar
// navegador nuevo»).
//
// Uso:  node scripts/lighthouse.mjs [args de lhci]
//       por defecto ejecuta `lhci autorun`.

import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const chrome = chromium.executablePath();

if (!chrome || !existsSync(chrome)) {
    console.error(
        "[cwv] No se encontró el Chromium de Playwright.\n" +
        "      Instálalo con:  npx playwright install chromium"
    );
    process.exit(1);
}

process.env.CHROME_PATH = chrome;
console.log(`[cwv] Chrome:  ${chrome}`);

const lhciArgs = process.argv.slice(2);
const argv = ["lhci", ...(lhciArgs.length > 0 ? lhciArgs : ["autorun"])];

console.log(`[cwv] Comando: npx ${argv.join(" ")}\n`);

const result = spawnSync("npx", argv, {
    stdio: "inherit",
    env: process.env,
    // `npx` es `.cmd` en Windows; el resto de plataformas no necesita shell.
    shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
