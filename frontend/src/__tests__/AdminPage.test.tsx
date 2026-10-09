import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminPage from "@/app/admin/page";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { MarketProvider } from "@/context/MarketContext";
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
        getMarkets: vi.fn(),
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

/** Mismo árbol que layout.tsx (MarketProvider envuelve a CartProvider). */
function renderAdminPage() {
    return render(
        <AuthProvider>
            <MarketProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <AdminPage />
                    </CartDrawerProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

describe("AdminPage (/admin)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getMarkets).mockResolvedValue([]);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("con rol ADMIN muestra el saludo, el rol y el aviso honesto de «en construcción»", async () => {
        // GIVEN
        vi.mocked(api.getCurrentUser).mockResolvedValue(admin);

        // WHEN
        renderAdminPage();

        // THEN — semilla real de la 7.1: puerta + saludo + sin maqueta (D6)
        expect(await screen.findByRole("heading", { name: /panel de administración/i }))
            .toBeInTheDocument();
        expect(screen.getByText("admin@nexus.dev")).toBeInTheDocument();
        expect(screen.getByText("ADMIN")).toBeInTheDocument();
        expect(screen.getByText(/en construcción/i)).toBeInTheDocument();
        // El aviso nombra las tareas que traerán el contenido de verdad
        expect(screen.getByText(/7\.2–7\.6/)).toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });

    it("con rol USER la puerta redirige a / y no pinta el panel", async () => {
        // GIVEN — misma sesión, rol sin privilegio
        vi.mocked(api.getCurrentUser).mockResolvedValue(user);

        // WHEN
        renderAdminPage();

        // THEN
        await waitFor(() => {
            expect(replace).toHaveBeenCalledWith("/");
        });
        expect(
            screen.queryByRole("heading", { name: /panel de administración/i })
        ).not.toBeInTheDocument();
    });
});
