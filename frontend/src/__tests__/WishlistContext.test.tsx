import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { WishlistProvider, useWishlist } from "@/context/WishlistContext";
import { api } from "@/lib/api";
import type { WishlistItem } from "@/types/commerce";
import type { User } from "@/types/auth";

/**
 * V3 wishlist (plan D6, R5) — `WishlistContext` con **AuthProvider real** y
 * `api` mockeado, mismo armazón que `AuthContext.test`.
 *
 * Cubre: hidratación con sesión · sin sesión sin peticiones · logout que limpia
 * la lista · mutaciones que reflejan la respuesta del servidor (nada
 * optimista) · error que **propaga sin mutar** · `hasLoadError` + `reload`.
 *
 * Sonda: el estado se ejercita y se verifica **por el DOM** (botones +
 * `data-testid`); no se escriben variables del módulo desde el render
 * (`react-hooks/globals`, medido).
 */

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getWishlist: vi.fn(),
        addWishlistItem: vi.fn(),
        removeWishlistItem: vi.fn(),
        clearWishlist: vi.fn(),
    },
}));

type Ctx = ReturnType<typeof useWishlist>;

/**
 * Sonda: TODO el estado sale por el DOM (`data-testid`) y los errores se
 * pintan con `useState` local — escribir variables del módulo desde el render
 * lo prohíbe `react-hooks/globals` (medido).
 */
function Sonda() {
    const wishlist: Ctx = useWishlist();
    const { logout } = useAuth();
    const [ultimoError, setUltimoError] = useState<string | null>(null);
    return (
        <div>
            <span data-testid="ids">
                {wishlist.items.map((i) => i.product.id).join(",")}
            </span>
            <span data-testid="hidratado">{String(wishlist.isHydrated)}</span>
            <span data-testid="error">{String(wishlist.hasLoadError)}</span>
            <span data-testid="guardado-5">{String(wishlist.isSaved(5))}</span>
            <span data-testid="ultimo-error">{ultimoError ?? ""}</span>
            <button
                onClick={() =>
                    wishlist
                        .toggle(5)
                        .catch((e: Error) => setUltimoError(e.message))
                }
            >
                toggle
            </button>
            <button onClick={() => void wishlist.remove(5)}>remove</button>
            <button onClick={() => void wishlist.clear()}>clear</button>
            <button onClick={wishlist.reload}>reload</button>
            <button onClick={logout}>logout</button>
        </div>
    );
}

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

function item(id: number, productId: number, nombre: string): WishlistItem {
    return {
        id,
        addedAt: "2026-10-26T12:00:00+01:00",
        product: {
            id: productId,
            referenceCode: `REF-${productId}`,
            name: nombre,
            family: "OUTERWEAR",
            skus: [],
        },
    };
}

function renderProvider() {
    return render(
        <AuthProvider>
            <WishlistProvider>
                <Sonda />
            </WishlistProvider>
        </AuthProvider>
    );
}

function boton(nombre: string) {
    // Ojo con el shorthand `{ name }`: resuelvería a `window.name` ("").
    return screen.getByRole("button", { name: nombre });
}

describe("WishlistContext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
        vi.mocked(api.getWishlist).mockResolvedValue({ items: [] });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("hidrata la lista con sesión: GET una vez e items expuestos (R5.1)", async () => {
        vi.mocked(api.getWishlist).mockResolvedValue({
            items: [item(3, 5, "Blazer Lino")],
        });

        renderProvider();

        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("5");
        });
        expect(api.getWishlist).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("hidratado")).toHaveTextContent("true");
        expect(screen.getByTestId("guardado-5")).toHaveTextContent("true");
    });

    it("sin sesión: no se pide nada y la lista queda vacía (D6)", async () => {
        localStorage.removeItem("nexus-auth-token");

        renderProvider();

        await waitFor(() => {
            expect(screen.getByTestId("hidratado")).toHaveTextContent("true");
        });
        expect(api.getWishlist).not.toHaveBeenCalled();
        expect(screen.getByTestId("ids")).toHaveTextContent("");
    });

    it("logout: limpia la lista — nunca se filtra la cuenta anterior", async () => {
        vi.mocked(api.getWishlist).mockResolvedValue({
            items: [item(3, 5, "Blazer Lino")],
        });
        renderProvider();
        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("5");
        });

        await userEvent.click(boton("logout"));

        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("");
        });
        expect(screen.getByTestId("guardado-5")).toHaveTextContent("false");
    });

    it("toggle sin guardar: POST, el ítem entra por la respuesta del servidor (sin optimismo)", async () => {
        vi.mocked(api.addWishlistItem).mockResolvedValue(
            item(9, 5, "Blazer Lino")
        );
        renderProvider();
        await waitFor(() => {
            expect(screen.getByTestId("hidratado")).toHaveTextContent("true");
        });

        await userEvent.click(boton("toggle"));

        expect(api.addWishlistItem).toHaveBeenCalledWith(5);
        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("5");
        });
        expect(screen.getByTestId("guardado-5")).toHaveTextContent("true");
    });

    it("toggle guardado: DELETE y el ítem sale de la lista", async () => {
        vi.mocked(api.getWishlist).mockResolvedValue({
            items: [item(3, 5, "Blazer Lino")],
        });
        vi.mocked(api.removeWishlistItem).mockResolvedValue(undefined);
        renderProvider();
        await waitFor(() => {
            expect(screen.getByTestId("guardado-5")).toHaveTextContent("true");
        });

        await userEvent.click(boton("toggle"));

        expect(api.removeWishlistItem).toHaveBeenCalledWith(5);
        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("");
        });
    });

    it("remove y clear vacían exactamente lo que toca", async () => {
        vi.mocked(api.getWishlist).mockResolvedValue({
            items: [item(3, 5, "Blazer Lino"), item(4, 6, "Abrigo Lana")],
        });
        vi.mocked(api.removeWishlistItem).mockResolvedValue(undefined);
        vi.mocked(api.clearWishlist).mockResolvedValue(undefined);
        renderProvider();
        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("5,6");
        });

        await userEvent.click(boton("remove"));
        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("6");
        });
        expect(api.removeWishlistItem).toHaveBeenCalledWith(5);

        await userEvent.click(boton("clear"));
        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("");
        });
        expect(api.clearWishlist).toHaveBeenCalledTimes(1);
    });

    it("error de red en toggle: propaga la excepción y NO muta el estado (R5.4)", async () => {
        vi.mocked(api.addWishlistItem).mockRejectedValue(
            new Error("API Error [500]: caída")
        );
        renderProvider();
        await waitFor(() => {
            expect(screen.getByTestId("hidratado")).toHaveTextContent("true");
        });

        await userEvent.click(boton("toggle"));

        await waitFor(() => {
            expect(screen.getByTestId("ultimo-error")).toHaveTextContent(
                "API Error [500]"
            );
        });
        expect(screen.getByTestId("ids")).toHaveTextContent("");
        expect(screen.getByTestId("guardado-5")).toHaveTextContent("false");
        expect(boton("toggle")).toBeEnabled();
    });

    it("fallo en la carga: hasLoadError y reload reintenta (R7.5)", async () => {
        vi.mocked(api.getWishlist)
            .mockRejectedValueOnce(new Error("API Error [500]: caída"))
            .mockResolvedValue({ items: [item(3, 5, "Blazer Lino")] });

        renderProvider();

        await waitFor(() => {
            expect(screen.getByTestId("error")).toHaveTextContent("true");
        });

        await userEvent.click(boton("reload"));

        await waitFor(() => {
            expect(screen.getByTestId("ids")).toHaveTextContent("5");
        });
        expect(screen.getByTestId("error")).toHaveTextContent("false");
        expect(api.getWishlist).toHaveBeenCalledTimes(2);
    });
});
