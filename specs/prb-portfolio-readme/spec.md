# PR B — README de portfolio con capturas de producción 🟠 — spec

> **Estado**: borrador (pendiente de aprobación).  
> **Plan**: `specs/prb-portfolio-readme/plan.md`.  
> **Base**: fase 10 spec §8 (PR B) y plan.md de esta misma feature.

---

## 1. Requisitos funcionales

| # | Requisito |
|:---|:---|
| **R1** | **README.md reescrito**: pitch de 3 líneas, enlace a la demo en vivo (`https://nexus-commerce-core.vercel.app`), enlace a la landing (`/proyecto`), capturas reales de producción (6: catálogo, ficha, carrito/checkout, pago, panel admin, dashboard), credenciales demo (`demo@nexus.dev` / `Demo1234!` y `admin@nexus.dev` / `Admin1234!`), tarjeta de prueba `4242 4242 4242 4242`, aviso de despertar del backend y limitaciones conocidas (Stripe hCaptcha, Apple Pay no verificado, `GET /orders/{n}` sin check de propietario). |
| **R2** | **Diagrama de arquitectura en Mermaid** en el README: frontend (Vercel) → backend (Render Docker) → Neon (PostgreSQL + pgvector) → Stripe (webhook). |
| **R3** | **Tabla de decisiones clave** con enlace a cada ADR (`docs/adr/`): JWT en claim `role`, rechazo de claves Stripe live, modo demo, perfil `prod`, proxy sin CORS, etc. |
| **R4** | **«Cómo se construyó»**: ciclo SDD (spec → plan → tasks → código → spec-check → close), métricas de calidad (527 backend + 606 frontend tests, E2e rápido 33/33, axe 18/18, Lighthouse 5/5), cobertura (83,88/78,87/81,48/85,9). |
| **R5** | **Capturas de producción**: `public/landing/catalogo.webp`, `ficha.webp`, `carrito.webp`, `pago.webp`, `admin-pedidos.webp`, `dashboard.webp` regeneradas con `SHOTS_BASE_URL=https://nexus-commerce-core.vercel.app npm run shots -- --force`. WebP, 1600 px de ancho, `next/image` con `sizes` y CLS 0. |
| **R6** | **docs/architecture.md**: diagramas Mermaid de (a) capas del backend, (b) flujo de checkout, (c) flujo de pago con webhook firmado de Stripe. |
| **R7** | **docs/openapi.json**: especificación OpenAPI 3 del backend (exportada de `/v3/api-docs`). |
| **R8** | **docs/deployment.md** revisado: tabla de variables sin claves reales, URLs públicas reales (Vercel, Render, Neon), pasos verificados. |
| **R9** | **Sin claves en el repo**: ni `sk_`, `pk_`, `whsec_`, `JWT_SECRET` ni ningún otro secreto versionado. |
| **R10** | **Enlaces internos válidos**: todos los enlaces del README y docs apuntan a archivos o URLs existentes. |

---

## 2. Requisitos no funcionales

| # | Requisito |
|:---|:---|
| **RNF1** | Sin cambios de código en backend ni frontend (solo docs + assets estáticos). |
| **RNF2** | Las capturas se generan con Playwright contra la URL pública; sin `--force` no se sobreescriben existentes. |
| **RNF3** | `tsc` 0, ESLint 0/0, build 0 (capturas son assets estáticos, no afectan al build de Next). |
| **RNF4** | Ningún secreto en `git diff` antes de commit. |

---

## 3. Ficheros previstos

| Fichero | Acción |
|:---|:---|
| `README.md` | Reescrito completo |
| `frontend/public/landing/catalogo.webp` | Regenerado (producción) |
| `frontend/public/landing/ficha.webp` | Regenerado (producción) |
| `frontend/public/landing/carrito.webp` | Regenerado (producción) |
| `frontend/public/landing/pago.webp` | Regenerado (producción) |
| `frontend/public/landing/admin-pedidos.webp` | Regenerado (producción) |
| `frontend/public/landing/dashboard.webp` | Regenerado (producción) |
| `docs/architecture.md` | Nuevo, diagramas Mermaid |
| `docs/openapi.json` | Nuevo, exportado del backend |
| `docs/deployment.md` | Revisado (URLs reales, sin claves) |
| `specs/prb-portfolio-readme/tasks.md` | Checklist de implementación |

---

## 4. Criterios de aceptación

- [ ] README reescrito con pitch, demo, capturas reales, diagrama Mermaid, tabla de decisiones, métricas y limitaciones.
- [ ] 6 capturas de producción en `public/landing/`, generadas contra `https://nexus-commerce-core.vercel.app`.
- [ ] `docs/architecture.md` con 3 diagramas Mermaid (capas, checkout, pago webhook).
- [ ] `docs/openapi.json` presente y válido.
- [ ] `docs/deployment.md` con URLs reales y sin claves secretas.
- [ ] `git diff` no contiene `sk_`, `pk_`, `whsec_`, `JWT_SECRET` ni ningún otro secreto.
- [ ] Enlaces internos del README y docs válidos.
- [ ] `tsc` 0, ESLint 0/0, build 0.

---

¿Apruebas esta spec para proceder con las tareas?


