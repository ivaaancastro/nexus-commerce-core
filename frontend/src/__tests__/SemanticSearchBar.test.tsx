import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SemanticSearchBar from "@/components/SemanticSearchBar";

/**
 * Tarea 4.1, R1 — barra de búsqueda semántica.
 *
 * Lo que protege: el backend recibe la consulta **recortada** (los espacios
 * que se suelen escribir al principio y al final dispararían una búsqueda
 * vacía o rara) y una consulta de sólo espacios **no llega a emitirse**.
 */

function pintar(props: Partial<Parameters<typeof SemanticSearchBar>[0]> = {}) {
    const onSearch = vi.fn();
    const onClear = vi.fn();
    const view = render(
        <SemanticSearchBar
            onSearch={onSearch}
            onClear={onClear}
            isLoading={false}
            activeQuery=""
            {...props}
        />
    );
    return { ...view, onSearch, onClear };
}

describe("SemanticSearchBar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("envía la consulta con los espacios recortados", async () => {
        // GIVEN la barra vacía
        const user = userEvent.setup();
        const { onSearch } = pintar();

        // WHEN se escribe con espacios sobrantes y se envía
        await user.type(screen.getByRole("textbox"), "   traje lino   ");
        await user.keyboard("{Enter}");

        // THEN el backend recibe sólo lo que significa algo
        expect(onSearch).toHaveBeenCalledTimes(1);
        expect(onSearch).toHaveBeenCalledWith("traje lino");
    });

    it("una consulta de sólo espacios no se envía", async () => {
        const user = userEvent.setup();
        const { onSearch } = pintar();

        await user.type(screen.getByRole("textbox"), "     ");
        await user.keyboard("{Enter}");

        expect(onSearch).not.toHaveBeenCalled();
    });

    it("«Limpiar» llama a onClear y vacía el input", async () => {
        // GIVEN una búsqueda ya en curso
        const user = userEvent.setup();
        const { onClear } = pintar({ activeQuery: "traje lino" });
        expect(screen.getByRole("textbox")).toHaveValue("traje lino");

        // WHEN se pulsa «Limpiar»
        await user.click(screen.getByRole("button", { name: "Limpiar" }));

        // THEN la consulta queda anulada y el campo en blanco
        expect(onClear).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("«Limpiar» sólo se pinta con una consulta activa", () => {
        // GIVEN una barra recién abierta
        const { unmount } = pintar();
        expect(screen.queryByRole("button", { name: "Limpiar" })).not.toBeInTheDocument();
        unmount();

        // WHEN ya hay una consulta aplicada
        pintar({ activeQuery: "abrigo" });

        // THEN aparece la vía para quitarla
        expect(screen.getByRole("button", { name: "Limpiar" })).toBeInTheDocument();
    });

    it("el botón de envío se deshabilita mientras carga o con el input vacío", () => {
        // GIVEN la barra sin nada escrito
        const { unmount } = pintar();
        expect(screen.getByRole("button", { name: "Buscar" })).toBeDisabled();
        unmount();

        // WHEN hay texto y no está cargando
        pintar({ activeQuery: "abrigo" });

        // THEN se puede buscar
        expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
    });

    it("mientras carga, el botón se apaga y anuncia «Buscando...»", () => {
        // GIVEN una búsqueda en curso
        pintar({ isLoading: true, activeQuery: "abrigo" });

        // THEN no se emiten peticiones nuevas y se ve el estado de carga
        const boton = screen.getByRole("button", { name: "Buscando..." });
        expect(boton).toBeDisabled();
    });

    it("parte del valor de la consulta activa, no de un campo vacío", () => {
        pintar({ activeQuery: "lino" });

        expect(screen.getByRole("textbox")).toHaveValue("lino");
    });
});
