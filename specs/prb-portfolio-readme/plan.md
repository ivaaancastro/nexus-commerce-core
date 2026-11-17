# PR B — README de portfolio con capturas de producción 🟠 — plan

> **Estado**: borrador (pendiente de aprobación).  
> **Contexto**: el despliegue Fase 10 (PR A) ya está verificado en producción: Vercel + Render + Neon con Stripe en test mode — pago, confirmación por webhook (`CONFIRMED`) y reembolsos parcial y total desde el panel, visibles en Stripe (AGENTS.md, 2026-11-16).  
> **Objetivo**: ejecutar PR B de la Fase 10 — README de portfolio reescrito, capturas reales de producción, docs técnicos (arquitectura, despliegue, OpenAPI) y revisión de que no queden claves en el repo.

---

## 1. Objetivo

Que un reclutador o visitante pueda, con un clic en el enlace de LinkedIn:

1. Abrir la demo en vivo y entender qué es el proyecto y qué lo hace difícil.
2. Ver capturas reales de producción (no maquetas) del catálogo, ficha, checkout, panel admin y dashboard.
3. Leer un README de portfolio con diagrama de arquitectura, tabla de decisiones con enlaces a ADR y métricas de calidad (tests, E2E, Lighthouse).
4. Tener una guía de despliegue reproducible en `docs/deployment.md`.

---

## 2. Alcance de PR B

| Incluido | Qué se hace |
|:---|:---|
| **README.md** | Reescrito de arriba abajo: pitch, enlace a la demo, capturas reales de producción, diagrama Mermaid de arquitectura, tabla de decisiones con enlaces a ADR, «cómo se construyó» (SDD), credenciales demo, tarjeta de prueba, limitaciones conocidas. |
| **Capturas de producción** | Regenerar `public/landing/*.webp` con `npm run shots -- --force` apuntando a `https://nexus-commerce-core.vercel.app`. |
| **docs/architecture.md** | Diagramas Mermaid: capas del backend, flujo de checkout, flujo de pago con webhook de Stripe. |
| **docs/openapi.json** | Especificación exportada del backend (`/v3/api-docs`). |
| **docs/deployment.md** | Ya existe; revisar que esté actualizado con URLs reales y sin claves. |
| **Revisión de claves** | Comprobar que no se versiona ninguna clave real (`sk_`, `pk_`, `whsec_`, `JWT_SECRET`). |
| **Enlaces rotos** | Revisar enlaces internos del README y docs. |

| Excluido | Qué no se toca |
|:---|:---|
| Código de backend o frontend | No hay cambios funcionales. |
| Migraciones de BD | Ninguna. |
| E2E nuevos | No se añaden; las capturas se generan con `npm run shots`. |
| Despliegue en CI/CD | Queda para Fase 11. |

---

## 3. Decisiones de diseño

| # | Decisión | Justificación |
|:---|:---|:---|
| **D1** | El README se reescribe completo, no se parchea | El actual es una referencia de API de 300+ líneas; un visitante necesita historia primero y referencia después (spec fase10, D10). |
| **D2** | Las capturas son reales de producción, generadas con `npm run shots` | Spec fase10 R11: reproducible, nunca pisa existentes sin `--force`. |
| **D3** | `docs/openapi.json` se exporta del backend desplegado o local con el mismo código | Es la fuente de verdad de la API. |
| **D4** | `docs/architecture.md` usa solo Mermaid | Se renderiza nativamente en GitHub, sin herramientas externas. |
| **D5** | No se versiona ninguna clave real | Seguridad (spec fase10, RNF5). Revisión manual antes de commit. |
| **D6** | La rama es `feat/prb-portfolio-readme` (no `docs/...`) | Convención del proyecto: `feat/` para funcionalidad nueva de documentación de portfolio. |

---

## 4. Riesgos

| Riesgo | Mitigación |
|:---|:---|
| Capturas con datos desactualizados o vacíos | Generarlas contra la URL pública con datos de demo sembrados. |
| Clave secreta filtrada al repo | Revisión de `git diff` y `grep` de `sk_`, `pk_`, `whsec_`, `JWT_SECRET` antes de commit. |
| Enlaces rotos en README | Comprobar que todos los enlaces internos apuntan a archivos existentes. |

---

## 5. Estimación

~medio día: capturas, GIF (opcional), README, docs/architecture.md, revisión y PR.

---

¿Apruebas este plan para proceder con la spec y las tareas?


