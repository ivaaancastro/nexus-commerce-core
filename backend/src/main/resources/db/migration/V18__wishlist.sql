-- V18 — V3 wishlist: favoritos del usuario
-- (spec specs/wishlist/, R1/R2 · plan D1/D2)
--
-- Por qué tablas nuevas y no una columna en `users`:
--
-- 1) UNA LISTA POR USUARIO, garantizada por BD: `wishlists.user_id` es
--    UNIQUE NOT NULL — la última línea de defensa contra duplicados (patrón
--    idempotencia §4.3). El servicio la crea perezosamente en el primer
--    guardado; el GET no escribe (plan D1).
-- 2) SE GUARDA EL PRODUCTO, NO EL SKU (plan D2): tallas, colores y su stock
--    cambian; un favorito apunta a la referencia comercial y la PDP resuelve
--    la variante al añadir a la bolsa. `UNIQUE(wishlist_id, product_id)`
--    impide que un mismo producto aparezca dos veces.
-- 3) CASCADE en producto (no RESTRICT): el panel ya puede borrar productos
--    (7.2) y bloquear el catálogo por un favorito sería peor mal; el cascade
--    deja la lista siempre coherente, sin fantasmas (plan D1/§5 casuística).
-- 4) SIN COLUMNAS DE PRECIOS: los precios que se ven en la lista se piden
--    frescos a `/pricing` con el mercado activo (plan D13, decisión del
--    usuario) — la wishlist jamás snapshota importes.
--
-- `IF NOT EXISTS` reejecutable (patrón V13–V17).

CREATE TABLE IF NOT EXISTS wishlists (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id          BIGSERIAL PRIMARY KEY,
    wishlist_id BIGINT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wishlist_product UNIQUE (wishlist_id, product_id)
);
