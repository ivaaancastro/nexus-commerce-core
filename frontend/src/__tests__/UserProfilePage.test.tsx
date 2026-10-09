import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ProfilePage from "@/app/profile/page";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";
import type { User } from "@/types/auth";

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
        updateProfile: vi.fn(),
        getAddresses: vi.fn(),
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

function renderProfile() {
    return render(
        <AuthProvider>
            <CartProvider>
                <CartDrawerProvider>
                    <ProfilePage />
                </CartDrawerProvider>
            </CartProvider>
        </AuthProvider>
    );
}

describe("ProfilePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("nexus-auth-token", "fake-token");
        vi.mocked(api.getCurrentUser).mockResolvedValue(baseUser);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("debe renderizar el perfil precargado con los datos del usuario", async () => {
        // GIVEN
        vi.mocked(api.getProfile).mockResolvedValue(baseUser);

        // WHEN
        renderProfile();

        // THEN
        await waitFor(() => {
            expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
            expect(screen.getByLabelText("Apellido")).toHaveValue("García");
            expect(screen.getByLabelText("Teléfono")).toHaveValue("612345678");
            // toHaveValue convierte los input[type=number] a number
            expect(screen.getByLabelText("Altura (cm)")).toHaveValue(175);
            expect(screen.getByLabelText("Peso (kg)")).toHaveValue(70);
        });
    });

    it("debe mostrar el email como campo de solo lectura", async () => {
        // GIVEN
        vi.mocked(api.getProfile).mockResolvedValue(baseUser);

        // WHEN
        renderProfile();

        // THEN
        await waitFor(() => {
            const emailField = screen.getByLabelText("Email");
            expect(emailField).toBeDisabled();
            expect(emailField).toHaveValue("ana@example.com");
        });
        expect(
            screen.getByText(/el email no puede modificarse desde aquí/i)
        ).toBeInTheDocument();
    });

    it("debe validar que la altura esté entre 100 y 250 cm sin llamar a la API", async () => {
        // GIVEN
        vi.mocked(api.getProfile).mockResolvedValue(baseUser);
        const user = userEvent.setup();

        renderProfile();
        const heightField = await screen.findByLabelText("Altura (cm)");

        // WHEN
        await user.clear(heightField);
        await user.type(heightField, "50");
        await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

        // THEN
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "La altura debe estar entre 100 y 250 cm"
        );
        expect(api.updateProfile).not.toHaveBeenCalled();
    });

    it("debe validar que el peso esté entre 30 y 250 kg sin llamar a la API", async () => {
        // GIVEN
        vi.mocked(api.getProfile).mockResolvedValue(baseUser);
        const user = userEvent.setup();

        renderProfile();
        const weightField = await screen.findByLabelText("Peso (kg)");

        // WHEN
        await user.clear(weightField);
        await user.type(weightField, "300");
        await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

        // THEN
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "El peso debe estar entre 30 y 250 kg"
        );
        expect(api.updateProfile).not.toHaveBeenCalled();
    });

    it("debe rechazar una fecha de nacimiento futura", async () => {
        // GIVEN
        vi.mocked(api.getProfile).mockResolvedValue(baseUser);
        const user = userEvent.setup();

        renderProfile();
        const dateField = await screen.findByLabelText("Fecha de nacimiento");

        // WHEN
        await user.clear(dateField);
        await user.type(dateField, "2099-01-01");
        await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

        // THEN
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "La fecha de nacimiento no puede ser futura"
        );
        expect(api.updateProfile).not.toHaveBeenCalled();
    });

    it("debe guardar los cambios y mostrar confirmación", async () => {
        // GIVEN
        vi.mocked(api.getProfile).mockResolvedValue(baseUser);
        vi.mocked(api.updateProfile).mockResolvedValue({
            ...baseUser,
            firstName: "Ana María",
        });
        const user = userEvent.setup();

        renderProfile();

        // WHEN
        const firstNameField = await screen.findByLabelText("Nombre");
        await user.clear(firstNameField);
        await user.type(firstNameField, "Ana María");
        await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

        // THEN
        await waitFor(() => {
            expect(api.updateProfile).toHaveBeenCalledWith(
                expect.objectContaining({ firstName: "Ana María" })
            );
        });
        expect(await screen.findByRole("status")).toHaveTextContent(
            /Perfil actualizado correctamente/i
        );
    });

    it("debe traducir un error técnico de la API a un mensaje amigable", async () => {
        // GIVEN
        vi.mocked(api.getProfile).mockResolvedValue(baseUser);
        vi.mocked(api.updateProfile).mockRejectedValue(
            new Error("API Error [500]: Internal Server Error")
        );
        const user = userEvent.setup();

        renderProfile();

        // WHEN
        await screen.findByLabelText("Nombre");
        await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

        // THEN
        const alert = await screen.findByRole("alert");
        expect(alert).not.toHaveTextContent("API Error");
        expect(alert).toHaveTextContent(/algo salió mal|intenta de nuevo/i);
    });
});
