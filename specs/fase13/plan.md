# Fase 13 — Lanzamiento LinkedIn — plan

> **Estado**: borrador (pendiente de aprobación del usuario). Requisitos en `spec.md`.

## 1. Objetivo

Preparar el proyecto para su difusión en LinkedIn: que quien llegue desde el perfil o el post entienda en 1 minuto qué es, lo pruebe sin fricción y vea cómo se construyó. Entregables: **README orientado al visitante**, **vídeo (MP4) + GIF** de la demo, **release `v1.0.0` en GitHub**, **repo con descripción y topics** y **textos listos para copiar** (proyecto de LinkedIn y post).

## 2. Situación de partida (medida)

| Hecho | Consecuencia |
|:---|:---|
| README con demo, cuentas, tarjeta `4242…` y limitaciones (líneas 13-35) | Falta un bloque «Pruébalo en 1 minuto» con pasos, vídeo y mención del flujo con IA |
| 0 tags y 0 releases | Se crea `v1.0.0` |
| Repo público, descripción «gestión de inventario», sin topics | Se actualizan (acción pública → confirmación) |
| Primer commit 2026-09-15, último 2026-11-17, 422 commits, un solo autor | Fechas del proyecto de LinkedIn: sep 2026 – nov 2026, en solitario |
| Backend de Render duerme (~50 s) | Se despierta antes de grabar y el README ya lo avisa |
| Stripe lanza hCaptcha a navegadores automatizados | El pago del vídeo se **simula** (PaymentIntent confirmado por API); si queda mal, el usuario graba ese tramo |
| `ffmpeg` y Playwright disponibles; no hay `gifsicle` | MP4 y GIF con `ffmpeg` (paleta) |

## 3. Decisiones

| # | Decisión |
|:--|:---|
| D1 | Idioma: **español** (README, release, textos de LinkedIn) |
| D2 | Vídeo grabado con Playwright **sobre producción** (viewport 1280×720, ritmo humano) y recodificado con `ffmpeg`; **MP4** para LinkedIn (≤ 90 s) y **GIF** < 10 MB para el README. Se guardan en `docs/media/` |
| D3 | Pago simulado confirmando el PaymentIntent por API (patrón de `e2e/payments.spec.ts`); si el resultado no convence, lo graba el usuario |
| D4 | Release **`v1.0.0`** con notas redactadas desde el CHANGELOG, sin números de PR ni SHA |
| D5 | Se refleja el proceso de desarrollo: **SDD + opencode + Claude Code** (comandos `/new-feature`, `/spec-check`, `/spec-close`, `AGENTS.md`, `MEMORY.md`, 38 specs, 8 ADR) |
| D6 | Los textos de LinkedIn (nombre, descripción, aptitudes, post) van en `docs/linkedin.md`; **los pega el usuario** (no se opera su perfil) |
| D7 | **Sin código de aplicación, sin migración, sin ADR y sin PR de documentación de cierre** (regla 13). Solo docs, medios y release |

## 4. Riesgos

| Riesgo | Mitigación |
|:---|:---|
| Backend dormido durante la grabación | Despertar con `curl` y reintentar; esperas condicionales, no fijas |
| Datos demo alterados por visitantes | `reset-demo.sh` antes de grabar si hace falta |
| GIF demasiado pesado | Reducir fps/anchura; el MP4 es el principal |
| Afirmaciones sobre IA inexactas | Redactar solo lo que consta en el repo (AGENTS.md, `.opencode/`, specs) |

## 5. Estimación

~1 sesión: spec → README → vídeo → release → textos.
