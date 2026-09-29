"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import SemanticSearchBar from "@/components/SemanticSearchBar";
import ProductCard from "@/components/ProductCard";
import { api } from "@/lib/api";
import { Product, SemanticSearchResult } from "@/types/commerce";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial del catálogo relacional estándar
  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProducts();
      setProducts(data);
      setSemanticResults([]);
      setActiveQuery("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al conectar con el backend");
    } finally {
      setLoading(false);
    }
  };

  const handleSemanticSearch = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      setActiveQuery(query);
      const results = await api.searchSemantic(query, 12);
      setSemanticResults(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fallo en la búsqueda semántica");
    } finally {
      setLoading(false);
    }
  };

  const isSemanticView = activeQuery.length > 0;

  return (
      <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
        <Header />

        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          <SemanticSearchBar
              onSearch={handleSemanticSearch}
              onClear={loadCatalog}
              isLoading={loading}
              activeQuery={activeQuery}
          />

          {error && (
              <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 text-red-800 text-xs">
            <span className="font-semibold uppercase tracking-wider block mb-1">
              Error de conexión
            </span>
                {error}. Asegúrate de que el backend de Spring Boot está corriendo en el puerto 8080.
              </div>
          )}

          <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-200">
            <div>
              <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900">
                {isSemanticView ? "Resultados de Búsqueda Semántica" : "Catálogo General"}
              </h1>
              <p className="text-xs text-neutral-500 mt-1">
                {isSemanticView
                    ? `${semanticResults.length} artículos encontrados por proximidad vectorial`
                    : `${products.length} prendas registradas en inventario`}
              </p>
            </div>
            {isSemanticView && (
                <button
                    onClick={loadCatalog}
                    className="text-xs uppercase tracking-wider text-neutral-600 hover:text-black underline"
                >
                  Volver al catálogo completo
                </button>
            )}
          </div>

          {loading && (
              <div className="py-24 text-center text-xs uppercase tracking-widest text-neutral-400">
                Consultando núcleo transaccional...
              </div>
          )}

          {!loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {isSemanticView
                    ? semanticResults.map((item) => (
                        <ProductCard key={item.productId} semanticItem={item} />
                    ))
                    : products.map((item) => (
                        <ProductCard key={item.id} product={item} />
                    ))}
              </div>
          )}

          {!loading && (isSemanticView ? semanticResults.length === 0 : products.length === 0) && (
              <div className="py-24 text-center">
                <p className="text-sm text-neutral-500 uppercase tracking-wider">
                  No se han encontrado prendas con los criterios solicitados.
                </p>
              </div>
          )}
        </main>
      </div>
  );
}