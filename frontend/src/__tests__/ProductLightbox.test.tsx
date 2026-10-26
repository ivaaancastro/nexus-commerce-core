import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";
import ProductLightbox from "@/components/ProductLightbox";

const NAME = "Blazer Cruzada Estructura";
const FAMILY = "OUTERWEAR";
const IMAGES = [
    "/products/0432-021-1.webp",
    "/products/0432-021-2.webp",
    "/products/0432-021-3.webp",
];

/** jsdom no implementa `matchMedia`: lo instala el test para simular el entorno. */
function conPunteroFino(matches: boolean) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (media: string): MediaQueryList =>
            ({
                matches,
                media,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false,
            }) as MediaQueryList,
    });
}

function renderVisor(
    overrides: Partial<Parameters<typeof ProductLightbox>[0]> = {}
) {
    const setIndex = overrides.setIndex ?? vi.fn();
    const onClose = overrides.onClose ?? vi.fn();
    const utils = render(
        <ProductLightbox
            images={IMAGES}
            name={NAME}
            family={FAMILY}
            index={0}
            setIndex={setIndex}
            onClose={onClose}
            {...overrides}
        />
    );
    return {
        ...utils,
        setIndex: setIndex as ReturnType<typeof vi.fn>,
        onClose: onClose as ReturnType<typeof vi.fn>,
        dialogo: screen.getByTestId("product-lightbox"),
    };
}

afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia");
});

describe("ProductLightbox (V2 — R2..R7)", () => {
    it("R5 — diálogo modal con role, aria-modal y nombre accesible", () => {
        renderVisor();

        const dialogo = screen.getByRole("dialog", {
            name: "Galería ampliada de producto",
        });
        expect(dialogo).toHaveAttribute("aria-modal", "true");
    });

    it("R5 — el foco inicial cae en el botón ✕", () => {
        renderVisor();

        expect(screen.getByRole("button", { name: "Cerrar visor" })).toHaveFocus();
    });

    it("R2 — abre en el índice indicado, con el alt de la rejilla y `sizes=100vw`", () => {
        renderVisor({ index: 1 });

        const imagen = screen.getByRole("img");
        expect(imagen).toHaveAttribute("alt", `${NAME} — detalle 2`);
        expect(imagen).toHaveAttribute("sizes", "100vw");
        expect(screen.getByRole("status")).toHaveTextContent("2 / 3");
    });

    it("R4 — ✕ cierra", async () => {
        const user = userEvent.setup();
        const { onClose } = renderVisor();

        await user.click(screen.getByRole("button", { name: "Cerrar visor" }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("R4 — Escape cierra", async () => {
        const user = userEvent.setup();
        const { onClose } = renderVisor();

        await user.keyboard("{Escape}");

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("R4 — un clic en el fondo cierra", async () => {
        const user = userEvent.setup();
        const { onClose, dialogo } = renderVisor();

        await user.click(dialogo);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("R4 — un clic sobre la imagen NO cierra", async () => {
        const user = userEvent.setup();
        const { onClose } = renderVisor();

        await user.click(screen.getByRole("img"));

        expect(onClose).not.toHaveBeenCalled();
    });

    it("R4 — anti-arrastre: empezar en el fondo y soltar sobre la imagen no cierra", async () => {
        const user = userEvent.setup();
        const { onClose, dialogo } = renderVisor();

        await user.pointer({ keys: "[MouseLeft>]", target: dialogo });
        await user.pointer({ keys: "[/MouseLeft]", target: screen.getByRole("img") });

        expect(onClose).not.toHaveBeenCalled();
    });

    it("R4 — bloquea el scroll del body y lo restaura al desmontar", () => {
        const { unmount } = renderVisor();

        expect(document.body.style.overflow).toBe("hidden");
        unmount();
        expect(document.body.style.overflow).toBe("");
    });

    it("R3 — ‹ y › navegan con wrap en los extremos", async () => {
        const user = userEvent.setup();
        const { setIndex } = renderVisor();

        await user.click(screen.getByRole("button", { name: "Imagen anterior" }));
        expect(setIndex).toHaveBeenLastCalledWith(2); // 1ª → última

        await user.click(screen.getByRole("button", { name: "Imagen siguiente" }));
        expect(setIndex).toHaveBeenLastCalledWith(1);
    });

    it("R3 — con una sola imagen no hay ‹ › y el contador dice 1 / 1", () => {
        renderVisor({ images: [IMAGES[0]] });

        expect(
            screen.queryByRole("button", { name: "Imagen anterior" })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Imagen siguiente" })
        ).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("1 / 1");
    });

    it("R3 — ← y → navegan (circulares) y Escape sigue disponible", async () => {
        const user = userEvent.setup();
        const { setIndex } = renderVisor();

        await user.keyboard("{ArrowLeft}");
        expect(setIndex).toHaveBeenLastCalledWith(2);

        await user.keyboard("{ArrowRight}");
        expect(setIndex).toHaveBeenLastCalledWith(1);
    });

    it("R5 — trampa de foco: Tab circula dentro y Shift+Tab vuelve atrás", async () => {
        const user = userEvent.setup();
        renderVisor();

        // Foco inicial en ✕ (primero del DOM) → Tab → ‹
        await user.keyboard("{Tab}");
        expect(screen.getByRole("button", { name: "Imagen anterior" })).toHaveFocus();

        // → › (último) → Tab envuelve al primero
        await user.keyboard("{Tab}");
        expect(screen.getByRole("button", { name: "Imagen siguiente" })).toHaveFocus();
        await user.keyboard("{Tab}");
        expect(screen.getByRole("button", { name: "Cerrar visor" })).toHaveFocus();

        // Shift+Tab desde el primero envuelve al último
        await user.keyboard("{Shift>}{Tab}{/Shift}");
        expect(screen.getByRole("button", { name: "Imagen siguiente" })).toHaveFocus();
    });

    it("R6 — con puntero fino, el hover zoomifica ×2 y al salir vuelve a escala 1", async () => {
        const user = userEvent.setup();
        conPunteroFino(true);
        const { dialogo } = renderVisor();
        const capa = dialogo.querySelector(".cursor-zoom-in") as HTMLElement;

        await user.hover(capa);
        expect(capa.style.transform).toBe("scale(2)");
        expect(capa.style.transformOrigin).toBe("50% 50%"); // jsdom no mide: centro

        await user.unhover(capa);
        expect(capa.style.transform).toBe("scale(1)");
    });

    it("R6 — sin puntero fino no hay zoom (móvil/tablet táctil)", async () => {
        const user = userEvent.setup();
        conPunteroFino(false);
        const { dialogo } = renderVisor();
        const capa = dialogo.querySelector(".cursor-zoom-in") as HTMLElement;

        await user.hover(capa);
        expect(capa.style.transform).toBe("scale(1)");
    });

    it("R6 — sin matchMedia (entorno hostil) tampoco hay zoom: guarda defensiva", async () => {
        const user = userEvent.setup();
        const { dialogo } = renderVisor();
        const capa = dialogo.querySelector(".cursor-zoom-in") as HTMLElement;

        await user.hover(capa);
        expect(capa.style.transform).toBe("scale(1)");
    });
});
