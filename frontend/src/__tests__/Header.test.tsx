import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Header from "@/components/Header";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import type { User } from "@/types/auth";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
    },
}));

const baseUser: User = {
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

function renderHeader() {
    return render(
        <AuthProvider>
            <CartProvider>
                <CartDrawerProvider>
                    <Header />
                </CartDrawerProvider>
            </CartProvider>
        </AuthProvider>
    );
}

describe("Header", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("debe declarar color explícito en el logo para no heredar el foreground del body", () => {
        // GIVEN — globals.css cambia --foreground a #ededed con prefers-color-scheme: dark,
        // pero el header es siempre blanco. Sin color propio el logo sale invisible
        // sobre ese fondo en cualquier página.
        renderHeader();

        // WHEN
        const logo = screen.getByRole("link", { name: /nexus core/i });

        // THEN
        expect(logo.className).toContain("text-neutral-900");
    });

    it("debe enlazar a Pedidos y a Cuenta cuando hay sesión", async () => {
        // GIVEN / WHEN
        renderHeader();

        // THEN
        expect(await screen.findByRole("link", { name: /pedidos/i }))
            .toHaveAttribute("href", "/orders");
        expect(screen.getByRole("link", { name: /cuenta/i }))
            .toHaveAttribute("href", "/profile");
    });
});
