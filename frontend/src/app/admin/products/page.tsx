"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Product } from "@/types/commerce";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import Toast from "@/components/Toast";

/**
 * Listado de productos del catálogo (Tarea 7.2, E.3).
 *
 * Cada guardado y cada borrado se reflejan aquí al volver a montar la
 * página (`cache: "no-store"` en `listAdminProducts`): el listado es
 * siempre una lectura fresca de la única fuente de verdad, la BD.
 */
export default function AdminProductsPage() {
    const [productos, setProductos] = useState<Product[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);

    // Carga inicial. La cadena va inline en el efecto: es el patrón aceptado
    // por react-hooks/set-state-in-effect (los setState viven en callbacks de
    // promesa, nunca en el cuerpo del efecto), y el flag `activo` descarta la
    // respuesta si la página se desmonta en mitad de la petición.
    useEffect(() => {
        let activo = true;
        api.listAdminProducts()
            .then((lista) => {
                if (activo) {
                    setProductos(lista);
                    setError(null);
                }
            })
            .catch((err: unknown) => {
                if (activo) setError(getFriendlyErrorMessage(err));
            })
            .finally(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
    }, []);

    async function borrar(producto: Product) {
        const seguro = window.confirm(
            `¿Borrar el producto ${producto.referenceCode}? Se eliminan también sus SKUs, ` +
                "precios y stock. Esta acción no se puede deshacer."
        );
        if (!seguro) return;

        try {
            await api.deleteAdminProduct(producto.id);
            setProductos((prev) => prev.filter((p) => p.id !== producto.id));
            setToastMessage(`Producto ${producto.referenceCode} borrado`);
            setToastVisible(true);
        } catch (err: unknown) {
            // Un 409 («…tiene pedidos asociados») se traduce aquí mismo.
            setError(getFriendlyErrorMessage(err));
        }
    }

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                        Catálogo
                    </p>
                    <h1 className="text-2xl font-medium uppercase tracking-widest">
                        Productos
                    </h1>
                </div>
                <Link
                    href="/admin/products/new"
                    className="bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest px-6 py-3 transition-colors"
                >
                    Nuevo producto
                </Link>
            </div>

            {error && (
                <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs">
                    {error}
                </div>
            )}

            {cargando ? (
                <p
                    role="status"
                    className="text-xs uppercase tracking-widest text-neutral-500 py-12 text-center"
                >
                    Cargando productos...
                </p>
            ) : productos.length === 0 ? (
                <div className="border border-neutral-200 bg-white p-6">
                    <p className="text-sm font-light text-neutral-700">
                        El catálogo está vacío. Crea el primer producto con el
                        botón «Nuevo producto».
                    </p>
                </div>
            ) : (
                <div className="border border-neutral-200 bg-white p-6 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-900 text-[11px] uppercase tracking-widest text-neutral-600 text-left">
                                <th scope="col" className="py-3 pr-4 font-medium">
                                    Referencia
                                </th>
                                <th scope="col" className="py-3 pr-4 font-medium">
                                    Nombre
                                </th>
                                <th scope="col" className="py-3 pr-4 font-medium">
                                    Familia
                                </th>
                                <th scope="col" className="py-3 pr-4 font-medium">
                                    SKUs
                                </th>
                                <th scope="col" className="py-3 font-medium text-right">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {productos.map((producto) => (
                                <tr key={producto.id} className="border-b border-neutral-200">
                                    <td className="py-3 pr-4 text-neutral-900 whitespace-nowrap">
                                        {producto.referenceCode}
                                    </td>
                                    <td className="py-3 pr-4 text-neutral-900">
                                        {producto.name}
                                    </td>
                                    <td className="py-3 pr-4 text-xs uppercase tracking-wide text-neutral-600">
                                        {producto.family}
                                    </td>
                                    <td className="py-3 pr-4 text-neutral-700">
                                        {producto.skus.length}
                                    </td>
                                    <td className="py-3 text-right whitespace-nowrap">
                                        <Link
                                            href={`/admin/products/${producto.id}/edit`}
                                            className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-900 underline underline-offset-4 mr-4"
                                        >
                                            Editar
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => borrar(producto)}
                                            className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
                                        >
                                            Borrar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Toast
                message={toastMessage}
                isVisible={toastVisible}
                onClose={() => setToastVisible(false)}
            />
        </>
    );
}
