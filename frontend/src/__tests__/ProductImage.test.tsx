import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ProductImage from "@/components/ProductImage";

const PROPS = {
    alt: "Blazer Cruzada Estructura",
    sizes: "(max-width: 767px) 100vw, (max-width: 1200px) 30vw, 320px",
    name: "Blazer Cruzada Estructura",
    family: "OUTERWEAR",
};

describe("ProductImage (R4, R6, R8)", () => {
    it("R4 — sin src pinta el placeholder y no monta ningún <img>", () => {
        render(<ProductImage {...PROPS} src={undefined} />);

        expect(screen.getByTestId("product-image-fallback")).toBeInTheDocument();
        // Sin <img> no hay peticiones: es la defensa contra los 404
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("R4 — el placeholder es decorativo: aria-hidden y el nombre en atributo", () => {
        render(<ProductImage {...PROPS} src={undefined} />);

        const thumb = screen.getByTestId("product-thumb");
        expect(thumb).toHaveAttribute("aria-hidden", "true");
        expect(thumb).toHaveAttribute("data-product-name", PROPS.name);
        // El nombre se ve junto a la imagen, no dentro de la caja
        expect(thumb).not.toHaveTextContent(PROPS.name);
        expect(thumb).toHaveTextContent(PROPS.family);
    });

    it("R6 — reserva el aspecto antes de cargar: contenedor relativo con aspect-[3/4]", () => {
        render(<ProductImage {...PROPS} src="/products/0432-021-1.webp" />);

        const box = screen.getByTestId("product-image");
        expect(box).toHaveClass("relative");
        expect(box).toHaveClass("aspect-[3/4]");
        // Fondo mientras carga: no hay destello blanco
        expect(box).toHaveClass("bg-neutral-100");
    });

    it("R6 — lleva `sizes` explícito y carga diferida por defecto", () => {
        render(<ProductImage {...PROPS} src="/products/0432-021-1.webp" />);

        const img = screen.getByRole("img");
        expect(img).toHaveAttribute("sizes", PROPS.sizes);
        expect(img).toHaveAttribute("loading", "lazy");
        expect(img).not.toHaveAttribute("fetchpriority", "high");
    });

    it("R6 — `eager` es loading=eager + fetchPriority=high para el LCP", () => {
        render(<ProductImage {...PROPS} src="/products/0432-021-1.webp" eager />);

        const img = screen.getByRole("img");
        expect(img).toHaveAttribute("loading", "eager");
        expect(img).toHaveAttribute("fetchpriority", "high");
    });

    it("R6 — no usa `priority`, que está deprecada desde Next 16", () => {
        // Equivalente al grep del criterio de aceptación: `fetchPriority=` no
        // debe confundirse con `priority=`.
        const source = readFileSync(
            path.resolve(process.cwd(), "src/components/ProductImage.tsx"),
            "utf8"
        );

        expect(source).not.toContain("priority={");
    });

    it("R8 — el alt es el nombre del producto, nunca vacío", () => {
        render(<ProductImage {...PROPS} src="/products/0432-021-1.webp" />);

        expect(screen.getByRole("img")).toHaveAttribute("alt", PROPS.name);
    });

    it("R4/R9 — si la imagen falla al cargar, cambia al placeholder", () => {
        render(<ProductImage {...PROPS} src="/products/0432-021-1.webp" />);
        expect(screen.getByTestId("product-image")).toBeInTheDocument();

        fireEvent.error(screen.getByRole("img"));

        expect(screen.getByTestId("product-image-fallback")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
});
