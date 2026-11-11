import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WakeNotice, { WAKE_THRESHOLD_MS } from "@/components/WakeNotice";

/**
 * Temporizadores falsos + `act` en vez de user-event: no hay interacción, solo
 * el paso del tiempo (mismo motivo que la excepción a R7 de `AddToCartButton`).
 */
describe("Fase 10 · WakeNotice (R12)", () => {
    let resolveFetch: (value: Response) => void;
    let rejectFetch: (reason: unknown) => void;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal(
            "fetch",
            vi.fn(
                () =>
                    new Promise<Response>((res, rej) => {
                        resolveFetch = res;
                        rejectFetch = rej;
                    })
            )
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("si la API tarda más de 4 s avisa, y retira el aviso al responder", async () => {
        render(<WakeNotice active />);
        expect(fetch).toHaveBeenCalledWith("/api/v1/markets", { cache: "no-store" });

        act(() => vi.advanceTimersByTime(WAKE_THRESHOLD_MS - 1));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1));
        expect(screen.getByRole("status")).toHaveTextContent(/Despertando la demo/);

        await act(async () => resolveFetch(new Response("[]")));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("si responde antes de 4 s no avisa nunca", async () => {
        render(<WakeNotice active />);
        await act(async () => resolveFetch(new Response("[]")));
        act(() => vi.advanceTimersByTime(WAKE_THRESHOLD_MS * 2));

        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("un error de red también retira el aviso (cada página pinta su error)", async () => {
        render(<WakeNotice active />);
        act(() => vi.advanceTimersByTime(WAKE_THRESHOLD_MS));
        expect(screen.getByRole("status")).toBeInTheDocument();

        await act(async () => rejectFetch(new TypeError("Failed to fetch")));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("sin NEXT_PUBLIC_DEMO=1 no hace ninguna petición ni pinta nada", () => {
        const { container } = render(<WakeNotice />);
        act(() => vi.advanceTimersByTime(WAKE_THRESHOLD_MS * 2));

        expect(fetch).not.toHaveBeenCalled();
        expect(container).toBeEmptyDOMElement();
    });
});
