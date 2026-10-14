import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminRoute from "@/components/AdminRoute";
import { AuthProvider } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { User } from "@/types/auth";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace, push: vi.fn() }),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
    },
}));

const admin: User = {
    id: 1,
    email: "admin@nexus.dev",
    firstName: "Admin",
    lastName: "Nexus",
    phone: "612345678",
    birthDate: "1990-01-01",
    gender: "OTHER",
    emailVerified: true,
    role: "ADMIN",
};

const user: User = {
    id: 2,
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "García",
    phone: "612345678",
    birthDate: "1990-05-20",
    gender: "FEMALE",
    height: 175,
    weight: 70,
    emailVerified: true,
    role: "USER",
};

describe("AdminRoute", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("sin sesión debe redirigir a /login y no mostrar el contenido", async () => {
        // GIVEN — ningún token guardado
        // WHEN
        render(
            <AuthProvider>
                <AdminRoute>
                    <div>Panel admin</div>
                </AdminRoute>
            </AuthProvider>
        );

        // THEN
        await waitFor(() => {
            expect(replace).toHaveBeenCalledWith("/login");
        });
        expect(screen.queryByText("Panel admin")).not.toBeInTheDocument();
    });

    it("con sesión de USER debe redirigir a / (la API le devolvería 403)", async () => {
        // GIVEN — sesión válida pero rol USER
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(user);

        // WHEN
        render(
            <AuthProvider>
                <AdminRoute>
                    <div>Panel admin</div>
                </AdminRoute>
            </AuthProvider>
        );

        // THEN
        await waitFor(() => {
            expect(replace).toHaveBeenCalledWith("/");
        });
        expect(screen.queryByText("Panel admin")).not.toBeInTheDocument();
    });

    it("con sesión de ADMIN debe renderizar el contenido", async () => {
        // GIVEN
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(admin);

        // WHEN
        render(
            <AuthProvider>
                <AdminRoute>
                    <div>Panel admin</div>
                </AdminRoute>
            </AuthProvider>
        );

        // THEN
        expect(await screen.findByText("Panel admin")).toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });

    it("muestra un estado de carga accesible mientras se resuelve el token (mismo patrón que ProtectedRoute)", () => {
        // GIVEN — el token existe pero /users/me no responde aún
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}));

        // WHEN
        render(
            <AuthProvider>
                <AdminRoute>
                    <div>Panel admin</div>
                </AdminRoute>
            </AuthProvider>
        );

        // THEN — role="status" leíble por lectores de pantalla, sin redirigir
        expect(screen.getByRole("status")).toHaveTextContent(/Cargando/i);
        expect(screen.queryByText("Panel admin")).not.toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });
});
