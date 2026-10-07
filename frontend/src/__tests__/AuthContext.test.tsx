import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import type { User } from "@/types/auth";

/**
 * Tarea 4.1, R6 — arranque de la sesión.
 *
 * El `if/else` del efecto se colapsó en una sola cadena de promesa para dejar
 * de escribir `isLoading` de forma síncrona en el cuerpo del efecto. Estos
 * tests son los que impiden que ese refactor cambie el resultado: la carga se
 * apaga siempre, con y sin token, y con un token caducado.
 */

const apiMock = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getProfile: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerificationCode: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: apiMock }));

const USUARIO: User = {
    id: 1,
    email: "prueba.55@nexus.dev",
    firstName: "Prueba",
    lastName: "Nexus",
    birthDate: "1990-01-01",
    gender: "OTHER",
    emailVerified: true,
};

function Sonda() {
    const { user, isLoading, isAuthenticated } = useAuth();
    return (
        <div>
            <span data-testid="loading">{String(isLoading)}</span>
            <span data-testid="usuario">{user ? user.email : "ninguno"}</span>
            <span data-testid="autenticado">{String(isAuthenticated)}</span>
        </div>
    );
}

describe("AuthContext — arranque de sesión", () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("sin token: isLoading pasa a false, user queda null y no se pide nada", async () => {
        // GIVEN un navegador sin sesión
        render(
            <AuthProvider>
                <Sonda />
            </AuthProvider>
        );

        // THEN la carga empieza encendida…
        expect(screen.getByTestId("loading")).toHaveTextContent("true");

        // …y se apaga sin haber llamado al backend
        await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
        expect(screen.getByTestId("usuario")).toHaveTextContent("ninguno");
        expect(screen.getByTestId("autenticado")).toHaveTextContent("false");
        expect(apiMock.getCurrentUser).not.toHaveBeenCalled();
    });

    it("con token: isLoading sigue true hasta que getCurrentUser resuelve (R6)", async () => {
        // GIVEN una petición de usuario que todavía no ha contestado
        let resolver!: (usuario: User) => void;
        apiMock.getCurrentUser.mockReturnValue(
            new Promise<User>((resolve) => {
                resolver = resolve;
            })
        );
        window.localStorage.setItem("nexus-auth-token", "token-vigente");

        render(
            <AuthProvider>
                <Sonda />
            </AuthProvider>
        );

        // THEN mientras no hay respuesta, la UI sigue en carga
        expect(apiMock.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("loading")).toHaveTextContent("true");
        expect(screen.getByTestId("usuario")).toHaveTextContent("ninguno");

        // WHEN el backend devuelve el usuario
        await act(async () => {
            resolver(USUARIO);
        });

        // THEN la sesión queda montada
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
        expect(screen.getByTestId("usuario")).toHaveTextContent("prueba.55@nexus.dev");
        expect(screen.getByTestId("autenticado")).toHaveTextContent("true");
    });

    it("con token caducado se borra la clave y se deja de cargar", async () => {
        // GIVEN un token que el backend rechaza
        apiMock.getCurrentUser.mockRejectedValue(new Error("401"));
        window.localStorage.setItem("nexus-auth-token", "caducado");
        window.localStorage.setItem("nexus-refresh-token", "también-caducado");

        render(
            <AuthProvider>
                <Sonda />
            </AuthProvider>
        );

        // WHEN el backend responde con error
        await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

        // THEN no queda ninguna sesión montada y se limpia la clave de acceso
        expect(screen.getByTestId("usuario")).toHaveTextContent("ninguno");
        expect(screen.getByTestId("autenticado")).toHaveTextContent("false");
        expect(window.localStorage.getItem("nexus-auth-token")).toBeNull();
    });
});
