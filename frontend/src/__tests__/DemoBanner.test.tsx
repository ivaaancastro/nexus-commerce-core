import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DemoBanner from "@/components/DemoBanner";
import { api } from "@/lib/api";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: pathnameMock }));

vi.mock("@/lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api")>();
    return { ...actual, api: { ...actual.api, getPaymentConfig: vi.fn() } };
});

describe("Fase 10 · DemoBanner (R6, A3)", () => {
    beforeEach(() => {
        vi.mocked(api.getPaymentConfig).mockReset();
        pathnameMock.mockReturnValue("/");
    });

    it("con demoMode = true pinta el aviso con enlace a /proyecto", async () => {
        vi.mocked(api.getPaymentConfig).mockResolvedValue({ paymentMode: "STRIPE", demoMode: true });
        render(<DemoBanner />);

        const aviso = await screen.findByRole("complementary", { name: "Demo pública" });
        expect(aviso).toHaveTextContent(/datos de prueba/i);
        expect(screen.getByRole("link", { name: "Ver el proyecto" })).toHaveAttribute("href", "/proyecto");
    });

    it("sin demoMode (dev/CI) no pinta nada", async () => {
        vi.mocked(api.getPaymentConfig).mockResolvedValue({ paymentMode: "DISABLED", demoMode: false });
        const { container } = render(<DemoBanner />);

        await waitFor(() => expect(api.getPaymentConfig).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it("si la petición falla no pinta nada ni lanza", async () => {
        vi.mocked(api.getPaymentConfig).mockRejectedValue(new Error("API Error [502]"));
        const { container } = render(<DemoBanner />);

        await waitFor(() => expect(api.getPaymentConfig).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it("en la propia /proyecto no se enlaza a sí misma", async () => {
        pathnameMock.mockReturnValue("/proyecto");
        vi.mocked(api.getPaymentConfig).mockResolvedValue({ paymentMode: "STRIPE", demoMode: true });
        const { container } = render(<DemoBanner />);

        await waitFor(() => expect(api.getPaymentConfig).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
