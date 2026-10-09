"use client";

import Header from "@/components/Header";
import AdminRoute from "@/components/AdminRoute";
import { useAuth } from "@/context/AuthContext";

/**
 * Puerta de entrada al panel de administración (Tarea 7.1, D6).
 *
 * Sólo la puerta: el CRUD, la gestión y el dashboard llegan con las tareas
 * 7.2–7.6. Aquí no se maqueta nada que aún no exista — un panel fingido sería
 * mentira para quien compra el producto.
 */
export default function AdminPage() {
    const { user } = useAuth();

    return (
        <AdminRoute>
            <Header />
            <main className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-6">
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

                <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-3">
                    <p className="text-xs uppercase tracking-widest text-neutral-600">
                        En construcción
                    </p>
                    <p className="text-sm font-light text-neutral-700">
                        Esta página es la puerta que protege el rol ADMIN. La gestión de
                        productos, stock, pedidos y usuarios, junto con el dashboard de
                        métricas, llega con las siguientes tareas de la fase (7.2–7.6).
                    </p>
                </div>
            </main>
        </AdminRoute>
    );
}
