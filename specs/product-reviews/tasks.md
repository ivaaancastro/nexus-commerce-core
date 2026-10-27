# Tasks — V4: Valoraciones y opiniones de producto (Reviews)

> Rama `feat/product-reviews` · spec aprobada [fecha] · Estimación: M.
> Basado en `plan.md` y `spec.md`.

## Backend
- [x] **T1** — Migración Flyway `V19__product_reviews.sql`
- [x] **T2** — Entidad `ProductReview` y `ProductReviewRepository` (con consultas de agregación)
- [x] **T3** — `ProductReviewService`: lógica de negocio para crear, listar y moderar reviews
- [x] **T4** — `ProductReviewController` (público/user/admin)
- [x] **T5** — Tests de servicio y controlador (JaCoCo gate EXIT 0)

## Frontend
- [x] **T6** — Tipos y `api.ts`: añadir `ProductReview` y endpoints
- [x] **T7** — Componente `StarRating` (estilo Zara)
- [x] **T8** — `ProductReviewsSection` en la PDP (listado + formulario)
- [x] **T9** — Vista de moderación en `/admin/reviews`
- [x] **T10** — Tests de componentes (Vitest) y cobertura (gate EXIT 0)

## Verificación y Gates
- [x] **T11** — `npm run test:coverage` (umbrales intactos) · `tsc` 0 · `lint` 0 · `build` 0
- [x] **T12** — Verificación programática: usuario deja reseña, se refleja en PDP, administrador la borra en panel
- [x] **T13** — `npx playwright test e2e/a11y.spec.ts` (axe 14/14 + nuevas rutas)

## Cierre
- [x] **T14** — `/spec-check product-reviews` → aprobado
- [x] **T15** — CHANGELOG (Added) + bloques ESTADO ACTUAL en `AGENTS.md` y `MEMORY.md` (dentro de la PR)
- [x] **T16** — ⛔ Pedir permiso commit/push/PR
