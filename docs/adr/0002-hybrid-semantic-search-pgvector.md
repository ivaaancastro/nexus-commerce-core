# ADR-0002: Búsqueda Semántica Híbrida con PostgreSQL y pgvector

* **Estado:** Aprobado
* **Fecha:** 2026-09-27
* **Decisores:** Equipo Nexus Core

---

## 1. Contexto y Problema

En un e-commerce textil moderno, la búsqueda tradicional léxica (SQL `LIKE` o índices Full-Text Search) falla cuando los usuarios buscan por conceptos abstractos (*"outfit formal para cena en la playa"* o *"prenda ligera que no marque los hombros"*).

Para resolver esto se requiere un sistema de embeddings vectoriales. Sin embargo, introducir una base de datos vectorial externa dedicada (Pinecone, Qdrant, Milvus) o un clúster de Elasticsearch añade:
1. Complejidad operativa y costes de infraestructura adicionales.
2. Latencia de sincronización y riesgo de inconsistencia eventual entre el catálogo transaccional (PostgreSQL) y el motor de búsqueda (patrón Outbox / CDC).

---

## 2. Decisiones Tomadas

### 2.1 Base Vectorial Integrada: PostgreSQL + `pgvector`
* **Decisión:** Mantener PostgreSQL 16 como almacenamiento único utilizando la extensión nativa **`pgvector`** (`pgvector/pgvector:pg16`).
* **Motivo:** Permite almacenar vectores junto a las tablas relacionales bajo garantías ACID completas. Evitamos dependencias externas y simplificamos el backup y despliegue a una sola base de datos.

### 2.2 Indexación con Algoritmo HNSW (*Hierarchical Navigable Small World*)
* **Decisión:** Crear el índice vectorial en `vector_store` mediante `USING hnsw (embedding vector_cosine_ops)`.
* **Motivo:** HNSW ofrece un rendimiento de consulta superior a IVFFlat: no requiere reentrenamiento tras inserciones continuas y mantiene tiempos de respuesta sub-milisegundo en búsquedas por similitud de coseno.

### 2.3 Abstracción de Vector Store vía Spring AI
* **Decisión:** Implementar las consultas mediante la interfaz `VectorStore` de Spring AI (`PgVectorStore`) desacoplada con el modelo `text-embedding-3-small` (1536 dimensiones).
* **Motivo:** Permite consultar similitud con un umbral estricto (`similarityThreshold >= 0.65`) y cambiar de proveedor de embeddings si fuera necesario sin tocar el código de negocio.

---

## 3. Consecuencias

### Positivas
* Búsqueda por lenguaje natural de alta precisión sin salir del motor PostgreSQL.
* Cero desfase de datos: el catálogo y los vectores residen en la misma instancia de base de datos.
* Tests unitarios deterministas y desacoplados del cómputo vectorial mediante mocks del `VectorStore`.

### Compromisos Asumidos
* Los índices HNSW consumen memoria RAM adicional en el servidor PostgreSQL para mantener el grafo navegable en caché.