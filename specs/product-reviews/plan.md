# Plan — V4: Valoraciones y opiniones de producto (Reviews)

> **Bloque de Vitrina V4** · documento de diseño (D1–D8) · **⏳ pendiente de aprobación**.
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md` (se escribe tras la aprobación).

---

## 1. Objetivo

Añadir un sistema de **valoraciones y opiniones (reviews)** en la ficha de producto (PDP) para mejorar la confianza del comprador y enriquecer el catálogo con prueba social, manteniendo estrictamente el estilo editorial Zara.

**Resultado esperado**: 
1. Los usuarios (autenticados) pueden dejar una reseña en los productos (con puntuación de 1 a 5 estrellas, título y comentario opcional).
2. La PDP muestra la **puntuación media** (estrellas + conteo de opiniones) junto al título/precio y una sección de **opiniones de clientes** con paginación o listado colapsado.
3. El panel de administración gana una sección o vista para moderar/borrar opiniones inadecuadas.
4. Persistencia transaccional segura sin afectar al rendimiento del catálogo (con índices adecuados).

---

## 2. Decisiones de diseño (D1–D8)

### D1 — Modelo de datos relacional y migración Flyway (`V19`)
- Nueva tabla `product_reviews`:
  - `id` (PK, BigInt)
  - `product_id` (FK a `products` `ON DELETE CASCADE`)
  - `user_id` (FK a `users` `ON DELETE CASCADE`)
  - `rating` (Integer, restricción `CHECK (rating BETWEEN 1 AND 5)`)
  - `title` (VARCHAR(100), opcional/obligatorio según spec)
  - `comment` (TEXT, opcional)
  - `created_at` (TIMESTAMPTZ, default `CURRENT_TIMESTAMP`)
- **Restricción de unicidad**: `UNIQUE(product_id, user_id)` — un usuario solo puede dejar **una reseña por producto** (evita spam y valoraciones duplicadas).

### D2 — Endpoints REST bajo `/api/v1/products/{productId}/reviews`
- `GET /api/v1/products/{productId}/reviews` (público): lista las opiniones del producto con paginación y resumen de estrellas (media y total).
- `POST /api/v1/products/{productId}/reviews` (autenticado, `USER`/`ADMIN`): crea o actualiza la opinión del usuario actual para ese producto.
- `DELETE /api/v1/products/{productId}/reviews/{reviewId}` (autenticado, propietario o `ADMIN`): borra la opinión.
- `DELETE /api/v1/admin/reviews/{reviewId}` (solo `ADMIN`): moderación rápida desde el panel.

### D3 — Agregación eficiente en base de datos
- Para evitar calcular la media en memoria recorriendo toda la tabla, el backend expondrá el resumen (media de estrellas, total de valoraciones y distribución 1–5) junto con la lista de opiniones o en un endpoint de estadísticas de producto para renderizado instantáneo en la PDP.

### D4 — Integración en la PDP (Estilo Zara)
- **Cabecera de producto**: debajo de la referencia/familia o del precio, se muestran estrellas minimalistas (`★ 4.8 / 5 (24 opiniones)`) que al hacer clic hacen scroll suave hasta la sección de opiniones.
- **Sección de opiniones**: lista limpia con tipografía ligera (`font-light`), fecha, autor (nombre enmascarado ej. *Ana M.* o email resumido), título en `uppercase tracking-wider` y comentario.
- **Formulario de reseña**: botón «Escribir opinión» (visible solo si el usuario ha iniciado sesión) que despliega un formulario minimalista de 1–5 estrellas interactivas, título y caja de texto.

### D5 — Moderación en el Panel de Administración
- Nueva sección «Opiniones» en el panel de administración (`/admin/reviews`) para que el operador pueda auditar las valoraciones y eliminarlas si incumplen las normas de la tienda.

### D6 — Manejo de errores y validaciones (`jakarta.validation`)
- `rating`: `@NotNull @Min(1) @Max(5)`
- `title`: `@NotBlank @Size(max = 100)`
- Mensajes de error claros traducidos con `getFriendlyErrorMessage()`. Si el usuario ya opinó, el backend devuelve un conflicto controlado (`409 REVIEW_CONFLICT`) o actualiza la reseña (upsert limpio). Decisión: **Upsert limpio** (`POST` actualiza si ya existe) o `409` si se prefiere una sola opinión inmutable; optaremos por **una opinión por usuario (crear única, y permitir editar mediante PUT o prohibir duplicados con 409)**. Hagamos `409` si ya existe, con opción de borrar y volver a escribir.

### D7 — Pruebas unitarias, de integración y cobertura
- Tests en Spring Boot para el servicio y repositorio de reviews.
- Tests de componentes en Vitest para las estrellas, la lista de opiniones y el formulario de la PDP.
- Mantenimiento de los umbrales de cobertura congelados.

### D8 — Sin ADR / sin PR de documentación de cierre
- Siguiendo el convenio del proyecto, se documenta en el plan/spec/tasks y se cierra con el bloque de estado actualizado dentro de la PR.

---

## 3. Alcance y no-alcance

| En alcance | Fuera de alcance |
|:---|:---|
| Tabla `product_reviews` + migración `V19` | Reseñas anónimas (exigen cuenta verificada) |
| Endpoints públicos y protegidos de reviews | Sistema de valoraciones de utilidad («¿Te ha sido útil esta opinión?») |
| Widget de estrellas y listado en PDP | Moderación avanzada con IA o filtrado de palabras prohibidas |
| Formulario de envío y edición de opiniones | Pasarela de verificación de compra obligatoria (cualquier usuario registrado puede opinar) |
| Panel de administración para borrado | |

---

## 4. Estimación y orden de trabajo

1. **Backend**: Migración Flyway `V19`, entidad `ProductReview`, repositorio con consultas de agregación, servicio transaccional y controlador REST.
2. **Frontend (Tipos y API)**: Actualizar `src/types/commerce.ts` y añadir métodos en `src/lib/api.ts`.
3. **Frontend (Componentes PDP)**: Componente de estrellas (`StarRating`), sección de opiniones (`ProductReviews`) y formulario de envío.
4. **Frontend (Panel Admin)**: Vista `/admin/reviews` para moderación.
5. **Tests y Gates**: Pruebas unitarias de backend, tests frontend de componentes, verificación de cobertura, `tsc`, linter y build.
