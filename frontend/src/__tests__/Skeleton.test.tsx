import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Skeleton from "@/components/Skeleton";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";
import ProductDetailSkeleton from "@/components/ProductDetailSkeleton";

describe("Skeleton Components", () => {
    describe("Skeleton", () => {
        it("debe renderizar con la clase animate-pulse", () => {
            const { container } = render(<Skeleton className="h-4 w-20" />);
            const skeleton = container.firstChild as HTMLElement;
            expect(skeleton).toHaveClass("animate-pulse");
            expect(skeleton).toHaveClass("bg-neutral-200");
        });

        it("debe tener aria-hidden para accesibilidad", () => {
            const { container } = render(<Skeleton />);
            const skeleton = container.firstChild as HTMLElement;
            expect(skeleton).toHaveAttribute("aria-hidden", "true");
        });

        it("debe aplicar clases personalizadas", () => {
            const { container } = render(<Skeleton className="h-10 w-full rounded-md" />);
            const skeleton = container.firstChild as HTMLElement;
            expect(skeleton).toHaveClass("h-10");
            expect(skeleton).toHaveClass("w-full");
            expect(skeleton).toHaveClass("rounded-md");
        });
    });

    describe("ProductCardSkeleton", () => {
        it("debe renderizar la estructura de tarjeta", () => {
            const { container } = render(<ProductCardSkeleton />);
            const skeletons = container.querySelectorAll('[aria-hidden="true"]');
            expect(skeletons.length).toBeGreaterThan(0);
        });

        it("debe mantener la misma estructura visual que ProductCard", () => {
            const { container } = render(<ProductCardSkeleton />);
            const article = container.querySelector("article");
            expect(article).toBeInTheDocument();
            expect(article).toHaveClass("border");
            expect(article).toHaveClass("bg-white");
        });
    });

    describe("ProductDetailSkeleton", () => {
        it("debe renderizar el layout de doble columna", () => {
            const { container } = render(<ProductDetailSkeleton />);
            const grid = container.querySelector(".grid");
            expect(grid).toBeInTheDocument();
            expect(grid).toHaveClass("md:grid-cols-12");
        });

        it("debe incluir skeleton de header", () => {
            const { container } = render(<ProductDetailSkeleton />);
            const header = container.querySelector(".border-b");
            expect(header).toBeInTheDocument();
        });

        it("R9 — replica galería + panel + descripción con cajas de aspecto reservado", () => {
            const { container } = render(<ProductDetailSkeleton />);

            // 3 cajas con el mismo aspecto que ProductImage → sin layout shift
            const aspectBoxes = container.querySelectorAll('div[class*="aspect-"]');
            expect(aspectBoxes).toHaveLength(3);
            for (const box of aspectBoxes) {
                expect(box).toHaveClass("aspect-[3/4]");
                expect(box).toHaveClass("w-full");
            }

            // La galería es una rejilla de 1 / 2 columnas dentro de la de 12
            expect(container.querySelector(".md\\:grid-cols-2")).toBeInTheDocument();

            // El panel conserva las clases sticky del layout nuevo
            expect(container.querySelector(".md\\:sticky")).toBeInTheDocument();
            expect(container.querySelector(".md\\:row-span-2")).toBeInTheDocument();
        });
    });
});
