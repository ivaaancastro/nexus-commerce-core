"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
    children: ReactNode;
}

/**
 * Envuelve páginas que requieren sesión.
 *
 * Mientras AuthContext resuelve el token guardado muestra un estado de carga;
 * si no hay sesión, redirige a /login de forma imperceptible para el usuario.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace("/login");
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div
                role="status"
                aria-label="Comprobando sesión"
                className="min-h-screen bg-neutral-50 flex items-center justify-center"
            >
                <span className="text-xs uppercase tracking-widest text-neutral-500">
                    Cargando...
                </span>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
