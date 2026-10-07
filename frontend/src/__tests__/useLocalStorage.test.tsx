import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useLocalStorage } from "@/hooks/useLocalStorage";

/**
 * Tarea 4.1, R1 + R6 — persistencia en `localStorage`.
 *
 * El hook se reescribió con `useSyncExternalStore` (D5b de `plan.md`), y de
 * ahí salen dos contratos que estos tests fijan:
 *
 * 1. El valor persistido está en el **primer render** — sin esperar a ningún
 *    efecto. Es justo lo que R8 obligaba a no romper.
 * 2. `getSnapshot` devuelve **la misma referencia** mientras el contenido no
 *    cambie; si no, React lanza «The result of getSnapshot should be cached».
 */

const CLAVE = "nexus-test-store";

function Sonda({ inicial = [] }: { inicial?: string[] }) {
    const [value, setValue, hydrated] = useLocalStorage<string[]>(CLAVE, inicial);
    return (
        <div>
            <span data-testid="valor">{JSON.stringify(value)}</span>
            <span data-testid="hidratado">{String(hydrated)}</span>
            <button onClick={() => setValue(["persistido"])}>guardar</button>
            <button onClick={() => setValue((prev) => [...prev, "nuevo"])}>añadir</button>
        </div>
    );
}

function Escritor() {
    const [, setValue] = useLocalStorage<string[]>(CLAVE, []);
    return <button onClick={() => setValue(["escrito"])}>escribir</button>;
}

function Lector() {
    const [value] = useLocalStorage<string[]>(CLAVE, []);
    return <span data-testid="lector">{JSON.stringify(value)}</span>;
}

/** Registra cada snapshot que ve, para poder comparar referencias. */
const vistas: string[][] = [];
function SondaRef() {
    const [value] = useLocalStorage<string[]>(CLAVE, []);
    vistas.push(value);
    return null;
}

describe("useLocalStorage", () => {
    beforeEach(() => {
        window.localStorage.clear();
        vistas.length = 0;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("devuelve el valor inicial cuando no hay nada persistido", () => {
        render(<Sonda inicial={["por-defecto"]} />);

        expect(screen.getByTestId("valor")).toHaveTextContent('["por-defecto"]');
    });

    it("refleja el valor persistido en el PRIMER render, sin esperar a ningún efecto (R6)", () => {
        // GIVEN algo guardado por una sesión anterior
        window.localStorage.setItem(CLAVE, JSON.stringify(["ya-estaba"]));

        // WHEN se monta la sonda
        render(<Sonda inicial={[]} />);

        // THEN el valor ya está en la primera pintada
        expect(screen.getByTestId("valor")).toHaveTextContent('["ya-estaba"]');
    });

    it("`setValue` persiste en localStorage", async () => {
        // GIVEN la sonda montada
        const user = userEvent.setup();
        render(<Sonda inicial={[]} />);

        // WHEN se guarda
        await user.click(screen.getByText("guardar"));

        // THEN el valor está en el almacenamiento y en pantalla
        expect(window.localStorage.getItem(CLAVE)).toBe('["persistido"]');
        expect(screen.getByTestId("valor")).toHaveTextContent('["persistido"]');
    });

    it("`setValue` acepta updater de función", async () => {
        const user = userEvent.setup();
        render(<Sonda inicial={["base"]} />);

        await user.click(screen.getByText("añadir"));

        expect(window.localStorage.getItem(CLAVE)).toBe('["base","nuevo"]');
        expect(screen.getByTestId("valor")).toHaveTextContent('["base","nuevo"]');
    });

    it("`setValue` notifica a las demás instancias con la misma clave", async () => {
        // GIVEN dos componentes compartiendo la misma clave
        const user = userEvent.setup();
        render(
            <>
                <Escritor />
                <Lector />
            </>
        );
        expect(screen.getByTestId("lector")).toHaveTextContent("[]");

        // WHEN uno de ellos escribe
        await user.click(screen.getByText("escribir"));

        // THEN el otro ve el cambio sin recargar
        expect(window.localStorage.getItem(CLAVE)).toBe('["escrito"]');
        expect(screen.getByTestId("lector")).toHaveTextContent('["escrito"]');
    });

    it("conserva la identidad del snapshot mientras el contenido no cambie", () => {
        // GIVEN un valor ya persistido
        window.localStorage.setItem(CLAVE, JSON.stringify(["a"]));

        // WHEN se vuelve a pintar el mismo componente
        const { rerender } = render(<SondaRef />);
        rerender(<SondaRef />);

        // THEN las dos lecturas devuelven exactamente el mismo objeto
        expect(vistas.length).toBeGreaterThanOrEqual(2);
        expect(vistas[0]).toBe(vistas[1]);
    });

    it("JSON inválido: conserva el valor inicial, avisa por consola y no lanza", () => {
        // GIVEN una clave corrupta a mano de terceros
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        window.localStorage.setItem(CLAVE, "{no es json");

        // WHEN se monta la sonda
        render(<Sonda inicial={["intacto"]} />);

        // THEN no se rompe: se queda en el valor inicial y se deja constancia
        expect(screen.getByTestId("valor")).toHaveTextContent('["intacto"]');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(CLAVE), expect.anything());
    });

    it("`isHydrated` es `true` en el cliente", () => {
        render(<Sonda />);

        expect(screen.getByTestId("hidratado")).toHaveTextContent("true");
    });

    it("en servidor el snapshot es el inicial y `isHydrated` es `false` (SSR seguro)", () => {
        // GIVEN un valor guardado en el navegador
        window.localStorage.setItem(CLAVE, JSON.stringify(["del-cliente"]));

        // WHEN se renderiza en el servidor
        const html = renderToStaticMarkup(<Sonda inicial={[]} />);

        // THEN allí no se lee `localStorage`: se pinta el inicial y sin hidratar
        expect(html).toContain(">false<");
        expect(html).not.toContain("del-cliente");
        expect(html).toContain("data-testid=\"valor\">[]<");
    });
});
