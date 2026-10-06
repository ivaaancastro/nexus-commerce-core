import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import HomePage from "@/app/page";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import type { FamilyResponse, Market } from "@/types/commerce";
import type { User } from "@/types/auth";

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMarkets: vi.fn(),
        getFamilies: vi.fn(),
        getProducts: vi.fn(),
    },
}));

/** Devuelve MarketService: la lista que pinta el selector de divisa (3.2). */
const MARKETS: Market[] = [
    { code: "CH", name: "Switzerland", currency: "CHF", taxRate: 8.1 },
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
    { code: "US", name: "United States", currency: "USD", taxRate: 7.25 },
];

/** La semilla de V12: 4 productos repartidos en 3 familias. */
const FAMILIES: FamilyResponse[] = [
    { family: "FOOTWEAR", productCount: 1 },
    { family: "KNITWEAR", productCount: 1 },
    { family: "OUTERWEAR", productCount: 2 },
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
};

function renderHome() {
    return render(
        <AuthProvider>
            {/* Mismo árbol que layout.tsx (D5) */}
            <MarketProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <HomePage />
                    </CartDrawerProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

describe("HomePage (portada)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
        vi.mocked(api.getFamilies).mockResolvedValue(FAMILIES);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("R3 — pinta un acceso por familia con su recuento y enlaza a su sección", async () => {
        // GIVEN / WHEN
        renderHome();

        // THEN — el acceso es un enlace real a la sección con el filtro pre-aplicado
        const outerwear = await screen.findByRole("link", { name: /outerwear/i });
        expect(outerwear).toHaveAttribute("href", "/catalog?family=OUTERWEAR");

        expect(screen.getByRole("link", { name: /knitwear/i }))
            .toHaveAttribute("href", "/catalog?family=KNITWEAR");
        expect(screen.getByRole("link", { name: /footwear/i }))
            .toHaveAttribute("href", "/catalog?family=FOOTWEAR");

        // El recuento viene del endpoint, no de contar en cliente
        expect(screen.getByText("2 prendas")).toBeInTheDocument();
        expect(screen.getByText(/3 secciones/)).toBeInTheDocument();
    });

    it("R3 — la portada no lista productos ni pide el catálogo", async () => {
        // GIVEN / WHEN
        renderHome();

        // THEN — antes la home cargaba y pintaba el grid entero, duplicando lo que
        // ya se servía en /catalog. Ahora sólo se pide la taxonomía.
        await screen.findByRole("link", { name: /outerwear/i });

        expect(api.getProducts).not.toHaveBeenCalled();
        expect(screen.queryAllByRole("article")).toHaveLength(0);
    });

    it("R3 — la portada no muestra la barra de búsqueda semántica", async () => {
        // GIVEN / WHEN
        renderHome();

        // THEN — la barra se mudó a /search para que la portada sea un menú puro
        await screen.findByRole("link", { name: /outerwear/i });

        expect(
            screen.queryByPlaceholderText(/describe lo que buscas/i)
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /buscar/i })).not.toBeInTheDocument();
    });

    it("R3 — traduce el error del endpoint de familias", async () => {
        // GIVEN
        vi.mocked(api.getFamilies).mockRejectedValue(
            new Error("API Error [500]: Internal Server Error")
        );

        // WHEN
        renderHome();

        // THEN
        expect(await screen.findByText(/error de conexión/i)).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /outerwear/i })).not.toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByText(/puerto 8080/i)).toBeInTheDocument()
        );
    });

    it("R10 — muestra el estado vacío si el catálogo no tiene familias", async () => {
        // GIVEN
        vi.mocked(api.getFamilies).mockResolvedValue([]);

        // WHEN
        renderHome();

        // THEN
        expect(await screen.findByText(/no hay secciones disponibles/i)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /colección/i })).toBeInTheDocument();
    });

    it("R10 — mientras carga muestra el esqueleto, sin accesos parciales", async () => {
        // GIVEN — el endpoint de familias aún sin responder
        vi.mocked(api.getFamilies).mockReturnValue(new Promise(() => {}));

        // WHEN
        renderHome();

        // THEN
        expect(await screen.findByText(/cargando secciones/i)).toBeInTheDocument();
        expect(screen.queryAllByRole("link", { name: /outerwear/i })).toHaveLength(0);
    });
});
