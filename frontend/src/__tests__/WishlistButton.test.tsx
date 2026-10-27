import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthProvider } from "@/context/AuthContext";
import { WishlistProvider } from "@/context/WishlistContext";
import WishlistButton from "@/components/WishlistButton";
import { api } from "@/lib/api";
import type { WishlistItem } from "@/types/commerce";
import type { User } from "@/types/auth";

/**
 * V3 wishlist (plan D7, R5) — el corazón reutilizable de la PDP y la tarjeta.
 *
 * Cubre: nombre accesible + `aria-pressed` correcto en los dos estados ·
 * **sin sesión → `/login` sin emitir POST** (R5.3) · la mutación refleja la
 * respuesta del servidor · error de red → toast con
 * `getFriendlyErrorMessage()` **sin cambiar el estado** (R5.4).
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
        addWishlistItem: vi.fn(),
        removeWishlistItem: vi.fn(),
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

const GUARDADO: WishlistItem = {
    id: 3,
    addedAt: "2026-10-26T12:00:00+01:00",
    product: {
        id: 5,
        referenceCode: "0432/021",
        name: "Blazer Lino",
        family: "OUTERWEAR",
        skus: [],
    },
};

function renderBoton() {
    return render(
        <AuthProvider>
            <WishlistProvider>
                <WishlistButton productId={5} productName="Blazer Lino" />
            </WishlistProvider>
        </AuthProvider>
    );
}

describe("WishlistButton", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
        vi.mocked(api.getWishlist).mockResolvedValue({ items: [] });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("sin sesión: el pulso lleva a /login y NO emite ninguna petición (R5.3)", async () => {
        localStorage.removeItem("nexus-auth-token");

        renderBoton();
        const corazon = await screen.findByRole("button", {
            name: "Guardar Blazer Lino en favoritos",
        });
        expect(corazon).toHaveAttribute("aria-pressed", "false");

        await userEvent.click(corazon);

        expect(push).toHaveBeenCalledWith("/login");
        expect(api.addWishlistItem).not.toHaveBeenCalled();
        expect(api.removeWishlistItem).not.toHaveBeenCalled();
    });

    it("guardar: aria-pressed pasa a true con la respuesta del POST (R5.1)", async () => {
        vi.mocked(api.addWishlistItem).mockResolvedValue(GUARDADO);

        renderBoton();
        const corazon = await screen.findByRole("button", {
            name: "Guardar Blazer Lino en favoritos",
        });
        expect(corazon).toHaveAttribute("aria-pressed", "false");

        await userEvent.click(corazon);

        expect(api.addWishlistItem).toHaveBeenCalledWith(5);
        await waitFor(() => {
            expect(
                screen.getByRole("button", {
                    name: "Quitar Blazer Lino de favoritos",
                })
            ).toHaveAttribute("aria-pressed", "true");
        });
    });

    it("quitar: con la lista ya cargada, aria-pressed true y el DELETE lo apaga", async () => {
        vi.mocked(api.getWishlist).mockResolvedValue({ items: [GUARDADO] });
        vi.mocked(api.removeWishlistItem).mockResolvedValue(undefined);

        renderBoton();
        const corazon = await screen.findByRole("button", {
            name: "Quitar Blazer Lino de favoritos",
        });
        expect(corazon).toHaveAttribute("aria-pressed", "true");

        await userEvent.click(corazon);

        expect(api.removeWishlistItem).toHaveBeenCalledWith(5);
        await waitFor(() => {
            expect(
                screen.getByRole("button", {
                    name: "Guardar Blazer Lino en favoritos",
                })
            ).toHaveAttribute("aria-pressed", "false");
        });
    });

    it("error de red: toast amigable, estado intacto y botón operativo (R5.4)", async () => {
        vi.mocked(api.addWishlistItem).mockRejectedValue(
            new Error("API Error [500]: caída")
        );

        renderBoton();
        const corazon = await screen.findByRole("button", {
            name: "Guardar Blazer Lino en favoritos",
        });

        await userEvent.click(corazon);

        // Toast con la traducción de getFriendlyErrorMessage() (500)
        const aviso = await screen.findByRole("status");
        expect(aviso).toHaveTextContent(
            "Algo salió mal. Inténtalo de nuevo en unos minutos."
        );
        // El estado NO cambió (mutación no optimista) y se puede reintentar
        expect(
            screen.getByRole("button", {
                name: "Guardar Blazer Lino en favoritos",
            })
        ).toHaveAttribute("aria-pressed", "false");
        expect(corazon).toBeEnabled();
    });
});
