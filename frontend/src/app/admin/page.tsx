"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AdminMetrics from "@/components/admin/AdminMetrics";

/**
 * Portada del panel de administración (Tarea 7.2, E.2; tarjetas 7.3–7.5;
 * métricas 7.6).
 *
 * Desde la 7.2 la sección **Productos** existe de verdad, desde la 7.3
 * **Stock y precios**, desde la 7.4 **Pedidos** y desde la 7.5 **Usuarios**;
 * desde la 7.6 la portada **enseña además las métricas** del negocio y el aviso
 * honesto «En construcción» desaparece (R7): sólo se prometía lo que no
 * existía, y ya no queda nada pendiente en la fase. La puerta (`AdminRoute`) y
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

            <AdminMetrics />

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

            <Link
                href="/admin/users"
                className="group border border-neutral-200 bg-white p-6 flex flex-col gap-2 transition-colors hover:border-neutral-900"
            >
                <span className="text-xs uppercase tracking-widest text-neutral-600 group-hover:text-neutral-900">
                    Usuarios
                </span>
                <span className="text-sm font-light text-neutral-700">
                    Busca cuentas, suspende o restaura accesos y cambia roles entre
                    usuario y administrador.
                </span>
            </Link>
        </>
    );
}
