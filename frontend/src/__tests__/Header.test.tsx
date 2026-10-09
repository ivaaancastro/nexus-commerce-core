import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Header from "@/components/Header";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { MarketProvider } from "@/context/MarketContext";
import { api } from "@/lib/api";
import type { User } from "@/types/auth";
import type { Market } from "@/types/commerce";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMarkets: vi.fn(),
    },
}));

/** Devuelve MarketService: los 4 mercados de V1 ordenados por code. */
const MARKETS: Market[] = [
    { code: "CH", name: "Switzerland", currency: "CHF", taxRate: 8.1 },
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
    { code: "US", name: "United States", currency: "USD", taxRate: 7.25 },
];

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
    role: "USER",
};

function renderHeader() {
    return render(
        <AuthProvider>
            {/* Mismo árbol que layout.tsx: MarketProvider envuelve a CartProvider (D5) */}
            <MarketProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <Header />
                    </CartDrawerProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

describe("Header", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
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

    it("R7 — «Colección» y «Búsqueda Vectorial» son enlaces a sus rutas", async () => {
        // GIVEN — antes eran <span> con cursor-pointer: se veían como enlaces pero
        // no se podía navegar con ellos, con clic derecho ni con el teclado.
        renderHeader();

        // THEN
        const coleccion = await screen.findByRole("link", { name: /colección/i });
        expect(coleccion).toHaveAttribute("href", "/catalog");

        const busqueda = screen.getByRole("link", { name: /búsqueda vectorial/i });
        expect(busqueda).toHaveAttribute("href", "/search");
    });

    it("R2 — pinta el selector de mercado accesible con las opciones del endpoint", async () => {
        // GIVEN / WHEN
        renderHeader();

        // THEN
        const select = await screen.findByRole("combobox", {
            name: "Mercado y divisa",
        });
        expect(select).toHaveValue("ES");

        // La lista viene del endpoint ordenada por code, no de una constante.
        const options = within(select).getAllByRole("option");
        expect(options.map((option) => option.textContent)).toEqual([
            "CH / CHF",
            "ES / EUR",
            "UK / GBP",
            "US / USD",
        ]);
    });

    it("R2 — no pinta el selector mientras no haya lista de mercados", async () => {
        // GIVEN — endpoint aún sin responder o devolviendo una lista vacía
        vi.mocked(api.getMarkets).mockResolvedValue([]);

        // WHEN
        renderHeader();

        // THEN — sin lista no hay <select>: ni parpadeo ni «undefined / undefined»
        expect(await screen.findByRole("link", { name: /pedidos/i }));
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    // ── Tarea 7.1: el enlace al panel sólo para ADMIN ────────────────────────

    it("7.1 — con rol ADMIN aparece el enlace «Admin» apuntando a /admin", async () => {
        // GIVEN — el backend devuelve role: "ADMIN" en /users/me
        vi.mocked(api.getCurrentUser).mockResolvedValue({ ...baseUser, role: "ADMIN" });

        // WHEN
        renderHeader();

        // THEN
        expect(await screen.findByRole("link", { name: /admin/i }))
            .toHaveAttribute("href", "/admin");
    });

    it("7.1 — con rol USER el enlace «Admin» no se pinta", async () => {
        // GIVEN — baseUser ya tiene role: "USER"
        renderHeader();

        // THEN — ni siquiera se ve: el 403 de la API es el otro lado de la puerta
        await screen.findByRole("link", { name: /pedidos/i });
        expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
    });

    it("7.1 — sin sesión no aparece el enlace «Admin»", async () => {
        // GIVEN — sin token guardado
        localStorage.removeItem("nexus-auth-token");

        // WHEN
        renderHeader();

        // THEN
        expect(await screen.findByRole("link", { name: /iniciar sesión/i }))
            .toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
    });
});
