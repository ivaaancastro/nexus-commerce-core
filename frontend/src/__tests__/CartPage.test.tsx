import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CartPage from "@/app/cart/page";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { AuthProvider } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { CartItem } from "@/types/commerce";
import { User } from "@/types/auth";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, back: vi.fn(), prefetch: vi.fn() }),
    useParams: vi.fn(),
    usePathname: () => "/cart",
    useSearchParams: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api")>();
    return {
        ...actual,
        api: { ...actual.api, checkout: vi.fn(), getCurrentUser: vi.fn() },
    };
});

const mockCartItem: CartItem = {
    productId: 1,
    referenceCode: "0432/021",
    name: "Camisa de Lino",
    family: "SHIRTS",
    skuId: 101,
    size: "M",
    color: "Blanco",
    quantity: 1,
    unitPrice: 89.95,
    currency: "EUR",
};

const mockUser: User = {
    id: 1,
    email: "comprador@example.com",
    firstName: "Ana",
    lastName: "Castaño",
    birthDate: "1995-04-12",
    gender: "FEMALE",
    emailVerified: true,
};

function renderCartPage() {
    return render(
        <AuthProvider>
            <CartProvider>
                <CartDrawerProvider>
                    <CartPage />
                </CartDrawerProvider>
            </CartProvider>
        </AuthProvider>
    );
}

describe("CartPage — guard de sesión y errores amigables (specs/checkout-auth)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        // Carrito con un artículo para que se pinte el botón de checkout
        localStorage.setItem("nexus-cart", JSON.stringify([mockCartItem]));
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("T3 — sin sesión no se emite la petición y se ofrece iniciar sesión", async () => {
        renderCartPage();

        const boton = await screen.findByRole("button", { name: /tramitar pedido/i });

        fireEvent.click(boton);

        // Bug 1: el backend rechazaba la petición con 401 porque no llevaba token.
        // Ahora ni siquiera se emite.
        expect(api.checkout).not.toHaveBeenCalled();
        expect(pushMock).not.toHaveBeenCalled();

        const aviso = screen.getByText("Inicia sesión para completar tu compra");
        const contenedor = aviso.closest("div") as HTMLElement;
        const enlace = within(contenedor).getByRole("link", { name: /iniciar sesión/i });

        expect(enlace).toHaveAttribute("href", "/login");
        expect(screen.queryByText(/API Error/i)).not.toBeInTheDocument();
    });

    it("T4 — con un 401 del backend no se pinta el error técnico en pantalla", async () => {
        localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
        vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
        vi.mocked(api.checkout).mockRejectedValue(
            new Error(
                'API Error [401]: {"timestamp":"2026-10-05T12:44:52.643623+02:00",' +
                    '"status":401,"error":"Unauthorized","message":"Autenticación requerida"}'
            )
        );

        renderCartPage();

        const boton = await screen.findByRole("button", { name: /tramitar pedido/i });
        fireEvent.click(boton);

        await waitFor(() => expect(api.checkout).toHaveBeenCalledTimes(1));

        // Bug 2: el mensaje crudo «API Error [401]: {…}» llegaba al usuario
        await screen.findByText(/tu sesión ha caducado/i);

        expect(screen.queryByText(/API Error/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/timestamp/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Unauthorized/i)).not.toBeInTheDocument();
    });

    it("con sesión, el checkout se envía con la petición y se navega al recibo", async () => {
        localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
        vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
        vi.mocked(api.checkout).mockResolvedValue({
            ...mockCartItem,
            orderNumber: "ORD-2026-001",
        } as never);

        renderCartPage();

        const boton = await screen.findByRole("button", { name: /tramitar pedido/i });
        fireEvent.click(boton);

        await waitFor(() => expect(api.checkout).toHaveBeenCalledTimes(1));
        expect(api.checkout).toHaveBeenCalledWith(
            expect.objectContaining({
                marketCode: "ES",
                items: [expect.objectContaining({ skuId: 101, quantity: 1 })],
            }),
            expect.any(String)
        );
        expect(pushMock).toHaveBeenCalledWith("/orders/ORD-2026-001");
        expect(screen.queryByText(/API Error/i)).not.toBeInTheDocument();
    });

    it("un fallo de red no filtra el mensaje técnico de fetch", async () => {
        localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
        vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
        vi.mocked(api.checkout).mockRejectedValue(new TypeError("Failed to fetch"));

        renderCartPage();

        const boton = await screen.findByRole("button", { name: /tramitar pedido/i });
        fireEvent.click(boton);

        await waitFor(() => expect(api.checkout).toHaveBeenCalledTimes(1));

        expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument();
        expect(screen.queryByText(/API Error/i)).not.toBeInTheDocument();
    });
});
