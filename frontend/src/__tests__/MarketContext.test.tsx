import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarketProvider, useMarket } from "@/context/MarketContext";
import { api } from "@/lib/api";
import { Market } from "@/types/commerce";

vi.mock("@/lib/api", () => ({
    api: {
        getMarkets: vi.fn(),
    },
}));

/** Los mismos 4 que devuelve V1, ordenados por code como hace MarketService. */
const MARKETS: Market[] = [
    { code: "CH", name: "Switzerland", currency: "CHF", taxRate: 8.1 },
    { code: "ES", name: "España", currency: "EUR", taxRate: 21 },
    { code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 },
    { code: "US", name: "United States", currency: "USD", taxRate: 7.25 },
];

function TestComponent() {
    const { markets, market, setMarketCode } = useMarket();

    return (
        <div>
            <span data-testid="code">{market.code}</span>
            <span data-testid="currency">{market.currency}</span>
            <span data-testid="tax">{market.taxRate}</span>
            <span data-testid="count">{markets.length}</span>
            <button onClick={() => setMarketCode("UK")}>UK</button>
            <button onClick={() => setMarketCode("XX")}>XX</button>
        </div>
    );
}

function renderProvider() {
    return render(
        <MarketProvider>
            <TestComponent />
        </MarketProvider>
    );
}

describe("MarketContext", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        vi.mocked(api.getMarkets).mockResolvedValue(MARKETS);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("R3 — debe usar ES por defecto cuando no hay nada persistido", async () => {
        // GIVEN / WHEN
        renderProvider();

        // THEN
        await waitFor(() =>
            expect(screen.getByTestId("count")).toHaveTextContent("4")
        );
        expect(screen.getByTestId("code")).toHaveTextContent("ES");
        expect(screen.getByTestId("currency")).toHaveTextContent("EUR");
    });

    it("R3 — debe leer el mercado persistido en localStorage (objeto completo)", async () => {
        // GIVEN — D4: se guarda entero para que el primer pintado ya tenga
        // divisa y tasa sin esperar a la respuesta del endpoint.
        localStorage.setItem(
            "nexus-market",
            JSON.stringify({ code: "UK", name: "United Kingdom", currency: "GBP", taxRate: 20 })
        );

        // WHEN
        renderProvider();

        // THEN
        await waitFor(() =>
            expect(screen.getByTestId("code")).toHaveTextContent("UK")
        );
        expect(screen.getByTestId("currency")).toHaveTextContent("GBP");
        expect(screen.getByTestId("tax")).toHaveTextContent("20");
    });

    it("R3 — debe volver a ES si el JSON de localStorage está corrupto", async () => {
        // GIVEN — useLocalStorage traga el error de parse y deja el valor inicial
        localStorage.setItem("nexus-market", "esto no es json {{{");

        // WHEN
        renderProvider();

        // THEN
        await waitFor(() =>
            expect(screen.getByTestId("count")).toHaveTextContent("4")
        );
        expect(screen.getByTestId("code")).toHaveTextContent("ES");
    });

    it("R3 — debe volver a ES si el JSON es válido pero no es un mercado", async () => {
        // GIVEN — JSON parseable que no tiene la forma de Market
        localStorage.setItem("nexus-market", JSON.stringify({ foo: "bar" }));

        // WHEN
        renderProvider();

        // THEN
        await waitFor(() =>
            expect(screen.getByTestId("count")).toHaveTextContent("4")
        );
        expect(screen.getByTestId("code")).toHaveTextContent("ES");
        expect(screen.getByTestId("currency")).toHaveTextContent("EUR");
    });

    it("R3 — debe volver a ES si el código guardado ya no existe en el backend", async () => {
        // GIVEN — mercado que el backend ya no devuelve (p. ej. retirado)
        localStorage.setItem(
            "nexus-market",
            JSON.stringify({ code: "DE", name: "Alemania", currency: "EUR", taxRate: 19 })
        );

        // WHEN
        renderProvider();

        // THEN
        await waitFor(() =>
            expect(screen.getByTestId("code")).toHaveTextContent("ES")
        );
        expect(screen.getByTestId("count")).toHaveTextContent("4");
    });

    it("R2/R3 — debe persistir el mercado elegido al cambiarlo", async () => {
        // GIVEN
        renderProvider();
        await waitFor(() =>
            expect(screen.getByTestId("count")).toHaveTextContent("4")
        );

        // WHEN
        fireEvent.click(screen.getByText("UK"));

        // THEN
        await waitFor(() =>
            expect(screen.getByTestId("code")).toHaveTextContent("UK")
        );
        const stored = JSON.parse(localStorage.getItem("nexus-market")!);
        expect(stored.code).toBe("UK");
        expect(stored.currency).toBe("GBP");
    });

    it("R1 — la lista de mercados viene del endpoint, no de una constante", async () => {
        // GIVEN / WHEN
        renderProvider();

        // THEN — la lista viene del endpoint, no de una constante del cliente
        await waitFor(() =>
            expect(api.getMarkets).toHaveBeenCalledTimes(1)
        );
        expect(screen.getByTestId("count")).toHaveTextContent("4");
    });
});
