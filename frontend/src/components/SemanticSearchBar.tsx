"use client";

import { useState } from "react";

interface SemanticSearchBarProps {
    onSearch: (query: string) => void;
    onClear: () => void;
    isLoading: boolean;
    activeQuery: string;
}

export default function SemanticSearchBar({
                                              onSearch,
                                              onClear,
                                              isLoading,
                                              activeQuery,
                                          }: SemanticSearchBarProps) {
    const [input, setInput] = useState(activeQuery);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSearch(input.trim());
        }
    };

    const handleReset = () => {
        setInput("");
        onClear();
    };

    return (
        <div className="w-full max-w-3xl mx-auto my-10 px-4">
            <form onSubmit={handleSubmit} className="relative">
                <div className="flex items-center border-b-2 border-neutral-900 pb-2 focus-within:border-black transition-colors">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe lo que buscas: estilo, tejido, corte u ocasión (ej: traje lino para boda)..."
                        className="w-full text-base sm:text-lg bg-transparent outline-none placeholder:text-neutral-400 text-neutral-900 pr-24"
                    />
                    <div className="absolute right-0 flex items-center space-x-2">
                        {activeQuery && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="text-xs uppercase tracking-wider text-neutral-400 hover:text-black px-2 py-1 transition-colors"
                            >
                                Limpiar
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="bg-neutral-900 text-white text-xs uppercase tracking-widest px-4 py-2 hover:bg-black transition-all disabled:opacity-40"
                        >
                            {isLoading ? "Buscando..." : "Buscar"}
                        </button>
                    </div>
                </div>
            </form>

            <div className="flex items-center justify-between mt-3 text-[11px] text-neutral-500 uppercase tracking-wider">
                <span>Powered by pgvector & text-embedding-3-small</span>
                <span className="hidden sm:inline">HNSW Similarity Threshold &ge; 0.65</span>
            </div>
        </div>
    );
}