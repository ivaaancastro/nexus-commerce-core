"use client";

import { useState } from "react";
import Header from "@/components/Header";
import SemanticSearchBar from "@/components/SemanticSearchBar";
import ProductCard, { EAGER_CARDS, SEARCH_CARD_SIZES } from "@/components/ProductCard";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { SemanticSearchResult } from "@/types/commerce";

/**
 * Tarea 3.1, R6 — búsqueda semántica.
 *
 * Esta lógica vivía en la home y se mudó aquí tal cual: la portada pasa a ser
 * un menú de secciones y la búsqueda por significado, que es otra intención,
 * tiene su propia ruta accesible desde «Búsqueda Vectorial» del Header.
 *
 * Se creó la ruta antes de vaciar la portada a propósito (riesgo del plan §6):
 * nunca se borra código que funciona sin tener su sustituto en verde.
 */
export default function SearchPage() {
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      setActiveQuery(query);
      setHasSearched(true);
      const found = await api.searchSemantic(query, 12);
      setResults(found);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? getFriendlyErrorMessage(err) : "Fallo en la búsqueda semántica"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResults([]);
    setActiveQuery("");
    setHasSearched(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <SemanticSearchBar
            onSearch={handleSearch}
            onClear={handleClear}
            isLoading={loading}
            activeQuery={activeQuery}
        />

        {error && (
            <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 text-red-800 text-xs">
          <span className="font-semibold uppercase tracking-wider block mb-1">
            Error de conexión
          </span>
              <span className="block">{error}</span>
              <span className="block text-red-700 mt-1">
                Asegúrate de que el backend de Spring Boot está corriendo en el puerto 8080.
              </span>
            </div>
        )}

        <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-200">
          <div>
            <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900">
              Búsqueda Semántica
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              {/* Con un error no se puede afirmar que haya «0 artículos»: sería
                  mentir sobre el resultado de una petición que ni siquiera
                  terminó. */}
              {error
                  ? "La búsqueda no se ha podido completar"
                  : hasSearched
                      ? `${results.length} artículos encontrados por proximidad vectorial`
                      : "Describe lo que buscas: se compara por significado, no por palabra exacta"}
            </p>
          </div>
          {hasSearched && (
              <button
                  onClick={handleClear}
                  className="text-xs uppercase tracking-wider text-neutral-600 hover:text-black underline"
              >
                Limpiar búsqueda
              </button>
          )}
        </div>

        {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
              ))}
            </div>
        )}

        {!loading && hasSearched && (
            <ErrorBoundary>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((item, index) => (
                    <ProductCard
                        key={item.productId}
                        semanticItem={item}
                        sizes={SEARCH_CARD_SIZES}
                        eager={index < EAGER_CARDS}
                    />
                ))}
              </div>
            </ErrorBoundary>
        )}

        {!loading && hasSearched && results.length === 0 && !error && (
            <div className="py-24 text-center">
              <p className="text-sm text-neutral-500 uppercase tracking-wider">
                Sin resultados para «{activeQuery}».
              </p>
            </div>
        )}
      </main>
    </div>
  );
}
