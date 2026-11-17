import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocaleProvider, useLocale } from "@/hooks/useLocale";

function TestComponent() {
    const { locale, setLocale, t } = useLocale();
    return (
        <div>
            <span data-testid="locale">{locale}</span>
            <span data-testid="t">{t("nav.collection")}</span>
            <button onClick={() => setLocale("en")}>EN</button>
            <button onClick={() => setLocale("es")}>ES</button>
        </div>
    );
}

function TestComponentSinProvider() {
    const { locale, t } = useLocale();
    return (
        <div>
            <span data-testid="locale">{locale}</span>
            <span data-testid="t">{t("nav.collection")}</span>
        </div>
    );
}

function renderProvider() {
    return render(
        <LocaleProvider>
            <TestComponent />
        </LocaleProvider>
    );
}

describe("useLocale (Fase 12)", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("por defecto es español", () => {
        renderProvider();
        expect(screen.getByTestId("locale")).toHaveTextContent("es");
        expect(screen.getByTestId("t")).toHaveTextContent("Colección");
    });

    it("cambia a inglés y persiste en localStorage", () => {
        renderProvider();
        fireEvent.click(screen.getByText("EN"));
        expect(screen.getByTestId("locale")).toHaveTextContent("en");
        expect(screen.getByTestId("t")).toHaveTextContent("Collection");
        expect(localStorage.getItem("nexus-locale")).toBe("en");
    });

    it("vuelve a español", () => {
        renderProvider();
        fireEvent.click(screen.getByText("EN"));
        fireEvent.click(screen.getByText("ES"));
        expect(screen.getByTestId("locale")).toHaveTextContent("es");
        expect(screen.getByTestId("t")).toHaveTextContent("Colección");
        expect(localStorage.getItem("nexus-locale")).toBe("es");
    });

    it("lee el idioma persistido al recargar (sin provider nuevo)", () => {
        localStorage.setItem("nexus-locale", "en");
        renderProvider();
        expect(screen.getByTestId("locale")).toHaveTextContent("en");
        expect(screen.getByTestId("t")).toHaveTextContent("Collection");
    });

    it("sin provider devuelve español y no lanza (degradado seguro)", () => {
        // Renderiza el consumidor sin LocaleProvider: createContext devuelve el
        // valor por defecto ("es") y nunca lanza.
        render(<TestComponentSinProvider />);
        expect(screen.getByTestId("locale")).toHaveTextContent("es");
        expect(screen.getByTestId("t")).toHaveTextContent("nav.collection");
    });
});
