# Spec — V4: Valoraciones y opiniones de producto (Reviews)

> **Feature `product-reviews`** · especificación funcional y técnica · **⏳ pendiente de aprobación**.
> Basado en `plan.md` (D1–D8).

---

## 1. Contexto y Requisitos Funcionales

La V4 introduce la capacidad de que los clientes de la tienda con cuenta verificada dejen valoraciones y opiniones en los productos del catálogo, y que el administrador pueda moderarlas.

- **R1 — Puntuación media en PDP**: cada ficha de producto muestra la media de estrellas y el número total de reseñas (ej. `★ 4.8 / 5 (12)`). Si no hay opiniones, muestra «Sin opiniones todavía».
- **R2 — Listado de opiniones**: sección dedicada en la parte inferior de la PDP con el desglose de comentarios, autor enmascarado, fecha de publicación, puntuación y texto de la reseña.
- **R3 — Creación de reseña**: los usuarios autenticados pueden enviar una reseña rellenando una puntuación (1 a 5), un título obligatorio y un comentario. Si el usuario ya dejó una reseña para ese producto, el sistema impide duplicados devolviendo un código semántico `409` (con mensaje amigable «Ya has publicado una opinión para este producto»).
- **R4 — Moderación administrativa**: el rol `ADMIN` dispone de una vista en el panel de administración para listar todas las opiniones de la plataforma y eliminarlas individualmente.

---

## 2. Requisitos Técnicos y Arquitectura

### 2.1 Base de datos (`V19__product_reviews.sql`)
```sql
CREATE TABLE IF NOT EXISTS product_reviews (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(100) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_product_user_review UNIQUE (product_id, user_id)
);

CREATE INDEX idx_reviews_product ON product_reviews(product_id);
```

### 2.2 DTOs (Records Java)
- `ReviewResponse`: id, productId, userEmail (o nombre enmascarado), rating, title, comment, createdAt.
- `ReviewSummaryResponse`: averageRating (Double), totalReviews (Long), breakdown (mapa o lista con conteo por estrella).
- `CreateReviewRequest`: `@NotNull @Min(1) @Max(5) Integer rating`, `@NotBlank @Size(max=100) String title`, `String comment`.

### 2.3 Endpoints REST
- `GET /api/v1/products/{productId}/reviews` → `ReviewSummaryResponse` con la lista de opiniones.
- `POST /api/v1/products/{productId}/reviews` → `ReviewResponse` (requiere autenticación `USER`/`ADMIN`).
- `DELETE /api/v1/products/{productId}/reviews/{reviewId}` → `204 No Content` (propietario o admin).
- `GET /api/v1/admin/reviews` → Listado paginado/general para moderación (requiere `ADMIN`).
- `DELETE /api/v1/admin/reviews/{reviewId}` → `204 No Content` (requiere `ADMIN`).

### 2.4 Seguridad (`SecurityConfig`)
- Las rutas bajo `/api/v1/admin/reviews/**` heredan el filtro `hasRole("ADMIN")`.
- Las rutas `POST` y `DELETE` de usuario bajo `/api/v1/products/{id}/reviews/**` exigen autenticación (`.authenticated()`).
- Las lecturas (`GET`) son públicas (`.permitAll()`).

---

## 3. Criterios de Aceptación y Gates

1. **Backend**: compilación limpia, migración Flyway `V19` aplicada correctamente, tests unitarios y de integración pasando.
2. **Frontend**: tipado estricto en TypeScript (`src/types/commerce.ts`), cliente API en `src/lib/api.ts`, componentes renderizados correctamente en la PDP y en el panel de administración.
3. **Gates**: 
   - `npm run test:coverage` sin bajar umbrales.
   - `tsc --noEmit` 0 errores.
   - ESLint 0 errores, 0 warnings.
   - `npm run build` exitoso.
