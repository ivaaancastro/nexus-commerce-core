"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

/**
 * Portada del panel de administración (Tarea 7.2, E.2; tarjetas 7.3 y 7.4).
 *
 * Desde la 7.2 la sección **Productos** existe de verdad, desde la 7.3
 * **Stock y precios** y desde la 7.4 **Pedidos**; el aviso honesto queda
 * sólo para lo que todavía no existe (7.5–7.6). La puerta (`AdminRoute`) y
 * la subnavegación viven en `app/admin/layout.tsx`.
 */
export default function AdminPage() {
    const { user } = useAuth();

    return (
        <>
            <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                Administración
            </p>
            <h1 className="text-2xl font-medium uppercase tracking-widest">
                Panel de administración
            </h1>

            <p className="text-sm font-light text-neutral-700">
                Sesión de <span className="font-medium">{user?.email}</span> con rol{" "}
                <span className="font-medium">ADMIN</span>.
            </p>

            <Link
                href="/admin/products"
                className="group border border-neutral-200 bg-white p-6 flex flex-col gap-2 transition-colors hover:border-neutral-900"
            >
                <span className="text-xs uppercase tracking-widest text-neutral-600 group-hover:text-neutral-900">
                    Productos
                </span>
                <span className="text-sm font-light text-neutral-700">
                    Crear, editar y borrar productos y SKUs del catálogo.
                </span>
            </Link>

            <Link
                href="/admin/stock"
                className="group border border-neutral-200 bg-white p-6 flex flex-col gap-2 transition-colors hover:border-neutral-900"
            >
                <span className="text-xs uppercase tracking-widest text-neutral-600 group-hover:text-neutral-900">
                    Stock y precios
                </span>
                <span className="text-sm font-light text-neutral-700">
                    Existencias por almacén en una matriz; los precios por mercado se
                    editan en la ficha de cada producto.
                </span>
            </Link>

            <Link
                href="/admin/orders"
                className="group border border-neutral-200 bg-white p-6 flex flex-col gap-2 transition-colors hover:border-neutral-900"
            >
                <span className="text-xs uppercase tracking-widest text-neutral-600 group-hover:text-neutral-900">
                    Pedidos
                </span>
                <span className="text-sm font-light text-neutral-700">
                    Consulta y gestiona todos los pedidos: cambia su estado, registra el
                    transportista y el número de seguimiento.
                </span>
            </Link>

            {/* D6 de la 7.1: sólo se promete lo que no existe todavía */}
            <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-3">
                <p className="text-xs uppercase tracking-widest text-neutral-600">
                    En construcción
                </p>
                <p className="text-sm font-light text-neutral-700">
                    Usuarios y el dashboard de métricas (7.5–7.6) llegan con las
                    siguientes tareas de la fase.
                </p>
            </div>
        </>
    );
}
