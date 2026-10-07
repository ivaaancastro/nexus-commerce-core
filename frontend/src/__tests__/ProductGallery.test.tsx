import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProductGallery from "@/components/ProductGallery";

const REFERENCE = "0432/021";
const NAME = "Blazer Cruzada Estructura";
const FAMILY = "OUTERWEAR";
const SIZES = "(max-width: 767px) 100vw, (max-width: 1200px) 30vw, 320px";

function renderGallery(reference = REFERENCE) {
    render(
        <ProductGallery
            referenceCode={reference}
            name={NAME}
            family={FAMILY}
            sizes={SIZES}
        />
    );
    return screen.getByTestId("product-gallery");
}

describe("ProductGallery (R6, R7, R8, R9)", () => {
    it("R7 — pinta las 3 imágenes del manifiesto", () => {
        const gallery = renderGallery();

        expect(
            gallery.querySelectorAll('[data-testid="product-image"]')
        ).toHaveLength(3);
    });

    it("R7 — 1 columna en móvil, 2 a partir de 768px, con gap-2", () => {
        const gallery = renderGallery();

        expect(gallery).toHaveClass("grid");
        expect(gallery).toHaveClass("grid-cols-1");
        expect(gallery).toHaveClass("md:grid-cols-2");
        expect(gallery).toHaveClass("gap-2");
    });

    it("R6 — la primera fila de la galería es eager (LCP) y el resto va lazy", () => {
        const gallery = renderGallery();
        const images = gallery.querySelectorAll("img");

        expect(images[0]).toHaveAttribute("loading", "eager");
        expect(images[0]).toHaveAttribute("fetchpriority", "high");
        expect(images[1]).toHaveAttribute("loading", "eager");
        expect(images[1]).toHaveAttribute("fetchpriority", "high");
        expect(images[2]).toHaveAttribute("loading", "lazy");
    });

    it("R6 — cada imagen lleva su `sizes`", () => {
        const gallery = renderGallery();

        for (const image of gallery.querySelectorAll("img")) {
            expect(image).toHaveAttribute("sizes", SIZES);
        }
    });

    it("R8 — alt: nombre en la vista 1 y «detalle n» en las demás", () => {
        const gallery = renderGallery();
        const alts = [...gallery.querySelectorAll("img")].map((image) =>
            image.getAttribute("alt")
        );

        expect(alts).toEqual([
            NAME,
            `${NAME} — detalle 2`,
            `${NAME} — detalle 3`,
        ]);
    });

    it("R9 — referencia sin manifiesto: una caja y cero peticiones", () => {
        const gallery = renderGallery("9999/999");

        expect(gallery.querySelectorAll("img")).toHaveLength(0);
        expect(gallery.querySelector('[data-testid="product-image-fallback"]'))
            .toBeInTheDocument();
        // La ficha conserva su layout: el hueco de la galería no desaparece
        expect(gallery.children).toHaveLength(1);
    });
});
