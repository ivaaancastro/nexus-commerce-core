import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminLayout from "@/app/admin/layout";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import type { User } from "@/types/auth";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace, push: vi.fn() }),
    useParams: vi.fn(),
    // La subnavegación marca como activa la sección actual
    usePathname: () => "/admin/products",
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
    emailVerified: true,
    role: "USER",
};

/**
 * Tarea 7.2 (E.1) — `AdminRoute` se muda al layout y protege **todas** las
 * rutas `/admin/**` en un solo sitio. Este test cubre la puerta en su nueva
 * casa (el componente se prueba aparte, en `AdminRoute.test.tsx`).
 */
describe("AdminLayout (/admin/**)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getMarkets).mockResolvedValue([]);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("con ADMIN muestra la subnavegación y el contenido hijo", async () => {
        // GIVEN — sesión con rol ADMIN
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(admin);

        // WHEN
        render(
            <AuthProvider>
                <MarketProvider>
                    <CartProvider>
                        <CartDrawerProvider>
                            <AdminLayout>
                                <div>Contenido del panel</div>
                            </AdminLayout>
                        </CartDrawerProvider>
                    </CartProvider>
                </MarketProvider>
            </AuthProvider>
        );

        // THEN — la puerta deja pasar y el chrome se pinta
        expect(await screen.findByText("Contenido del panel")).toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();

        const navegacion = screen.getByRole("navigation", {
            name: "Secciones de administración",
        });
        expect(navegacion).toBeInTheDocument();

        // usePathname = /admin/products: esa sección es la activa
        expect(screen.getByRole("link", { name: "Productos" })).toHaveAttribute(
            "aria-current",
            "page"
        );
        expect(screen.getByRole("link", { name: "Panel" })).not.toHaveAttribute(
            "aria-current"
        );

        // Tarea 7.4 (aditivo): la 7.4 añade «Pedidos» y coloca «Stock» (D8 de
        // specs/admin-orders/, coherencia con las secciones que ya existen).
        // Acotado a la subnavegación: el Header global también enlaza «Pedidos».
        const panel = within(navegacion);
        expect(panel.getByRole("link", { name: "Pedidos" })).toHaveAttribute(
            "href",
            "/admin/orders"
        );
        expect(panel.getByRole("link", { name: "Stock" })).toHaveAttribute(
            "href",
            "/admin/stock"
        );
        expect(panel.getByRole("link", { name: "Pedidos" })).not.toHaveAttribute(
            "aria-current"
        );
        expect(panel.getByRole("link", { name: "Stock" })).not.toHaveAttribute(
            "aria-current"
        );

        // Tarea 7.5 (aditivo, R8.3): «Usuarios» gana su sección y no es la
        // activa en /admin/products
        expect(panel.getByRole("link", { name: "Usuarios" })).toHaveAttribute(
            "href",
            "/admin/users"
        );
        expect(panel.getByRole("link", { name: "Usuarios" })).not.toHaveAttribute(
            "aria-current"
        );
    });

    it("con sesión de USER redirige a / y no pinta el contenido", async () => {
        // GIVEN
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(user);

        // WHEN
        render(
            <AuthProvider>
                <MarketProvider>
                    <CartProvider>
                        <CartDrawerProvider>
                            <AdminLayout>
                                <div>Contenido del panel</div>
                            </AdminLayout>
                        </CartDrawerProvider>
                    </CartProvider>
                </MarketProvider>
            </AuthProvider>
        );

        // THEN
        await waitFor(() => {
            expect(replace).toHaveBeenCalledWith("/");
        });
        expect(screen.queryByText("Contenido del panel")).not.toBeInTheDocument();
    });

    it("sin sesión redirige a /login y no pinta el contenido", async () => {
        // GIVEN — ningún token guardado
        // WHEN
        render(
            <AuthProvider>
                <MarketProvider>
                    <CartProvider>
                        <CartDrawerProvider>
                            <AdminLayout>
                                <div>Contenido del panel</div>
                            </AdminLayout>
                        </CartDrawerProvider>
                    </CartProvider>
                </MarketProvider>
            </AuthProvider>
        );

        // THEN
        await waitFor(() => {
            expect(replace).toHaveBeenCalledWith("/login");
        });
        expect(screen.queryByText("Contenido del panel")).not.toBeInTheDocument();
    });
});
