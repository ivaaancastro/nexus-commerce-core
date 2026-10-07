import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Toast from "@/components/Toast";

/**
 * Tarea 4.1, R6 — toast de confirmación.
 *
 * El caso que protege el arreglo de lint es la **alternancia** de `isVisible`:
 * el estado de la animación ahora se deriva de la prop en el render en que
 * cambia, de modo que el toast vuelve a aparecer y a irse sin que un efecto
 * tenga que reescribirlo.
 */

describe("Toast", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("sin visibilidad y sin animación pendiente no renderiza nada", () => {
        const { container } = render(
            <Toast message="Guardado" isVisible={false} onClose={vi.fn()} />
        );

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("anuncia el mensaje con role=status y aria-live=polite", () => {
        render(<Toast message="Guardado" isVisible={true} onClose={vi.fn()} />);

        const status = screen.getByRole("status");
        expect(status).toHaveAttribute("aria-live", "polite");
        expect(status).toHaveTextContent("Guardado");
    });

    it("se cierra solo: `duration` ms y después los 300 ms de salida", () => {
        // GIVEN temporizadores falsos y un toast visible
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(<Toast message="Guardado" isVisible={true} onClose={onClose} duration={2500} />);

        // WHEN corre el tiempo de lectura
        act(() => {
            vi.advanceTimersByTime(2500);
        });

        // THEN aún no se avisa: queda la animación de salida
        expect(onClose).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("vuelve a aparecer al alternar isVisible (regresión del arreglo R6)", () => {
        // GIVEN un toast apagado
        const { rerender } = render(
            <Toast message="Guardado" isVisible={false} onClose={vi.fn()} />
        );
        expect(screen.queryByRole("status")).not.toBeInTheDocument();

        // WHEN se enciende
        rerender(<Toast message="Guardado" isVisible={true} onClose={vi.fn()} />);
        expect(screen.getByRole("status")).toHaveTextContent("Guardado");

        // WHEN se apaga de nuevo
        rerender(<Toast message="Guardado" isVisible={false} onClose={vi.fn()} />);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();

        // THEN una segunda vez vuelve a salir con su mensaje
        rerender(<Toast message="Guardado" isVisible={true} onClose={vi.fn()} />);
        expect(screen.getByRole("status")).toHaveTextContent("Guardado");
    });

    it("la salida no deja el nodo en el aire cuando el padre lo oculta", () => {
        // GIVEN un toast visible y animado
        const { rerender } = render(
            <Toast message="Guardado" isVisible={true} onClose={vi.fn()} />
        );
        expect(screen.getByRole("status")).toBeInTheDocument();

        // WHEN el padre lo apaga sin pasar por onClose
        rerender(<Toast message="Guardado" isVisible={false} onClose={vi.fn()} />);

        // THEN desaparece de inmediato en vez de quedarse pegado
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});
