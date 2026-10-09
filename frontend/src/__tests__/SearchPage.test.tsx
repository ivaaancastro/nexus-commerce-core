import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SearchPage from "@/app/search/page";
import { CATALOG_CARD_SIZES, SEARCH_CARD_SIZES } from "@/components/ProductCard";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import type { Market, SemanticSearchResult } from "@/types/commerce";
import type { User } from "@/types/auth";

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMarkets: vi.fn(),
        searchSemantic: vi.fn(),
    },
}));

const MARKETS: Market[] = [
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
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

const RESULTADO: SemanticSearchResult = {
    productId: 1,
    referenceCode: "0432/021",
    name: "Blazer Lino",
    family: "OUTERWEAR",
    description: "Blazer de lino para ceremonia",
    similarityScore: 0.89,
    tags: ["boda", "verano"],
    searchMode: "SEMANTIC",
};

/** Respuesta del fallback por texto (Tarea 6.3): sin score, modo TEXT. */
const RESULTADO_TEXTO: SemanticSearchResult = {
    productId: 3,
    referenceCode: "0815/004",
    name: "Jersey Punto Lana",
    family: "KNITWEAR",
    description: "Jersey de punto fino con cuello redondo",
    tags: [],
    searchMode: "TEXT",
};

function renderSearch() {
    return render(
        <AuthProvider>
            {/* Mismo árbol que layout.tsx (D5) */}
            <MarketProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <SearchPage />
                    </CartDrawerProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

async function buscar(texto: string) {
    const input = await screen.findByPlaceholderText(/describe lo que buscas/i);
    await userEvent.type(input, texto);
    await userEvent.click(screen.getByRole("button", { name: /^buscar$/i }));
}

describe("SearchPage (búsqueda semántica)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("R6 — muestra la barra con su estado inicial y sin resultados", async () => {
        // GIVEN / WHEN
        renderSearch();

        // THEN
        expect(await screen.findByPlaceholderText(/describe lo que buscas/i))
            .toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^buscar$/i })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /búsqueda semántica/i }))
            .toBeInTheDocument();
        expect(screen.queryAllByRole("article")).toHaveLength(0);
    });

    it("R6 — lanza la búsqueda y pinta los resultados devueltos", async () => {
        // GIVEN
        vi.mocked(api.searchSemantic).mockResolvedValue([RESULTADO]);

        // WHEN
        renderSearch();
        await buscar("traje lino para boda");

        // THEN
        expect(await screen.findByText("Blazer Lino")).toBeInTheDocument();
        expect(api.searchSemantic).toHaveBeenCalledWith("traje lino para boda", 12);
        expect(screen.getByText(/1 artículos encontrados/i)).toBeInTheDocument();
    });

    it("R6 — mientras busca muestra el estado de carga y los skeletons", async () => {
        // GIVEN — promesa que no resuelve: nos quedamos dentro de la carga
        vi.mocked(api.searchSemantic).mockReturnValue(new Promise(() => {}));

        // WHEN
        renderSearch();
        await buscar("traje lino");

        // THEN — el botón comunica que sigue buscando…
        expect(await screen.findByRole("button", { name: /buscando/i })).toBeInTheDocument();

        // …y se pintan skeletons, no un resultado inventado
        expect(screen.getAllByRole("article")).toHaveLength(6);
        expect(screen.queryByText("Blazer Lino")).not.toBeInTheDocument();
    });

    it("R6 — un texto que no casa con nada muestra el estado vacío con la consulta", async () => {
        // GIVEN
        vi.mocked(api.searchSemantic).mockResolvedValue([]);

        // WHEN
        renderSearch();
        await buscar("gafas de buceo");

        // THEN
        expect(await screen.findByText(/sin resultados para/i)).toBeInTheDocument();
        expect(screen.getByText(/gafas de buceo/)).toBeInTheDocument();
        expect(screen.queryAllByRole("article")).toHaveLength(0);
    });

    it("R6 — limpia la búsqueda y vuelve al estado inicial", async () => {
        // GIVEN
        vi.mocked(api.searchSemantic).mockResolvedValue([RESULTADO]);
        renderSearch();
        await buscar("traje lino");
        await screen.findByText("Blazer Lino");

        // WHEN
        await userEvent.click(screen.getByRole("button", { name: /limpiar búsqueda/i }));

        // THEN
        expect(screen.queryByText("Blazer Lino")).not.toBeInTheDocument();
        expect(screen.queryAllByRole("article")).toHaveLength(0);
        // El placeholder, no el texto: sólo el input vuelve a su estado inicial
        expect(screen.getByPlaceholderText(/describe lo que buscas/i)).toBeInTheDocument();
    });

    it("R6 — traduce el error técnico de la búsqueda", async () => {
        // GIVEN
        vi.mocked(api.searchSemantic).mockRejectedValue(
            new Error("API Error [500]: Internal Server Error")
        );

        // WHEN
        renderSearch();
        await buscar("traje lino");

        // THEN
        expect(await screen.findByText(/error de conexión/i)).toBeInTheDocument();
        expect(screen.getByText(/puerto 8080/i)).toBeInTheDocument();

        // Regresión del copy: `getFriendlyErrorMessage` ya devuelve el mensaje
        // con punto final, y la pista técnica se concatenaba tras él — se leía
        // «minutos.. Asegúrate». Ahora son dos elementos independientes y cada
        // uno lleva su propia puntuación.
        expect(screen.getByText(/asegúrate de que el backend/i).textContent?.trim())
            .toMatch(/^Asegúrate/);
        expect(screen.getByText(/algo salió mal/i).textContent).not.toContain("..");
        // Y no se afirma «0 artículos encontrados»: la petición no terminó,
        // no es que no haya coincidencias.
        expect(screen.queryByText(/artículos encontrados/i)).not.toBeInTheDocument();
    });

    it("R5 — la tarjeta de resultados usa el `sizes` de su rejilla, sin columna lateral", async () => {
        // GIVEN
        vi.mocked(api.searchSemantic).mockResolvedValue([RESULTADO]);

        // WHEN
        renderSearch();
        await buscar("traje lino");

        // THEN
        const card = (await screen.findByText("Blazer Lino")).closest("article");
        const image = card?.querySelector("img") as HTMLImageElement;

        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute("alt", "Blazer Lino");
        // Rejilla de /search: 1 / sm:2 / lg:3, sin columna lateral
        expect(image).toHaveAttribute("sizes", SEARCH_CARD_SIZES);
        expect(image).not.toHaveAttribute("sizes", CATALOG_CARD_SIZES);
    });

    it("R3 — en modo SEMANTIC el subtítulo promete proximidad y no muestra la nota de OPENAI_API_KEY", async () => {
        // GIVEN
        vi.mocked(api.searchSemantic).mockResolvedValue([RESULTADO]);

        // WHEN
        renderSearch();
        await buscar("traje lino para boda");

        // THEN
        expect(await screen.findByText(/por proximidad vectorial/i))
            .toBeInTheDocument();
        // La nota es exclusiva del modo TEXT: aquí no debe aparecer.
        expect(screen.queryByText(/OPENAI_API_KEY/i)).not.toBeInTheDocument();
    });

    it("R3 — en modo TEXT el subtítulo no promete proximidad y muestra la nota discreta", async () => {
        // GIVEN: respuesta del fallback — sin score y searchMode: TEXT
        vi.mocked(api.searchSemantic).mockResolvedValue([RESULTADO_TEXTO]);

        // WHEN
        renderSearch();
        await buscar("lana");

        // THEN
        expect(await screen.findByText("Jersey Punto Lana")).toBeInTheDocument();
        expect(screen.getByText(/1 artículos encontrados/i)).toBeInTheDocument();
        expect(screen.queryByText(/proximidad vectorial/i)).not.toBeInTheDocument();
        expect(
            screen.getByText(/búsqueda por texto — configura OPENAI_API_KEY para la búsqueda semántica/i)
        ).toBeInTheDocument();
    });
});
