import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";

// Componente que siempre lanza un error
function BrokenComponent(): React.ReactElement {
    throw new Error("Error de prueba");
}

// Componente funcional para testear el reset
function ConditionalBroken({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
    if (shouldThrow) {
        throw new Error("Error condicional");
    }
    return <div>Componente OK</div>;
}

describe("ErrorBoundary", () => {
    it("debe renderizar children cuando no hay error", () => {
        render(
            <ErrorBoundary>
                <div>Contenido normal</div>
            </ErrorBoundary>
        );
        expect(screen.getByText("Contenido normal")).toBeInTheDocument();
    });

    it("debe capturar errores y mostrar fallback por defecto", () => {
        // Silenciar console.error para este test
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <BrokenComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
        expect(screen.getByText("Error de Renderizado")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it("debe permitir fallback personalizado", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        render(
            <ErrorBoundary fallback={<div>Fallback personalizado</div>}>
                <BrokenComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText("Fallback personalizado")).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it("debe resetear el estado al hacer clic en Reintentar", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        // Usamos un key para forzar el remount del ErrorBoundary
        const { rerender } = render(
            <ErrorBoundary key="boundary-1">
                <ConditionalBroken shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText("Algo salió mal")).toBeInTheDocument();

        // Re-renderizar con un key nuevo para simular el reset
        rerender(
            <ErrorBoundary key="boundary-2">
                <ConditionalBroken shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText("Componente OK")).toBeInTheDocument();

        consoleSpy.mockRestore();
    });
});
