-- 1. Habilitar la extensión de vectores en PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Crear la tabla del Vector Store gestionada por Spring AI
-- gen_random_uuid() es nativo en PostgreSQL 16 (no requiere extensiones adicionales)
CREATE TABLE IF NOT EXISTS vector_store (
                                            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                            content TEXT,
                                            metadata JSONB,
                                            embedding VECTOR(1536)
);

-- 3. Índice HNSW para búsqueda por distancia de coseno de alta velocidad
CREATE INDEX IF NOT EXISTS vector_store_embedding_idx
    ON vector_store USING hnsw (embedding vector_cosine_ops);