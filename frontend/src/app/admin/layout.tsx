"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import AdminRoute from "@/components/AdminRoute";

const SECCIONES = [
    { href: "/admin", label: "Panel" },
    { href: "/admin/products", label: "Productos" },
    { href: "/admin/stock", label: "Stock" },
    { href: "/admin/orders", label: "Pedidos" },
    { href: "/admin/users", label: "Usuarios" },
    { href: "/admin/reviews", label: "Reseñas" },
    { href: "/admin/coupons", label: "Cupones" },
    { href: "/admin/system", label: "Sistema" },
];

/**
 * Chrome común del panel (Tarea 7.2, E.1).
 *
 * `AdminRoute` vive **aquí una sola vez** y protege todas las rutas
 * `/admin/**`: en la 7.1 cada página se envolvía a sí misma, y con las
 * secciones que llegan (7.3–7.6) eso se multiplicaría. El layout además
 * persiste al navegar dentro del panel, así que la puerta no se re-evalúa
 * en cada cambio de ruta.
 *
 * El `<main>`, la cabecera y la subnavegación también son compartidos: las
 * páginas del panel sólo aportan su contenido.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    return (
        <AdminRoute>
            <Header />
            <main className="w-full max-w-7xl mx-auto px-6 py-12 flex flex-col gap-6">
                <nav
                    aria-label="Secciones de administración"
                    className="flex gap-6 border-b border-neutral-200"
                >
                    {SECCIONES.map((seccion) => {
                        const activa =
                            seccion.href === "/admin"
                                ? pathname === "/admin"
                                : pathname.startsWith(seccion.href);
                        return (
                            <Link
                                key={seccion.href}
                                href={seccion.href}
                                aria-current={activa ? "page" : undefined}
                                className={`pb-3 -mb-px text-[11px] uppercase tracking-widest border-b-2 transition-colors ${
                                    activa
                                        ? "border-neutral-900 text-neutral-900"
                                        : "border-transparent text-neutral-500 hover:text-neutral-900"
                                }`}
                            >
                                {seccion.label}
                            </Link>
                        );
                    })}
                </nav>
                {children}
            </main>
        </AdminRoute>
    );
}
