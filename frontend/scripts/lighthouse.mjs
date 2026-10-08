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
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";

const require = createRequire(import.meta.url);
const LHCI_RC = require.resolve("../lighthouserc.json");

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

// ── Guard del puerto ────────────────────────────────────────────────────────
//
// `collect.startServerCommand` lanza `next start`. Si el puerto ya está ocupado,
// ese proceso muere enseguida sin poder bindear, LHCI lo detecta como «servidor
// arrancado» y **mide lo que haya escuchando en el puerto**: un build ajeno.
//
// No es una rareza teórica. El 2026-10-08 un `next-server` colgado desde hacía
// 25 minutos produjo una corrida con LCP 6 998 ms sobre una página que en la
// corrida limpia siguiente dio 3 057 ms — y también podría haber salido al
// revés, en verde, sobre código que ya no es el nuestro.
//
// Por eso el script no deja pasar una colección con el puerto ocupado. El guard
// es gratuito en CI (nadie escucha ahí) y evita confiar en un número falso.
const collects =
    argv.length === 1 || argv.includes("autorun") || argv.includes("collect");

if (collects) {
    const { ci } = JSON.parse(readFileSync(LHCI_RC, "utf8"));
    const rawUrls = ci?.collect?.url ?? [];
    // Las 4 URLs de la auditoría comparten host y puerto: se deduplican para
    // no anunciar «localhost:3000» cuatro veces.
    const endpoints = [
        ...new Set(
            (Array.isArray(rawUrls) ? rawUrls : [rawUrls]).map((raw) => {
                const u = new URL(raw);
                return `${u.hostname}:${Number(u.port || 80)}`;
            })
        ),
    ].map((ep) => {
        const [host, port] = ep.split(":");
        return { host, port: Number(port) };
    });

    const occupied = [];
    for (const { host, port } of endpoints) {
        const busy = await new Promise((resolve) => {
            const socket = net.connect({ host, port });
            socket.once("connect", () => {
                socket.destroy();
                resolve(true);
            });
            socket.once("error", () => resolve(false));
        });
        if (busy) occupied.push(`${host}:${port}`);
    }

    if (occupied.length > 0) {
        console.error(
            `[cwv] Abortado: ya hay algo escuchando en ${occupied.join(", ")}.\n` +
                "\n" +
                "      Lighthouse mediría ese servidor en vez del build que acabo de\n" +
                "      producir, porque `startServerCommand` no puede bindear el puerto.\n" +
                "      Los números serían de otro build y no se podría saber cuál.\n" +
                "\n" +
                "      Matlo y vuelve a lanzar:\n" +
                '        pkill -f "next-server"\n' +
                "\n" +
                '      Ojo: `pkill -f "next start"` NO sirve — el proceso se llama\n' +
                "      `next-server`, que es el nombre que le da Next al binario."
        );
        process.exit(1);
    }
    console.log("[cwv] Puerto libre ✓\n");
}

const result = spawnSync("npx", argv, {
    stdio: "inherit",
    env: process.env,
    // `npx` es `.cmd` en Windows; el resto de plataformas no necesita shell.
    shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
