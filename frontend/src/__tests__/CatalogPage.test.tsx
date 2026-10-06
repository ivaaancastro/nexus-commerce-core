import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CatalogPage from "@/app/catalog/page";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import type { FamilyResponse, Market, Product } from "@/types/commerce";
import type { User } from "@/types/auth";

// `vi.hoisted` es lo único que puede referenciar el factory de `vi.mock`:
// `vi.mock` se eleva por encima de los imports, pero `hoisted` se ejecuta antes.
const { push, estado } = vi.hoisted(() => ({
    push: vi.fn(),
    estado: { query: "" },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn() }),
    usePathname: () => "/catalog",
    // Devuelve el estado simulado de la URL: cambiar `estado.query` cambia lo que
    // la página lee, igual que haría la barra de direcciones.
    useSearchParams: () => new URLSearchParams(estado.query),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getMarkets: vi.fn(),
        getFamilies: vi.fn(),
        getProducts: vi.fn(),
    },
}));

const MARKETS: Market[] = [
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
];

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

const ABRIGO: Product = {
    id: 2,
    referenceCode: "0611/018",
    name: "Abrigo Lana Oversize",
    family: "OUTERWEAR",
    skus: [{ id: 3, barcode: "843321900201", size: "M", color: "Camel" }],
};

/** Monta el árbol completo igual que layout.tsx (D5) — se reutiliza en rerender(). */
function ui() {
    return (
        <AuthProvider>
            <MarketProvider>
                <CartProvider>
                    <CartDrawerProvider>
                        <CatalogPage />
                    </CartDrawerProvider>
                </CartProvider>
            </MarketProvider>
        </AuthProvider>
    );
}

function renderCatalog() {
    return render(ui());
}

describe("CatalogPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        estado.query = "";
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
        vi.mocked(api.getFamilies).mockResolvedValue(FAMILIES);
        vi.mocked(api.getProducts).mockResolvedValue([BLAZER, ABRIGO]);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("R4 — la columna lateral pinta familia, talla, color y orden", async () => {
        // GIVEN / WHEN
        renderCatalog();

        // THEN — familia con su recuento desde el endpoint
        const familia = await screen.findByRole("button", { name: /^outerwear/i });
        expect(familia).toHaveTextContent("OUTERWEAR");
        expect(familia).toHaveTextContent("2");

        expect(screen.getByRole("button", { name: /^knitwear/i })).toBeInTheDocument();

        // Talla y color derivados de la respuesta (los skus son M, L y M)
        expect(screen.getByText("Talla")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "M" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "L" })).toBeInTheDocument();
        expect(screen.getByText("Color")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Camel" })).toBeInTheDocument();

        expect(screen.getByText("Orden")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /nombre a → z/i })).toBeInTheDocument();
    });

    it("R4 — el botón «Filtrar» abre el panel en móvil con el mismo componente", async () => {
        // GIVEN / WHEN
        renderCatalog();
        await screen.findByRole("button", { name: /^outerwear/i });

        await userEvent.click(screen.getByRole("button", { name: /^filtrar/i }));

        // THEN
        expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^cerrar$/i })).toBeInTheDocument();

        // El panel reutiliza el mismo componente: no hay una segunda implementación
        expect(screen.getAllByRole("button", { name: /^outerwear/i })).toHaveLength(2);
        expect(screen.getByRole("button", { name: /^ver 2 prendas$/i })).toBeInTheDocument();
    });

    it("R4 — cambiar un filtro escribe en la URL y recarga con ese parámetro", async () => {
        // GIVEN
        const { rerender } = renderCatalog();
        await screen.findByRole("button", { name: /^outerwear/i });

        // WHEN — el filtrado es del backend, así que el filtro viaja por la URL
        await userEvent.click(screen.getByRole("button", { name: /^outerwear/i }));

        // THEN — inmediatamente, la navegación refleja el estado
        expect(push).toHaveBeenCalledWith("/catalog?family=OUTERWEAR");

        // ...y al adoptarse esa URL, el listado se vuelve a pedir con ese filtro.
        // Aquí se sustituye el mock de la URL a mano porque `router.push` en jsdom
        // no navega de verdad.
        estado.query = "family=OUTERWEAR";
        rerender(ui());

        await waitFor(() =>
            expect(api.getProducts).toHaveBeenLastCalledWith(
                expect.objectContaining({ family: "OUTERWEAR" })
            )
        );
        expect(vi.mocked(api.getProducts).mock.calls.length).toBeGreaterThan(1);
    });

    it("R4 — las selecciones se acumulan y no se sustituyen entre sí", async () => {
        // GIVEN — ya hay una familia elegida
        estado.query = "family=OUTERWEAR";
        renderCatalog();
        await screen.findByRole("button", { name: /^outerwear/i });

        // WHEN — se añade la talla M
        await userEvent.click(screen.getByRole("button", { name: "M" }));

        // THEN — la familia se conserva: el backend combina los dos con AND (R2)
        expect(push).toHaveBeenCalledWith("/catalog?family=OUTERWEAR&size=M");
    });

    it("R5 — lee los filtros de la URL y usa la familia activa como título", async () => {
        // GIVEN — URL compartible ya con estado
        estado.query = "family=OUTERWEAR&size=M";

        // WHEN
        renderCatalog();

        // THEN
        await waitFor(() =>
            expect(api.getProducts).toHaveBeenCalledWith(
                expect.objectContaining({ family: "OUTERWEAR", size: "M" })
            )
        );
        expect(await screen.findByRole("heading", { level: 1, name: "OUTERWEAR" }))
            .toBeInTheDocument();
        expect(api.getProducts).not.toHaveBeenCalledWith(
            expect.objectContaining({ sort: "default" })
        );
    });

    it("R5 — al quitar todos los filtros la URL queda limpia, sin query string", async () => {
        // GIVEN
        estado.query = "family=OUTERWEAR";
        renderCatalog();
        await screen.findByRole("button", { name: /^outerwear/i });

        // WHEN
        await userEvent.click(screen.getByRole("button", { name: /^limpiar filtros$/i }));

        // THEN — sin `?family=` colgando
        expect(push).toHaveBeenCalledWith("/catalog");
    });

    it("R10 — el estado vacío ofrece limpiar los filtros", async () => {
        // GIVEN — un filtro que no casa con nada
        vi.mocked(api.getProducts).mockResolvedValue([]);
        estado.query = "family=NOEXISTE";

        // WHEN
        renderCatalog();

        // THEN
        expect(await screen.findByText(/ninguna prenda coincide/i)).toBeInTheDocument();

        const limpiar = screen.getAllByRole("button", { name: /^limpiar filtros$/i });
        // Uno en la columna lateral y otro en el estado vacío — mismo resultado
        expect(limpiar.length).toBeGreaterThanOrEqual(1);

        await userEvent.click(limpiar[0]);
        expect(push).toHaveBeenCalledWith("/catalog");
    });

    it("R10 — mientras carga muestra skeletons y no un listado vacío", async () => {
        // GIVEN — la petición de catálogo no responde todavía
        vi.mocked(api.getProducts).mockReturnValue(new Promise(() => {}));

        // WHEN
        renderCatalog();

        // THEN
        expect(await screen.findByText("Cargando…")).toBeInTheDocument();
        // ProductCardSkeleton renderiza <article>: 6 de ellos y ningún producto real
        expect(screen.getAllByRole("article")).toHaveLength(6);
        expect(screen.queryByText("Blazer Cruzada Estructura")).not.toBeInTheDocument();
    });

    it("R10 — traduce el error del catálogo sin pintar el estado vacío", async () => {
        // GIVEN — un error no es «0 resultados»: son cosas distintas para el usuario
        vi.mocked(api.getProducts).mockRejectedValue(
            new Error("API Error [500]: Internal Server Error")
        );

        // WHEN
        renderCatalog();

        // THEN
        expect(await screen.findByText(/error de conexión/i)).toBeInTheDocument();
        expect(screen.getByText(/puerto 8080/i)).toBeInTheDocument();
        // Con la petición rota no puede afirmarse que «ninguna prenda coincide»
        expect(screen.queryByText(/ninguna prenda coincide/i)).not.toBeInTheDocument();
    });

    it("R10 — el contador usa el singular cuando queda una sola prenda", async () => {
        // GIVEN — un filtro que deja exactamente un resultado
        vi.mocked(api.getProducts).mockResolvedValue([BLAZER]);
        estado.query = "color=Camel";

        // WHEN
        renderCatalog();

        // THEN — «1 prendas» es un fallo de copy, no un detalle de maquetación
        expect(await screen.findByText(/^1 prenda$/i)).toBeInTheDocument();
        expect(screen.queryByText(/1 prendas/i)).not.toBeInTheDocument();
    });

    it("D10 — el catálogo no se pagina: scroll continuo sin controles de paginación", async () => {
        // GIVEN / WHEN
        renderCatalog();

        // THEN
        await screen.findByText("Blazer Cruzada Estructura");
        expect(screen.getByText("Abrigo Lana Oversize")).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /siguiente/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/página \d+/i)).not.toBeInTheDocument();
    });
});
