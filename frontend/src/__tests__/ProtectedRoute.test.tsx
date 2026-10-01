import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ProtectedRoute from "@/components/ProtectedRoute";
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

const user: User = {
    id: 1,
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "García",
    phone: "612345678",
    birthDate: "1990-05-20",
    gender: "FEMALE",
    height: 175,
    weight: 70,
    emailVerified: true,
};

describe("ProtectedRoute", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("debe redirigir a /login cuando no hay sesión", async () => {
        // GIVEN: sin token en localStorage
        // WHEN
        render(
            <AuthProvider>
                <ProtectedRoute>
                    <div>Contenido protegido</div>
                </ProtectedRoute>
            </AuthProvider>
        );

        // THEN
        await waitFor(() => {
            expect(replace).toHaveBeenCalledWith("/login");
        });
        expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
    });

    it("debe mostrar el contenido cuando hay una sesión válida", async () => {
        // GIVEN
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(user);

        // WHEN
        render(
            <AuthProvider>
                <ProtectedRoute>
                    <div>Contenido protegido</div>
                </ProtectedRoute>
            </AuthProvider>
        );

        // THEN
        expect(await screen.findByText("Contenido protegido")).toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });

    it("debe mostrar estado de carga mientras se resuelve el token", () => {
        // GIVEN
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}));

        // WHEN
        render(
            <AuthProvider>
                <ProtectedRoute>
                    <div>Contenido protegido</div>
                </ProtectedRoute>
            </AuthProvider>
        );

        // THEN
        expect(screen.getByRole("status")).toHaveTextContent(/Cargando/i);
        expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });
});
