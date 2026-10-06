import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProductThumb from "@/components/ProductThumb";

/**
 * R8 de specs/order-detail-redesign: placeholder editorial, porque el proyecto
 * no tiene ni una imagen (`Product` no tiene campo de imagen y `public/` solo
 * contiene los SVG de Next).
 */
describe("ProductThumb", () => {
    it("pinta la familia dentro de la caja", () => {
        render(<ProductThumb name="Camisa Oxford" family="Camisas" />);

        expect(screen.getByText("Camisas")).toBeInTheDocument();
    });

    it("añade la talla a la familia cuando se pasa", () => {
        render(<ProductThumb name="Camisa Oxford" family="Camisas" size="M" />);

        expect(screen.getByText("Camisas · M")).toBeInTheDocument();
    });

    it("es decorativa: el nombre viaja en un atributo, no como texto visible", () => {
        render(<ProductThumb name="Camisa Oxford" family="Camisas" />);

        const thumb = screen.getByTestId("product-thumb");
        expect(thumb).toHaveAttribute("aria-hidden", "true");
        expect(thumb).toHaveAttribute("data-product-name", "Camisa Oxford");
        // El nombre se escribe al lado en cada pantalla, así que aquí no se repite
        expect(thumb).not.toHaveTextContent("Camisa Oxford");
    });

    it("usa el tamaño por defecto y respeta el que llega por props", () => {
        const { rerender } = render(
            <ProductThumb name="Camisa Oxford" family="Camisas" />
        );
        expect(screen.getByTestId("product-thumb")).toHaveClass("w-20", "h-24");

        rerender(
            <ProductThumb
                name="Camisa Oxford"
                family="Camisas"
                className="w-12 h-14 shrink-0"
            />
        );
        expect(screen.getByTestId("product-thumb")).toHaveClass("w-12", "h-14");
        expect(screen.getByTestId("product-thumb")).not.toHaveClass("w-20");
    });
});
