"use client";

import BackLink from "@/components/BackLink";
import AdminProductForm from "@/components/AdminProductForm";

/**
 * Alta de producto (Tarea 7.2, E.4).
 *
 * La referencia es la clave natural del sistema (manifiesto de imágenes,
 * migraciones idempotentes): se fija aquí y no podrá cambiarse después.
 */
export default function NuevoProductoPage() {
    return (
        <>
            <BackLink href="/admin/products" label="Volver a productos" />

            <div className="flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                    Catálogo
                </p>
                <h1 className="text-2xl font-medium uppercase tracking-widest">
                    Nuevo producto
                </h1>
                <p className="text-sm font-light text-neutral-700">
                    La referencia se fija al crearla y después es inmutable.
                    Los precios y el stock de sus SKUs se asignan aparte.
                </p>
            </div>

            <div className="border border-neutral-200 bg-white p-6 max-w-2xl">
                <AdminProductForm />
            </div>
        </>
    );
}
