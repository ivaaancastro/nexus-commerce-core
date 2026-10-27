-- V19: Sistema de valoraciones y opiniones (V4 Vitrina)
-- Product Reviews: valoración de producto (1-5), título y comentario.

CREATE TABLE IF NOT EXISTS product_reviews (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(100) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Restricción para asegurar una sola reseña por usuario por producto
    CONSTRAINT uk_product_user_review UNIQUE (product_id, user_id)
);

CREATE INDEX idx_reviews_product ON product_reviews(product_id);
