import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactElement } from "react";
import LoginPage from "@/app/login/page";
import VerifyEmailPage from "@/app/verify-email/page";
import RegisterPage from "@/app/register/page";
import ForgotPasswordPage from "@/app/forgot-password/page";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawerProvider } from "@/context/CartDrawerContext";
import { api } from "@/lib/api";

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    search: "",
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
    useParams: vi.fn(),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/lib/api", () => ({
    api: {
        login: vi.fn(),
        register: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerificationCode: vi.fn(),
        forgotPassword: vi.fn(),
        resetPassword: vi.fn(),
        getCurrentUser: vi.fn(),
    },
}));

function renderWithProviders(ui: ReactElement) {
    return render(
        <CartProvider>
            <CartDrawerProvider>
                <AuthProvider>{ui}</AuthProvider>
            </CartDrawerProvider>
        </CartProvider>
    );
}

/**
 * Fix F1-F7: el código de verificación existía pero no tenía puntos de
 * entrada alcanzables. Estos tests reproducen ese bug.
 */
describe("Puntos de entrada del código de verificación", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.search = "";
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe("/login — accesos directos", () => {
        it("F4: debe enlazar a /verify-email sin necesidad de reenviar antes", async () => {
            // GIVEN / WHEN
            renderWithProviders(<LoginPage />);

            // THEN
            const link = await screen.findByRole("link", {
                name: /Ya tienes un código/i,
            });
            expect(link).toHaveAttribute("href", "/verify-email");
        });

        it("F5: con email no verificado debe ofrecer «Verificar ahora» con el email precargado", async () => {
            // GIVEN
            const user = userEvent.setup();
            vi.mocked(api.login).mockRejectedValue(new Error("Email no verificado"));
            renderWithProviders(<LoginPage />);

            // WHEN
            await user.type(screen.getByLabelText("Email"), "ana@example.com");
            await user.type(screen.getByLabelText("Contraseña"), "password123");
            await user.click(screen.getByRole("button", { name: "Entrar" }));

            // THEN: mensaje amigable + salida directa al formulario de código
            expect(
                await screen.findByText(/Debes verificar tu email/i)
            ).toBeInTheDocument();

            const verifyLink = await screen.findByRole("link", {
                name: "Verificar ahora",
            });
            expect(verifyLink).toHaveAttribute(
                "href",
                "/verify-email?email=ana%40example.com"
            );
        });

        it("no debe mostrar el botón de verificar ante un error distinto", async () => {
            // GIVEN
            const user = userEvent.setup();
            vi.mocked(api.login).mockRejectedValue(new Error("Credenciales inválidas"));
            renderWithProviders(<LoginPage />);

            // WHEN
            await user.type(screen.getByLabelText("Email"), "ana@example.com");
            await user.type(screen.getByLabelText("Contraseña"), "password123");
            await user.click(screen.getByRole("button", { name: "Entrar" }));

            // THEN
            expect(
                await screen.findByText(/son incorrectos/i)
            ).toBeInTheDocument();
            expect(
                screen.queryByRole("link", { name: "Verificar ahora" })
            ).not.toBeInTheDocument();
        });
    });

    describe("/verify-email — reglas de estilo y errores", () => {
        it("F6: los dos inputs deben llevar text-neutral-900 (regla #7)", async () => {
            // GIVEN / WHEN
            const { container } = renderWithProviders(<VerifyEmailPage />);
            await screen.findByRole("button", { name: "Verificar" });

            // THEN
            const inputs = container.querySelectorAll("input");
            expect(inputs).toHaveLength(2);
            inputs.forEach((input) => {
                expect(input.className).toContain("text-neutral-900");
            });
        });

        it("F7: debe traducir el error del backend (regla #9) y no filtrar el técnico", async () => {
            // GIVEN
            const user = userEvent.setup();
            vi.mocked(api.verifyEmail).mockRejectedValue(
                new Error("Código de verificación inválido")
            );
            mocks.search = "email=ana@example.com";

            renderWithProviders(<VerifyEmailPage />);
            await screen.findByRole("button", { name: "Verificar" });

            // WHEN
            await user.type(
                screen.getByLabelText("Código de verificación"),
                "000000"
            );
            await user.click(screen.getByRole("button", { name: "Verificar" }));

            // THEN
            expect(
                await screen.findByText(
                    "El código de verificación no es correcto. Inténtalo de nuevo."
                )
            ).toBeInTheDocument();
            expect(
                screen.queryByText("Código de verificación inválido")
            ).not.toBeInTheDocument();
        });

        it("debe precargar el email que llega por la URL", async () => {
            // GIVEN
            mocks.search = "email=ana@example.com";

            // WHEN
            renderWithProviders(<VerifyEmailPage />);
            await screen.findByRole("button", { name: "Verificar" });

            // THEN
            expect(screen.getByDisplayValue("ana@example.com")).toBeInTheDocument();
        });
    });

    describe("F8 — etiquetas accesibles en las pantallas de auth", () => {
        it("/login: los label deben encontrar su control", async () => {
            // GIVEN / WHEN
            const { unmount } = renderWithProviders(<LoginPage />);
            await screen.findByRole("button", { name: "Entrar" });

            // THEN
            expect(screen.getByLabelText("Email")).toBeInTheDocument();
            expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
            unmount();
        });

        it("/verify-email: los label deben encontrar su control", async () => {
            // GIVEN / WHEN
            const { unmount } = renderWithProviders(<VerifyEmailPage />);
            await screen.findByRole("button", { name: "Verificar" });

            // THEN
            expect(screen.getByLabelText("Email")).toBeInTheDocument();
            expect(screen.getByLabelText("Código de verificación")).toBeInTheDocument();
            unmount();
        });

        it("/register: todos los label deben encontrar su control", async () => {
            // GIVEN / WHEN
            const { unmount } = renderWithProviders(<RegisterPage />);

            // THEN
            ["Nombre", "Apellido", "Email", "Contraseña", "Teléfono (opcional)",
             "Fecha de nacimiento", "Género", "Altura (cm)", "Peso (kg)"].forEach((nombre) => {
                expect(screen.getByLabelText(nombre)).toBeInTheDocument();
            });
            unmount();
        });

        it("/forgot-password: los label deben encontrar su control", () => {
            // GIVEN / WHEN
            const { unmount } = renderWithProviders(<ForgotPasswordPage />);

            // THEN
            expect(screen.getByLabelText("Email")).toBeInTheDocument();
            unmount();
        });
    });
});
