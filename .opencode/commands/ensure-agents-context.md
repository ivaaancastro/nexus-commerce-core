# ✅ Contexto de Agente: Cargar AGENTS.md primero

> **ORDENA DAO:** Siempre lea este archivo y `AGENTS.md` (en `/Users/ivan/nexus-commerce-core/AGENTS.md`) **antes** de comenzar cualquier tarea. Si hay conflicto entre la memoria de sesión y lo que dice este documento, prevalece `AGENTS.md`.

## Estado actual del proyecto (auto-alimentado desde AGENTS.md)

| Campo | Valor (al 2026-10-28) |
|:---|---|
| **Rama activa** | `main` = V4 `product-reviews` + V5 `coupons` + V6 `photos-per-color` mergeadas todas; ramas `feat/coupons` y `feat/photos-per-color` ya integradas |
| **Fase** | **Hoja de ruta 6–10 (producto vendible) — aprobada** — **Fase 6 Deuda técnica (previa), 7.1–7.6 y la mini-feature `product-photos` (fotos IA) completadas** · **Fase 7 panel de administración COMPLETA (7.1–7.6)** · mini-features **`checkout-payment-grid`**, **`final-price-display`** y **`color-and-care`** completadas y **mergeadas** · fases 1–5 y 3.x/4.x completadas · **bloque «Mejoras de vitrina» V1–V6 COMPLETO** (V1 reviews, V2 zoom-lightbox, V3 wishlist, V4 product-reviews, V5 coupons, V6 fotos por color) · **Fase 8 — Operación interna y monitoring COMPLETA** (fuera del bloque V1–V6, PSP desactivada) |
| **Tarea** | **Fase 8 — Operación interna y monitoring** — ✅ **COMPLETADA** (mergeado en `main`): health check extendido, endpoint métricas, scripts mantenimiento, logging JSON, dashboard operativo. Sin features de usuario, foco en operatividad. |
| **Tarea siguiente** | **Definir Fases 9–10** (hoja de ruta) · posibles features nuevas fuera del bloque V1–V6 · mejoras de performance o CX |
| **Pendiente** | **Fases 9–10** por definir · decisión sobre siguientes pasos |
| **Actualizado** | 2026-10-28 |

## Gates y calidad (siempre verificar)

- **ESLint**: 0 errores, 0 warnings ✅
- **TypeScript**: `tsc --noEmit` 0 errores ✅
- **Build**: `npm run build` exitoso ✅
- **Tests backend**: >= 453 unitarios,_EXIT 0 (errores transaccionales por falta de Docker, no por código) ✅
- **Tests frontend**: >= 549 Vitest,_EXIT 0 ✅
- **Cobertura**: umbrales congelados (77/76/74/79), no bajar ✅
- **Axe accessibility**: 14/14 rutas ✅
- **Lighthouse CWV**: 4 rutas × 3 corridas, umbrales congelados ✅

## Features V1–V6 status

| Feature | Spec | Tasks | Tests | Status |
|---------|------|-------|-------|--------|
| **V1 — Product Reviews** | `specs/product-reviews/` | 16 tasks | 453 backend / 549 frontend | ✅ MERGED en `main` |
| **V2 — Zoom/Lightbox** | `specs/zoom-lightbox/` | 11 tasks | Frontend 491 → 491, ESLint 0/0 | ✅ MERGED en `main` |
| **V3 — Wishlist** | `specs/wishlist/` | 18 tasks | Backend 380 → 405, Frontend 491 → 518 | ✅ MERGED en `main` |
| **V4 — Product Reviews (v2)** | `specs/product-reviews/` (revisada) | 15 tasks | Igual que V1 | ✅ MERGED en `main` |
| **V5 — Coupons** | `specs/coupons/` | 16 tasks | Backend 410 → 453, Frontend 470 → 518 | ✅ MERGED en `main` |
| **V6 — Fotos por color** | `specs/photos-per-color/` | 12 tasks | Frontend 518 → 549, 12 imágenes nuevas | ✅ MERGED en `main` |

## Flujo obligatorio SDD

1. **PLAN** → `specs/<feature>/plan.md` (objetivos, decisiones, estimación)
2. **SPEC** → `specs/<feature>/spec.md` (requisitos, API, modelo datos)
3. **APROBAR** → ¡Pedir aprobación explícita al usuario ⛔ PUNTO DE BLOQUEO!
4. **TASKS** → `specs/<feature>/tasks.md` (checklist de implementación)
5. **CODE** → Implementar guiado por tasks.md
6. **VERIFICAR** → `/spec-check <feature>` (código vs spec)
7. **CLOSE** → `/spec-close <feature>` (tests + docs + PR)

## Reglas inviolables (copiar de AGENTS.md §4)

| # | Regla |
|:---|---|
| 1 | **NUNCA** escribir código sin `spec.md` aprobado por el usuario |
| 2 | **SIEMPRE** pedir aprobación explícita antes de implementar |
| 3 | **SIEMPRE** actualizar `spec.md` si el alcance cambia durante la implementación |
| 4 | **SIEMPRE** marcar `tasks.md` al completar cada tarea |
| 5 | **NUNCA** mergear sin pasar `/spec-check` y tests en verde |
| 6 | **SIEMPRE** crear ADR si la feature cambia arquitectura o stack |

## Comandos útiles

```bash
# Ver estado actual
cat AGENTS.md | head -30

# Ejecutar tests backend
cd backend && ./mvnw test -q 2>&1 | tail -5

# Ejecutar tests frontend  
cd frontend && npx vitest run 2>&1 | tail -5

# Ver coverage thresholds
cd frontend && npm run test:coverage 2>&1 | grep -A3 "Environment"

# Crear nueva feature
/ New-feature <nombre>

# Spec-check de una feature
/spec-check <nombre-feature>

# Cierre de feature
/spec-close <feature-name>
```

## Recordatorio crítico

- **Toda feature DEBE tener** `specs/<feature>/` con `plan.md`, `spec.md` y `tasks.md`
- **Ningún código sin spec aprobada** (regla #1)
- **Los umbrales de cobertura están medidos y congelados**, no impuestos: subir es decisión explícita; no bajar
- **CI verde en `main`** es el estado objetivo; cualquier desviación debe documentarse

---
*Este archivo forma parte del sistema de aseguramiento de calidad. Se recomienda su lectura al iniciar cada sesión junto con AGENTS.md.*