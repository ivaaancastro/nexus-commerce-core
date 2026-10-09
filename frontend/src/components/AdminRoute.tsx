"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface AdminRouteProps {
    children: ReactNode;
}

/**
 * Envuelve páginas del panel de administración (Tarea 7.1).
 *
 * Patrón de `ProtectedRoute` con un escalón más: además de exigir sesión,
 * exige `user.role === "ADMIN"`.
 *
 * - Sin sesión → `/login` (igual que ProtectedRoute).
 * - Con sesión de `USER` → redirige a `/`: en la API esa misma petición
 *   recibiría `403`, así que la puerta existe en ambos lados.
 */
export default function AdminRoute({ children }: AdminRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    const isAdmin = user?.role === "ADMIN";

    useEffect(() => {
        if (isLoading) {
            return;
        }
        if (!isAuthenticated) {
            router.replace("/login");
        } else if (!isAdmin) {
            router.replace("/");
        }
    }, [isLoading, isAuthenticated, isAdmin, router]);

    if (isLoading) {
        return (
            <div
                role="status"
                aria-label="Comprobando permisos de administración"
                className="min-h-screen bg-neutral-50 flex items-center justify-center"
            >
                <span className="text-xs uppercase tracking-widest text-neutral-500">
                    Cargando...
                </span>
            </div>
        );
    }

    if (!isAuthenticated || !isAdmin) {
        return null;
    }

    return <>{children}</>;
}
