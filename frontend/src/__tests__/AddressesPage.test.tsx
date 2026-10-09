import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AddressesPage from "@/app/addresses/page";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import type { Address, User } from "@/types/auth";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace, push }),
    useParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getCurrentUser: vi.fn(),
        getProfile: vi.fn(),
        getAddresses: vi.fn(),
        createAddress: vi.fn(),
        updateAddress: vi.fn(),
        deleteAddress: vi.fn(),
    },
}));

const user: User = {
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

const defaultAddress: Address = {
    id: 1,
    fullName: "Ana García",
    street: "Calle Mayor 1",
    city: "Madrid",
    postalCode: "28001",
    countryCode: "ES",
    defaultAddress: true,
};

const secondAddress: Address = {
    id: 2,
    fullName: "Ana García",
    street: "Avenida del Sol 22",
    city: "Sevilla",
    postalCode: "41001",
    countryCode: "ES",
    defaultAddress: false,
};

function renderAddresses() {
    return render(
        <AuthProvider>
            <CartProvider>
                <CartDrawerProvider>
                    <AddressesPage />
                </CartDrawerProvider>
            </CartProvider>
        </AuthProvider>
    );
}

describe("AddressesPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(user);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("debe listar las direcciones marcando la principal con su badge", async () => {
        // GIVEN
        vi.mocked(api.getAddresses).mockResolvedValue([defaultAddress, secondAddress]);

        // WHEN
        renderAddresses();

        // THEN
        await waitFor(() => {
            expect(screen.getByTestId("address-1")).toBeInTheDocument();
            expect(screen.getByTestId("address-2")).toBeInTheDocument();
        });
        expect(screen.getByText("Principal")).toBeInTheDocument();
        expect(screen.getByText("Calle Mayor 1")).toBeInTheDocument();
        expect(screen.getByText(/41001\s+Sevilla/)).toBeInTheDocument();
        expect(screen.getByText(/2 de 2 direcciones guardadas/)).toBeInTheDocument();
    });

    it("debe mostrar un estado vacío cuando no hay direcciones", async () => {
        // GIVEN
        vi.mocked(api.getAddresses).mockResolvedValue([]);

        // WHEN
        renderAddresses();

        // THEN
        await waitFor(() => {
            expect(
                screen.getByText(/Todavía no has guardado ninguna dirección/i)
            ).toBeInTheDocument();
        });
        expect(screen.getByText(/0 de 2 direcciones guardadas/)).toBeInTheDocument();
    });

    it("debe deshabilitar el botón de añadir al alcanzar el límite de 2", async () => {
        // GIVEN
        vi.mocked(api.getAddresses).mockResolvedValue([defaultAddress, secondAddress]);

        // WHEN
        renderAddresses();

        // THEN
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Añadir dirección/i })).toBeDisabled();
        });
        expect(
            screen.getByText(/Has alcanzado el máximo de 2 direcciones/i)
        ).toBeInTheDocument();
    });

    it("debe permitir añadir cuando todavía no se alcanzó el límite", async () => {
        // GIVEN
        vi.mocked(api.getAddresses).mockResolvedValue([defaultAddress]);
        const userEventLib = userEvent.setup();

        // WHEN
        renderAddresses();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Añadir dirección/i })).toBeEnabled();
        });
        await userEventLib.click(screen.getByRole("button", { name: /Añadir dirección/i }));

        // THEN
        expect(await screen.findByRole("heading", { name: /Nueva dirección/i })).toBeInTheDocument();
        expect(screen.getByLabelText("Calle y número")).toBeInTheDocument();
    });

    it("debe pedir confirmación antes de eliminar una dirección", async () => {
        // GIVEN
        vi.mocked(api.getAddresses).mockResolvedValue([defaultAddress, secondAddress]);
        const userEventLib = userEvent.setup();

        // WHEN
        renderAddresses();
        const card = await screen.findByTestId("address-2");
        await userEventLib.click(within(card).getByRole("button", { name: /Eliminar/i }));

        // THEN: aún no se ha llamado a la API, solo aparece la confirmación
        expect(api.deleteAddress).not.toHaveBeenCalled();
        expect(within(card).getByText("¿Eliminar?")).toBeInTheDocument();
        expect(within(card).getByRole("button", { name: "Sí, eliminar" })).toBeInTheDocument();

        // WHEN confirmo
        vi.mocked(api.deleteAddress).mockResolvedValue(undefined);
        await userEventLib.click(within(card).getByRole("button", { name: "Sí, eliminar" }));

        // THEN
        await waitFor(() => {
            expect(api.deleteAddress).toHaveBeenCalledWith(2);
        });
    });

    it("debe rechazar el guardado si falta algún campo obligatorio", async () => {
        // GIVEN
        vi.mocked(api.getAddresses).mockResolvedValue([defaultAddress]);
        const userEventLib = userEvent.setup();

        renderAddresses();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Añadir dirección/i })).toBeEnabled();
        });
        await userEventLib.click(screen.getByRole("button", { name: /Añadir dirección/i }));
        await screen.findByRole("heading", { name: /Nueva dirección/i });

        // WHEN: relleno solo el nombre, dejando la calle vacía
        await userEventLib.type(screen.getByLabelText("Nombre del destinatario"), "Ana García");
        await userEventLib.click(screen.getByRole("button", { name: "Guardar" }));

        // THEN
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "La calle es obligatoria"
        );
        expect(api.createAddress).not.toHaveBeenCalled();
    });

    it("debe crear una dirección válida y recargar la lista", async () => {
        // GIVEN
        vi.mocked(api.getAddresses).mockResolvedValue([defaultAddress]);
        const userEventLib = userEvent.setup();

        renderAddresses();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Añadir dirección/i })).toBeEnabled();
        });
        await userEventLib.click(screen.getByRole("button", { name: /Añadir dirección/i }));
        await screen.findByRole("heading", { name: /Nueva dirección/i });

        // WHEN
        await userEventLib.type(screen.getByLabelText("Nombre del destinatario"), "Ana García");
        await userEventLib.type(screen.getByLabelText("Calle y número"), "Calle Nueva 5");
        await userEventLib.type(screen.getByLabelText("Código postal"), "28002");
        await userEventLib.type(screen.getByLabelText("Ciudad"), "Madrid");

        vi.mocked(api.createAddress).mockResolvedValue({ ...secondAddress, id: 3 });
        vi.mocked(api.getAddresses).mockResolvedValue([defaultAddress, secondAddress]);

        await userEventLib.click(screen.getByRole("button", { name: "Guardar" }));

        // THEN
        await waitFor(() => {
            expect(api.createAddress).toHaveBeenCalledWith(
                expect.objectContaining({
                    fullName: "Ana García",
                    street: "Calle Nueva 5",
                    city: "Madrid",
                })
            );
        });
        expect(await screen.findByRole("status")).toHaveTextContent(
            /Dirección añadida correctamente/i
        );
    });
});
