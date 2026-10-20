import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminPage from "@/app/admin/page";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { MarketProvider } from "@/context/MarketContext";
import { api } from "@/lib/api";
import type { User } from "@/types/auth";
import type { AdminDashboard } from "@/types/commerce";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace, push: vi.fn() }),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMarkets: vi.fn(),
        getAdminDashboard: vi.fn(),
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

/** Foto mínima del dashboard: la portada sólo la pinta, no la calcula. */
const dashboard: AdminDashboard = {
    range: { days: 30, from: "2026-09-20T10:00:00Z" },
    sales: {
        orderCount: 12,
        byStatus: { PENDING: 3, CONFIRMED: 5, SHIPPED: 2, DELIVERED: 2, CANCELLED: 4 },
        revenue: [{ currency: "EUR", total: 1234.56, orderCount: 7, avgTicket: 176.37 }],
    },
    products: { total: 42, skus: 120, families: 8 },
    users: { total: 15, admins: 2, suspended: 1, newInPeriod: 4 },
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
        vi.mocked(api.getAdminDashboard).mockResolvedValue(dashboard);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("con rol ADMIN muestra el saludo, el rol, las métricas y las 4 secciones", async () => {
        // GIVEN
        vi.mocked(api.getCurrentUser).mockResolvedValue(admin);

        // WHEN
        renderAdminPage();

        // THEN — puerta + saludo + métricas desde la 7.6 (cambio declarado en
        // specs/admin-dashboard/ R8.3: el aviso «en construcción» ya no existe)
        expect(await screen.findByRole("heading", { name: /panel de administración/i }))
            .toBeInTheDocument();
        expect(screen.getByText("admin@nexus.dev")).toBeInTheDocument();
        expect(screen.getByText("ADMIN")).toBeInTheDocument();
        expect(screen.queryByText(/en construcción/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/7\.6/)).not.toBeInTheDocument();
        // La portada pide la foto al panel y la pinta sobre las tarjetas (R7)
        expect(api.getAdminDashboard).toHaveBeenCalledWith(30);
        expect(await screen.findByRole("region", { name: "Ventas" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Usuarios" })).toBeInTheDocument();
        // La sección real de la 7.2 enlaza a su listado
        expect(screen.getByRole("link", { name: /productos/i })).toHaveAttribute(
            "href",
            "/admin/products"
        );
        // La 7.3 gana su tarjeta: stock en la matriz, precios en la ficha (R7.3)
        expect(screen.getByRole("link", { name: /stock y precios/i })).toHaveAttribute(
            "href",
            "/admin/stock"
        );
        // La 7.4 gana su tarjeta: gestión de pedidos en /admin/orders (R7.4)
        expect(screen.getByRole("link", { name: /pedidos/i })).toHaveAttribute(
            "href",
            "/admin/orders"
        );
        expect(replace).not.toHaveBeenCalled();
    });

    // La puerta `AdminRoute` vive desde la 7.2 en `app/admin/layout.tsx` (E.1):
    // su redirección de USER/anónimo se verifica en `AdminLayout.test.tsx`,
    // y el componente en `AdminRoute.test.tsx` — aquí sólo se prueba el
    // contenido de la portada, que ya no decide la autorización.
});
