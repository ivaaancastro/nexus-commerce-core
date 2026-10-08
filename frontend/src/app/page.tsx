"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { FamilyResponse } from "@/types/commerce";

/**
 * Tarea 3.1, R3 — portada de la aplicación.
 *
 * Al entrar a la app se ve un **menú de secciones**, no un listado de productos:
 * es lo que pedía la tarea («un menú de inicio estilo Zara del que tú eliges
 * hacia dónde ir»). Cada familia es un acceso grande que navega a su sección,
 * donde ya están los filtros y el scroll continuo.
 *
 * La home dejó de cargar productos y de mostrar la barra de búsqueda semántica:
 * la primera se listaba igual que en `/catalog` y la segunda se mudó a `/search`
 * (R6). No hay duplicación de catálogo entre rutas.
 *
 * El menú se pinta **exclusivamente** de `GET /products/families` (R1): la
 * taxonomía es dato del servidor, no algo que se reduzca en cliente con un
 * `Set` sobre la lista de productos.
 */
export default function HomePage() {
  const [families, setFamilies] = useState<FamilyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadFamilies = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getFamilies();
        if (!cancelled) setFamilies(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? getFriendlyErrorMessage(err)
              : "Error al conectar con el backend"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFamilies();

    // El componente puede desmontarse al navegar: no se escribe estado tras eso.
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPrendas = families.reduce((acc, item) => acc + item.productCount, 0);

  // «1 prendas en 1 secciones» no es castellano. El singular se resuelve fuera
  // del JSX para que el contador no dependa de cómo se maquete la línea.
  const plural = (n: number, uno: string, muchos: string) =>
      `${n} ${n === 1 ? uno : muchos}`;
  const textoRecuento =
      `${plural(totalPrendas, "prenda", "prendas")} en ` +
      plural(families.length, "sección", "secciones");

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12">
        <header className="mb-10 pb-6 border-b border-neutral-200">
          <h1 className="text-lg font-medium uppercase tracking-widest text-neutral-900">
            Colección
          </h1>
          <p className="text-xs text-neutral-500 mt-2 uppercase tracking-wide">
            {loading
                ? "Cargando secciones…"
                : error
                    ? "No se pudieron cargar las secciones"
                    : textoRecuento}
          </p>
        </header>

        {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-800 text-xs">
          <span className="font-semibold uppercase tracking-wider block mb-1">
            Error de conexión
          </span>
              <span className="block">{error}</span>
              <span className="block text-red-700 mt-1">
                Asegúrate de que el backend de Spring Boot está corriendo en el puerto 8080.
              </span>
            </div>
        )}

        {loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                  <div
                      key={i}
                      className="min-h-[18rem] bg-neutral-100 animate-pulse border border-neutral-200"
                  />
              ))}
            </div>
        )}

        {!loading && !error && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {families.map((item) => (
                  <Link
                      key={item.family}
                      href={`/catalog?family=${encodeURIComponent(item.family)}`}
                      className="group min-h-[18rem] flex flex-col justify-between p-8 bg-white border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-900 transition-all duration-300"
                  >
                    <span className="text-[10px] uppercase tracking-widest text-neutral-600 group-hover:text-neutral-400">
                      {item.productCount} {item.productCount === 1 ? "prenda" : "prendas"}
                    </span>

                    <div>
                      <h2 className="text-2xl font-medium uppercase tracking-widest text-neutral-900 group-hover:text-white transition-all duration-300">
                        {item.family}
                      </h2>
                      <span className="mt-4 inline-block text-xs uppercase tracking-wide text-neutral-500 group-hover:text-neutral-300 transition-all duration-300">
                        Explorar →
                      </span>
                    </div>
                  </Link>
              ))}
            </div>
        )}

        {!loading && !error && families.length === 0 && (
            <div className="py-24 text-center">
              <p className="text-sm text-neutral-500 uppercase tracking-wider">
                No hay secciones disponibles.
              </p>
            </div>
        )}
      </main>
    </div>
  );
}
