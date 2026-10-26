import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ProductCard, {
    CATALOG_CARD_SIZES,
    SEARCH_CARD_SIZES,
} from "@/components/ProductCard";
import { AuthProvider } from "@/context/AuthContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { api } from "@/lib/api";
import type { Product, SemanticSearchResult } from "@/types/commerce";
import type { User } from "@/types/auth";

/**
 * V3 wishlist (plan D7, R6) — pruebas **aditivas** de la tarjeta con corazón.
 *
 * La aserción central: el botón de favoritos es un **hermano** de cualquier
 * `<a>`, nunca un descendiente (interactividad anidada = trampa de a11y). Las
 * aserciones preexistentes de la tarjeta viven en `CatalogPage.test` y
 * `SearchPage.test` y no se tocaron (R8.3: a `SearchPage.test` sólo se le añadió
 * el mock de `next/navigation` que exige el corazón).
 */

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn() }),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getWishlist: vi.fn(),
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
    role: "USER",
};

const BLAZER: Product = {
    id: 1,
    referenceCode: "0432/021",
    name: "Blazer Cruzada Estructura",
    family: "OUTERWEAR",
    description: "Blazer de corte recto",
    skus: [
        { id: 1, barcode: "843321900101", size: "M", color: "Marino" },
        { id: 2, barcode: "843321900102", size: "L", color: "Marino" },
    ],
};

const SEMANTICA: SemanticSearchResult = {
    productId: 7,
    referenceCode: "0611/018",
    name: "Abrigo Lana Oversize",
    family: "OUTERWEAR",
    description: "Abrigo de lana",
    tags: ["lana", "invierno"],
    searchMode: "TEXT",
};

function renderTarjeta(
    ui: React.ReactElement,
    { conSesion }: { conSesion?: boolean } = {}
) {
    if (conSesion) localStorage.setItem("nexus-auth-token", "fake-token");
    return render(<AuthProvider>{ui}</AuthProvider>);
}

describe("ProductCard con corazón (V3 wishlist)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
        vi.mocked(api.getWishlist).mockResolvedValue({ items: [] });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("el corazón existe, queda FUERA de todo <a> y el enlace de la tarjeta sigue intacto (R6.3)", async () => {
        renderTarjeta(<ProductCard product={BLAZER} sizes={CATALOG_CARD_SIZES} />);

        const corazon = await screen.findByRole("button", {
            name: "Guardar Blazer Cruzada Estructura en favoritos",
        });
        // El corazón es hermano de la imagen y de «Ver Detalle», nunca hijo
        // de un enlace (plan D7).
        expect(corazon.closest("a")).toBeNull();

        // La tarjeta existente no cambia: enlace codificado e imagen con alt
        const enlace = screen.getByRole("link", { name: /ver detalle/i });
        expect(enlace).toHaveAttribute("href", "/products/0432%2F021");
        expect(
            screen.getByRole("img", { name: "Blazer Cruzada Estructura" })
        ).toBeInTheDocument();

        expect(corazon).toHaveAttribute("aria-pressed", "false");
    });

    it("la tarjeta semántica de /search hereda el corazón con el productId del resultado (R6.2)", async () => {
        renderTarjeta(<ProductCard semanticItem={SEMANTICA} sizes={SEARCH_CARD_SIZES} />);

        const corazon = await screen.findByRole("button", {
            name: "Guardar Abrigo Lana Oversize en favoritos",
        });
        expect(corazon.closest("a")).toBeNull();
        // El modo texto de la búsqueda no trae `Product`, sólo `productId`
        expect(corazon).toHaveAttribute("aria-pressed", "false");
    });

    it("con la lista de la sesión cargada, el corazón sale guardado (integración con el contexto)", async () => {
        vi.mocked(api.getWishlist).mockResolvedValue({
            items: [
                {
                    id: 3,
                    addedAt: "2026-10-26T12:00:00+01:00",
                    product: BLAZER,
                },
            ],
        });

        // AuthProvider sólo hidrata con sesión: el token se siembra ANTES del render
        localStorage.setItem("nexus-auth-token", "fake-token");
        render(
            <AuthProvider>
                <WishlistProvider>
                    <ProductCard product={BLAZER} sizes={CATALOG_CARD_SIZES} />
                </WishlistProvider>
            </AuthProvider>
        );

        await waitFor(() => {
            expect(
                screen.getByRole("button", {
                    name: "Quitar Blazer Cruzada Estructura de favoritos",
                })
            ).toHaveAttribute("aria-pressed", "true");
        });
    });
});
