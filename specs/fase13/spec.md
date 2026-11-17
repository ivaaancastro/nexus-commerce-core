# Fase 13 — Lanzamiento LinkedIn — spec

> **Estado**: borrador (pendiente de aprobación del usuario).

## Requisitos

### R1 — README para el visitante
- R1.1 Bloque **«Pruébalo en 1 minuto»** al inicio, antes de la arquitectura: enlace a la demo, pasos numerados (entrar con `demo@nexus.dev`, añadir al carrito, pagar con `4242 4242 4242 4242`, ver el pedido *Confirmado*, entrar como admin y ver pedidos/dashboard).
- R1.2 Tabla de **cuentas y tarjetas de prueba**: `4242…` (éxito), `4000 0027 6000 3184` (3D Secure), `4000 0000 0000 9995` (fondos insuficientes), fecha futura y CVC cualquiera.
- R1.3 **GIF** embebido (con enlace al MP4) y aviso de que el backend gratuito tarda ~50 s en despertar.
- R1.4 Resumen del stack y cifras reales (tests, ADR, specs) sin inventar: se leen del repo.
- R1.5 Sección **«Cómo se construyó»** ampliada: SDD aplicado con **opencode y Claude Code** como agentes, comandos `/new-feature`, `/spec-check`, `/spec-close`, `AGENTS.md`/`MEMORY.md` como contexto persistente. Honesto: un solo autor dirige y aprueba cada spec.
- R1.6 El contenido existente (limitaciones, ADR, CI/CD) **no se elimina**.

### R2 — Vídeo y GIF
- R2.1 Recorrido: catálogo → ficha → bolsa → checkout/pago → pedido *Confirmado* → panel admin (pedidos) → dashboard. 60-90 s.
- R2.2 Salidas: `docs/media/nexus-demo.mp4` (H.264, 1280×720) y `docs/media/nexus-demo.gif` (< 10 MB).
- R2.3 Script reproducible en `frontend/scripts/` con esperas condicionales (nada de `waitForTimeout` fijo, salvo ritmo de grabación documentado), sin credenciales reales ni claves.
- R2.4 Pago simulado según D3; se informa del resultado y, si no convence, se deja el hueco para que lo grabe el usuario.

### R3 — Release y repo
- R3.1 Tag y release **`v1.0.0`** en GitHub con notas (qué es, cómo probarlo, destacados, calidad medida, limitaciones, vídeo).
- R3.2 Descripción del repo y *topics* actualizados (java, spring-boot, nextjs, stripe, postgresql, pgvector, playwright, spec-driven-development, ecommerce…).
- R3.3 Ambas acciones se ejecutan **solo tras confirmación explícita** del usuario, después del merge del PR.

### R4 — Textos de LinkedIn (`docs/linkedin.md`)
- R4.1 **Proyecto**: nombre, descripción (≤ 2 000 caracteres), aptitudes (máx. 5 destacadas + el resto), enlace, fechas (sep 2026 – nov 2026), «en solitario».
- R4.2 **Post** en español con gancho, qué hace, cómo probarlo, mención del flujo SDD con opencode y Claude Code, y hashtags. Vídeo adjunto.
- R4.3 Sin datos personales ni claves.

## Criterios de aceptación
- El README renderiza bien en GitHub (GIF visible, enlaces válidos, comprobado con `gh`/navegador).
- Los pasos de R1.1 funcionan realmente contra producción (comprobado).
- MP4 reproducible y GIF < 10 MB.
- Release visible con el tag `v1.0.0`.
- Sin cambios en `frontend/src`, `backend/` ni `e2e/` (diff = 0); CI no se rompe.
